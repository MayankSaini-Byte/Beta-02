/**
 * Dashboard routes - one-shot payload for the home screen:
 * today's meals (with stock chips + Mark done), use-soon strip, pre-meal
 * alerts, headline stats and budget snapshot.
 */
const express = require('express');
const auth = require('../middleware/auth');
const { asyncH } = require('../middleware/errors');
const { decoratePlan, computeDeductions } = require('../services/plannerService');
const { portionFactor } = require('../services/availabilityService');
const { todayISO } = require('../utils/dates');
const { toCommercial } = require('../utils/units');
const { basePriceFor } = require('../services/priceService');

const router = express.Router();
router.use(auth);

// GET /api/dashboard
router.get('/', asyncH(async (req, res) => {
  const db = req.db;
  const user = await db.col('users').findOne({ _id: req.userId });
  if (!user) return res.json({ error: 'no user' });

  const pantryItems = await db.col('pantries').find({ ownerId: req.userId });
  const recipes = await db.col('recipes').find({});

  // plan (auto-create on first dashboard visit)
  let plan = await db.col('mealplans').findOne({ ownerId: req.userId });
  if (!plan) {
    const { generateWeek } = require('../services/plannerService');
    const generated = generateWeek({ user, pantryItems, recipes, startISO: todayISO(), days: 7 });
    plan = await db.col('mealplans').insertOne({ ownerId: req.userId, ...generated });
  }
  const decorated = decoratePlan(plan, user, pantryItems, recipes);
  const today = todayISO();
  const todayPlan = decorated.days.find((d) => d.date === today);

  const factor = portionFactor(user.household);

  // Today's meals with stock chips + done state
  const meals = ['breakfast', 'lunch', 'dinner'].map((slot) => {
    const m = todayPlan ? todayPlan.meals[slot] : null;
    if (!m) return { slot, recipe: null };
    return {
      slot,
      recipe: {
        key: m.key, name: m.name, timeMin: m.timeMin, kcal: m.kcal,
        nutrition: m.nutrition, coverage: m.coverage, stockChip: m.stockChip,
        missing: m.missing, done: m.done, locked: m.locked, why: m.why
      }
    };
  });

  // Pre-meal alert: next upcoming meal (first not-done slot of today) missing items
  let preMealAlert = null;
  if (todayPlan) {
    for (const slot of ['breakfast', 'lunch', 'dinner']) {
      const m = todayPlan.meals[slot];
      if (m && !m.done && m.missing && m.missing.length) {
        preMealAlert = {
          slot, recipe: m.name,
          message: `${slot[0].toUpperCase() + slot.slice(1)}: missing ${m.missing.map((x) => x.name).slice(0, 3).join(', ')}${m.missing.length > 3 ? ` +${m.missing.length - 3} more` : ''}`,
          missing: m.missing
        };
        break;
      }
    }
  }

  // Use-soon strip: items expiring within 3 days (or expired today)
  const useSoon = pantryItems
    .map((p) => {
      const { daysUntil } = require('../utils/dates');
      const d = daysUntil(p.expiryDate);
      return { ...p, daysToExpiry: d };
    })
    .filter((p) => p.quantity > 0 && p.daysToExpiry !== null && p.daysToExpiry <= 3 && p.daysToExpiry >= -1)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
    .slice(0, 8)
    .map((p) => ({
      id: p._id, name: p.name, unit: p.unit, quantity: p.quantity,
      qtyDisplay: require('../utils/units').smartQty(p.quantity, p.unit),
      daysToExpiry: p.daysToExpiry,
      estValue: Math.min(Math.round(basePriceFor(p.key, p.name) * toCommercial(p.quantity, p.unit).qty), 3000)
    }));

  // Stats
  const { daysUntil: dUntil } = require('../utils/dates');
  const stats = {
    total: pantryItems.length,
    low: pantryItems.filter((p) => p.quantity > 0 && p.quantity <= p.threshold).length,
    out: pantryItems.filter((p) => p.quantity <= 0).length,
    expired: pantryItems.filter((p) => {
      const d = dUntil(p.expiryDate);
      return d !== null && d < 0;
    }).length,
    expiringSoon: pantryItems.filter((p) => {
      const d = dUntil(p.expiryDate);
      return d !== null && d >= 0 && d <= 7;
    }).length,
    estValue: pantryItems.reduce((s, p) => s + Math.min(Math.round(basePriceFor(p.key, p.name) * toCommercial(p.quantity, p.unit).qty), 3000), 0)
  };

  res.json({
    today,
    household: user.household,
    factor,
    meals,
    preMealAlert,
    useSoon,
    stats,
    budget: decorated.summary.budget,
    planKey: plan.weekKey
  });
}));

module.exports = router;
