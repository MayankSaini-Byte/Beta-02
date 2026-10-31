const express = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const { todayISO } = require('../utils/dates');
const { estimateFoodNutrition } = require('../services/aiService');

const router = express.Router();
router.use(auth);

async function householdUser(req) {
  const user = await req.db.col('users').findOne({ _id: req.userId });
  if (!user) throw httpError(401, 'User not found');
  const type = user.accountType || (user.household?.kitchenType === 'commercial' ? 'commercial' : user.household?.kitchenType === 'hostel' ? 'service' : 'household');
  if (type !== 'household') throw httpError(403, 'Nutrition planning is available for household profiles');
  return user;
}

function selectedMember(user, memberId) {
  const member = (user.members || []).find((entry) => entry.id === memberId) || (user.members || [])[0];
  if (member) return member;
  return {
    id: 'household', name: user.name,
    calorieTarget: user.household?.calorieTarget || 2000,
    proteinTarget: user.household?.proteinTarget || 75
  };
}

router.get('/today', asyncH(async (req, res) => {
  const user = await householdUser(req);
  const member = selectedMember(user, String(req.query.memberId || ''));
  const date = todayISO();
  const entries = await req.db.col('dietlogs').find({ ownerId: req.userId, memberId: member.id, date });
  const consumed = entries.reduce((total, entry) => ({ calories: total.calories + entry.calories, protein: total.protein + entry.protein }), { calories: 0, protein: 0 });
  const targets = {
    calories: Math.max(800, Number(member.calorieTarget) || Number(user.household?.calorieTarget) || 2000),
    protein: Math.max(0, Number(member.proteinTarget) || Number(user.household?.proteinTarget) || 75)
  };
  res.json({ date, member: { id: member.id, name: member.name }, targets, consumed, remaining: { calories: Math.max(0, targets.calories - consumed.calories), protein: Math.max(0, targets.protein - consumed.protein) }, entries: entries.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))) });
}));

router.post('/estimate', asyncH(async (req, res) => {
  await householdUser(req);
  const name = String(req.body?.name || '').trim();
  const mealType = String(req.body?.mealType || 'dinner');
  if (!name) throw httpError(400, 'Enter a food name and portion to estimate');
  if (name.length > 120) throw httpError(400, 'Food description must be 120 characters or fewer');
  if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) throw httpError(400, 'Choose breakfast, lunch, dinner, or snack');

  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const recipes = await req.db.col('recipes').find({});
  const exactRecipe = recipes.find((recipe) => String(recipe.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === normalized && Number(recipe.kcal) > 0);
  if (exactRecipe) {
    return res.json({
      available: true,
      calories: Math.round(Number(exactRecipe.kcal)),
      protein: Math.round(Number(exactRecipe.nutrition?.protein || 0) * 10) / 10,
      serving: 'one recipe serving',
      confidence: 'medium',
      engine: 'recipe-library',
      note: 'Recipe library estimate for one serving. Adjust it to match the portion eaten.'
    });
  }

  try {
    const estimate = await estimateFoodNutrition({ food: name, mealType });
    return res.json({ available: true, ...estimate, engine: 'ai', note: 'Approximate AI estimate. Portion sizes and restaurant recipes vary; adjust if you know the menu nutrition.' });
  } catch {
    return res.json({ available: false, message: 'Could not estimate this dish right now. Enter kcal from the menu or your own estimate.' });
  }
}));

router.post('/log', asyncH(async (req, res) => {
  const user = await householdUser(req);
  const body = req.body || {};
  const member = selectedMember(user, String(body.memberId || ''));
  const name = String(body.name || '').trim();
  const calories = Number(body.calories);
  const protein = Number(body.protein || 0);
  const mealType = String(body.mealType || 'dinner');
  const source = String(body.source || 'outside');
  const isEstimated = body.isEstimated === true;
  if (!name) throw httpError(400, 'Food name is required');
  if (name.length > 120) throw httpError(400, 'Food name must be 120 characters or fewer');
  if (!Number.isFinite(calories) || calories < 0 || calories > 10000) throw httpError(400, 'Enter calories from 0 to 10,000');
  if (!Number.isFinite(protein) || protein < 0 || protein > 500) throw httpError(400, 'Enter protein from 0 to 500 g');
  if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) throw httpError(400, 'Choose breakfast, lunch, dinner, or snack');
  if (!['outside', 'home'].includes(source)) throw httpError(400, 'Choose outside or at home');
  const entry = await req.db.col('dietlogs').insertOne({
    id: crypto.randomUUID(), ownerId: req.userId, memberId: member.id, date: todayISO(),
    name, calories: Math.round(calories), protein: Math.round(protein * 10) / 10,
    mealType, source, isEstimated, createdAt: new Date().toISOString()
  });
  res.status(201).json({ entry });
}));

router.delete('/log/:id', asyncH(async (req, res) => {
  await householdUser(req);
  const logs = req.db.col('dietlogs');
  const entry = await logs.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!entry) throw httpError(404, 'Food log entry not found');
  await logs.deleteOne({ _id: entry._id, ownerId: req.userId });
  res.json({ ok: true });
}));

module.exports = router;
