const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');

const router = express.Router();
const DIETS = ['inherit', 'veg', 'egg', 'nonveg', 'vegan', 'jain', 'custom'];

function cleanList(values, max = 30) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].slice(0, max);
}

function normalizeMember(person, index, previous = {}) {
  return {
    id: String(person.id || previous.id || crypto.randomUUID()),
    name: String(person.name || previous.name || `Person ${index + 1}`).trim(),
    role: ['admin', 'member'].includes(person.role) ? person.role : previous.role || (index === 0 ? 'admin' : 'member'),
    type: ['adult', 'child'].includes(person.type) ? person.type : previous.type || 'adult',
    diet: DIETS.includes(person.diet) ? person.diet : previous.diet || 'inherit',
    allergies: cleanList(person.allergies ?? previous.allergies),
    calorieTarget: Math.max(800, Number(person.calorieTarget ?? previous.calorieTarget) || (person.type === 'child' ? 1500 : 2000)),
    proteinTarget: Math.max(0, Number(person.proteinTarget ?? previous.proteinTarget) || 75)
  };
}

function sanitize(user) {
  const { passwordHash, ...rest } = user;
  const accountType = ['household', 'commercial', 'service'].includes(rest.accountType)
    ? rest.accountType
    : rest.household?.kitchenType === 'commercial' ? 'commercial' : rest.household?.kitchenType === 'hostel' ? 'service' : 'household';
  return { ...rest, accountType, onboardingComplete: rest.onboardingComplete !== false };
}

function sign(user) {
  return jwt.sign({ sub: user._id, email: user.email }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES });
}

/** One-click demo login - creates the demo household on first use */
router.post('/demo', asyncH(async (req, res) => {
  const users = req.db.col('users');
  let user = await users.findOne({ email: 'demo@kitchensync.app' });
  if (!user) {
    user = await users.insertOne({
      name: 'Demo Family',
      email: 'demo@kitchensync.app',
      passwordHash: bcrypt.hashSync('demo1234', 10),
      accountType: 'household',
      onboardingComplete: true,
      household: { adults: 2, children: 1, diet: 'veg', allergies: [], tastes: ['comfort', 'spicy'], weeklyBudget: 1500 },
      favorites: [],
      lastReconcile: { at: null, accuracy: null },
      notificationsReadAt: null
    });
  }
  res.json({ token: sign(user), user: sanitize(user), mode: req.db.kind });
}));

router.post('/register', asyncH(async (req, res) => {
  const { name, email, password, accountType = 'household' } = req.body || {};
  if (!name || !email || !password) throw httpError(400, 'name, email and password are required');
  if (String(password).length < 6) throw httpError(400, 'Password must be at least 6 characters');
  if (!['household', 'commercial', 'service'].includes(accountType)) throw httpError(400, 'Choose a valid account type');

  const users = req.db.col('users');
  const existing = await users.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) throw httpError(409, 'An account with this email already exists');

  const user = await users.insertOne({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash: bcrypt.hashSync(String(password), 10),
    accountType,
    onboardingComplete: false,
    household: { kitchenType: accountType === 'service' ? 'hostel' : accountType, residents: 2, adults: 2, children: 0, diet: 'veg', foodPractice: 'none', address: '', pincode: '', calorieTarget: 2000, proteinTarget: 75, cuisines: [], allergies: [], tastes: [], weeklyBudget: 1500 },
    businessProfile: { businessType: '', outletName: '', address: '', dailyServings: 0, vendorContact: '' },
    members: [],
    favorites: [],
    lastReconcile: { at: null, accuracy: null },
    notificationsReadAt: null
  });
  res.status(201).json({ token: sign(user), user: sanitize(user), mode: req.db.kind });
}));

router.post('/login', asyncH(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw httpError(400, 'email and password are required');
  const users = req.db.col('users');
  const user = await users.findOne({ email: String(email).toLowerCase().trim() });
  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
    throw httpError(401, 'Invalid email or password');
  }
  res.json({ token: sign(user), user: sanitize(user), mode: req.db.kind });
}));

router.get('/me', auth, asyncH(async (req, res) => {
  const user = await req.db.col('users').findOne({ _id: req.userId });
  if (!user) throw httpError(401, 'User not found');
  res.json({ user: sanitize(user), mode: req.db.kind });
}));

router.put('/me', auth, asyncH(async (req, res) => {
  const users = req.db.col('users');
  const user = await users.findOne({ _id: req.userId });
  if (!user) throw httpError(401, 'User not found');

  const patch = {};
  const b = req.body || {};
  if (b.name) patch.name = String(b.name).trim();
  if (['household', 'commercial', 'service'].includes(b.accountType)) patch.accountType = b.accountType;
  if (b.onboardingComplete === true) patch.onboardingComplete = true;
  if (b.businessProfile && typeof b.businessProfile === 'object') {
    const previous = user.businessProfile || {};
    patch.businessProfile = {
      businessType: String(b.businessProfile.businessType ?? previous.businessType ?? '').trim(),
      outletName: String(b.businessProfile.outletName ?? previous.outletName ?? '').trim(),
      address: String(b.businessProfile.address ?? previous.address ?? '').trim(),
      dailyServings: Math.max(0, Math.min(50000, Number(b.businessProfile.dailyServings ?? previous.dailyServings) || 0)),
      vendorContact: String(b.businessProfile.vendorContact ?? previous.vendorContact ?? '').trim()
    };
  }
  if (b.prefs) {
    const p = user.prefs || {};
    patch.prefs = {
      lang: ['en', 'hi'].includes(b.prefs.lang) ? b.prefs.lang : p.lang || 'en',
      theme: b.prefs.theme || p.theme || 'dark'
    };
  }
  if (b.household) {
    const h = user.household || {};
    const normalizedMembers = Array.isArray(b.members)
      ? b.members.slice(0, 50).map((person, index) => {
        const previous = (user.members || []).find((member) => member.id === person.id) || {};
        return normalizeMember(person, index, previous);
      })
      : null;
    if (normalizedMembers?.some((member) => !member.name)) throw httpError(400, 'Each person must have a name');
    const pincode = String(b.household.pincode ?? h.pincode ?? '').trim();
    if (pincode && !/^[1-9]\d{5}$/.test(pincode)) throw httpError(400, 'PIN code must be six digits and cannot start with 0');
    patch.household = {
      kitchenType: ['household', 'hostel', 'commercial'].includes(b.household.kitchenType) ? b.household.kitchenType : h.kitchenType || 'household',
      residents: Math.min(5000, Math.max(1, parseInt(b.household.residents ?? h.residents ?? ((Number(h.adults) || 1) + (Number(h.children) || 0)), 10) || 1)),
      adults: Math.max(0, parseInt(b.household.adults ?? (normalizedMembers ? normalizedMembers.filter((member) => member.type === 'adult').length : h.adults ?? 1), 10) || 0),
      children: Math.max(0, parseInt(b.household.children ?? h.children ?? 0, 10) || 0),
      address: String(b.household.address ?? h.address ?? '').trim(),
      pincode,
      diet: ['veg', 'egg', 'nonveg', 'vegan', 'jain', 'custom'].includes(b.household.diet) ? b.household.diet : h.diet || 'veg',
      foodPractice: ['none', 'jain', 'satvik', 'halal'].includes(b.household.foodPractice) ? b.household.foodPractice : h.foodPractice || 'none',
      calorieTarget: Math.max(800, Math.min(10000, Number(b.household.calorieTarget ?? h.calorieTarget) || 2000)),
      proteinTarget: Math.max(0, Math.min(500, Number(b.household.proteinTarget ?? h.proteinTarget) || 75)),
      cuisines: Array.isArray(b.household.cuisines) ? [...new Set(b.household.cuisines.map((x) => String(x).trim()).filter(Boolean))].slice(0, 12) : h.cuisines || [],
      allergies: Array.isArray(b.household.allergies) ? b.household.allergies : h.allergies || [],
      tastes: Array.isArray(b.household.tastes) ? b.household.tastes : h.tastes || [],
      weeklyBudget: Math.max(0, Number(b.household.weeklyBudget ?? h.weeklyBudget ?? 1500)),
      goal: ['none', 'cut', 'bulk', 'maintain'].includes(b.household.goal) ? b.household.goal : h.goal || 'none'
    };
    if (normalizedMembers) patch.members = normalizedMembers;
  }
  const updated = await users.updateOne({ _id: user._id }, patch);
  res.json({ user: sanitize(updated) });
}));

module.exports = router;
