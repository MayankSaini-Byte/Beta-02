const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');

const router = express.Router();

function sanitize(user) {
  const { passwordHash, ...rest } = user;
  return rest;
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
      household: { adults: 2, children: 1, diet: 'veg', allergies: [], tastes: ['comfort', 'spicy'], weeklyBudget: 1500 },
      favorites: [],
      lastReconcile: { at: null, accuracy: null },
      notificationsReadAt: null
    });
  }
  res.json({ token: sign(user), user: sanitize(user), mode: req.db.kind });
}));

router.post('/register', asyncH(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) throw httpError(400, 'name, email and password are required');
  if (String(password).length < 6) throw httpError(400, 'Password must be at least 6 characters');

  const users = req.db.col('users');
  const existing = await users.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) throw httpError(409, 'An account with this email already exists');

  const user = await users.insertOne({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash: bcrypt.hashSync(String(password), 10),
    household: { adults: 2, children: 0, diet: 'veg', allergies: [], tastes: [], weeklyBudget: 1500 },
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
  if (b.prefs) {
    const p = user.prefs || {};
    patch.prefs = {
      lang: ['en', 'hi'].includes(b.prefs.lang) ? b.prefs.lang : p.lang || 'en',
      theme: b.prefs.theme || p.theme || 'dark'
    };
  }
  if (b.household) {
    const h = user.household || {};
    patch.household = {
      adults: Math.max(1, parseInt(b.household.adults ?? h.adults ?? 1, 10) || 1),
      children: Math.max(0, parseInt(b.household.children ?? h.children ?? 0, 10) || 0),
      diet: b.household.diet ?? h.diet ?? 'veg',
      allergies: Array.isArray(b.household.allergies) ? b.household.allergies : h.allergies || [],
      tastes: Array.isArray(b.household.tastes) ? b.household.tastes : h.tastes || [],
      weeklyBudget: Math.max(0, Number(b.household.weeklyBudget ?? h.weeklyBudget ?? 1500)),
      goal: ['none', 'cut', 'bulk', 'maintain'].includes(b.household.goal) ? b.household.goal : h.goal || 'none'
    };
  }
  const updated = await users.updateOne({ _id: user._id }, patch);
  res.json({ user: sanitize(updated) });
}));

module.exports = router;
