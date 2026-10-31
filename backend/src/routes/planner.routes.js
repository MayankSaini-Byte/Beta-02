const express = require('express');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const { generateWeek, decoratePlan, computeDeductions, SLOTS } = require('../services/plannerService');
const { compareBasket } = require('../services/priceService');
const { logActivity } = require('../services/activityService');
const { todayISO } = require('../utils/dates');
const { toBase } = require('../utils/units');

const router = express.Router();
router.use(auth);

async function loadRecipes(db) {
  return db.col('recipes').find({});
}

async function loadCtx(db, user) {
  const pantryItems = await db.col('pantries').find({ ownerId: user._id });
  const recipes = await loadRecipes(db);
  return { pantryItems, recipes };
}

/**
 * Plan storage model: ONE plan per user (rolling week starting today).
 * getPlan returns the user's current plan; generate always plans from TODAY.
 */
async function getOrCreatePlan(db, user, force = false) {
  const plans = db.col('mealplans');
  let plan = await plans.findOne({ ownerId: user._id });
  if (!plan || force) {
    const { pantryItems, recipes } = await loadCtx(db, user);
    const generated = generateWeek({
      user, pantryItems, recipes, startISO: todayISO(), days: 7,
      existingPlan: force ? plan : null
    });
    if (plan) await plans.updateOne({ _id: plan._id }, generated);
    else plan = await plans.insertOne({ ownerId: user._id, ...generated });
  }
  return plan;
}

// GET /api/planner - the rolling week (auto-generates on first visit)
router.get('/', asyncH(async (req, res) => {
  const db = req.db;
  const user = await db.col('users').findOne({ _id: req.userId });
  if (!user) throw httpError(401, 'User not found');
  const plan = await getOrCreatePlan(db, user);
  const { pantryItems, recipes } = await loadCtx(db, user);
  res.json({ plan: decoratePlan(plan, user, pantryItems, recipes), household: user.household });
}));

// POST /api/planner/generate - re-optimize from today (locked slots survive)
router.post('/generate', asyncH(async (req, res) => {
  const db = req.db;
  const user = await db.col('users').findOne({ _id: req.userId });
  const plan = await getOrCreatePlan(db, user, true);
  const { pantryItems, recipes } = await loadCtx(db, user);
  await logActivity(db, user._id, { action: 'planned', target: 'This week', detail: 'Re-optimized the weekly plan', icon: 'calendar' });
  res.json({ plan: decoratePlan(plan, user, pantryItems, recipes) });
}));

// PUT /api/planner/slot { date, slot, key } - manual meal swap (key: null clears)
router.put('/slot', asyncH(async (req, res) => {
  const db = req.db;
  const { date, slot, key } = req.body || {};
  if (!date || !slot) throw httpError(400, 'date and slot are required');
  if (!SLOTS.includes(slot)) throw httpError(400, `slot must be one of ${SLOTS.join(', ')}`);
  const user = await db.col('users').findOne({ _id: req.userId });
  const plan = await getOrCreatePlan(db, user);

  if (key) {
    const recipe = await db.col('recipes').findOne({ key });
    if (!recipe) throw httpError(404, `Recipe not found: ${key}`);
  }

  const days = plan.days.map((d) => {
    if (d.date !== date) return d;
    const meals = { ...(d.meals || {}) };
    if (key) meals[slot] = { ...(meals[slot] || {}), key, locked: meals[slot] ? meals[slot].locked : false, done: false };
    else delete meals[slot];
    return { ...d, meals };
  });
  await db.col('mealplans').updateOne({ _id: plan._id }, { days });
  const updated = await db.col('mealplans').findOne({ _id: plan._id });
  const { pantryItems, recipes } = await loadCtx(db, user);
  if (key) await logActivity(db, user._id, { action: 'changed', target: `Meal on ${date}`, detail: `Swapped ${slot} to ${key}`, icon: 'swap' });
  res.json({ plan: decoratePlan(updated, user, pantryItems, recipes) });
}));

// POST /api/planner/lock { date, slot, locked } - pin a meal against re-optimize
router.post('/lock', asyncH(async (req, res) => {
  const db = req.db;
  const { date, slot, locked } = req.body || {};
  if (!date || !slot) throw httpError(400, 'date and slot are required');
  const user = await db.col('users').findOne({ _id: req.userId });
  const plan = await getOrCreatePlan(db, user);
  const days = plan.days.map((d) => {
    if (d.date !== date || !d.meals || !d.meals[slot]) return d;
    const meals = { ...d.meals, [slot]: { ...d.meals[slot], locked: !!locked } };
    return { ...d, meals };
  });
  await db.col('mealplans').updateOne({ _id: plan._id }, { days });
  const updated = await db.col('mealplans').findOne({ _id: plan._id });
  const { pantryItems, recipes } = await loadCtx(db, user);
  res.json({ plan: decoratePlan(updated, user, pantryItems, recipes), locked: !!locked });
}));

// POST /api/planner/copy-day { from, to } - copy all meal slots from one day to another
router.post('/copy-day', asyncH(async (req, res) => {
  const db = req.db;
  const { from, to } = req.body || {};
  if (!from || !to) throw httpError(400, 'from and to dates are required');
  const user = await db.col('users').findOne({ _id: req.userId });
  const plan = await getOrCreatePlan(db, user);
  const fromDay = plan.days.find((d) => d.date === from);
  if (!fromDay) throw httpError(404, `No planned day on ${from}`);
  const days = plan.days.map((d) => {
    if (d.date !== to) return d;
    const meals = {};
    for (const slot of SLOTS) {
      const src = fromDay.meals && fromDay.meals[slot];
      if (src && src.key) meals[slot] = { key: src.key, locked: false, done: false };
    }
    return { ...d, meals };
  });
  await db.col('mealplans').updateOne({ _id: plan._id }, { days });
  const updated = await db.col('mealplans').findOne({ _id: plan._id });
  const { pantryItems, recipes } = await loadCtx(db, user);
  await logActivity(db, user._id, { action: 'planned', target: `Day ${to}`, detail: `Copied meals from ${from}`, icon: 'copy' });
  res.json({ plan: decoratePlan(updated, user, pantryItems, recipes) });
}));

// POST /api/planner/mark-done { date, slot } - cook a meal -> deduct from stock.
// Idempotent: calling twice does nothing extra. Clamps to available stock and
// reports shortfalls + exactly what was deducted.
router.post('/mark-done', asyncH(async (req, res) => {
  const db = req.db;
  const { date, slot } = req.body || {};
  if (!date || !slot) throw httpError(400, 'date and slot are required');
  const user = await db.col('users').findOne({ _id: req.userId });
  const plan = await getOrCreatePlan(db, user);
  const dayIdx = plan.days.findIndex((d) => d.date === date);
  if (dayIdx < 0) throw httpError(404, `No planned day on ${date}`);
  const day = plan.days[dayIdx];
  const meal = day.meals && day.meals[slot];
  if (!meal || !meal.key) throw httpError(404, `No ${slot} planned on ${date}`);

  if (meal.done) {
    return res.json({ alreadyDone: true, deductions: meal.deductions || [], shortfall: meal.shortfall || [], message: 'Already marked done - nothing deducted twice.' });
  }

  const recipe = await db.col('recipes').findOne({ key: meal.key });
  if (!recipe) throw httpError(404, `Recipe not found: ${meal.key}`);

  const pantryItems = await db.col('pantries').find({ ownerId: user._id });
  const factor = Math.max(0.5, (user.household.adults || 1) + (user.household.children || 0) * 0.5);
  const { deductions, shortfall } = computeDeductions(recipe, factor, pantryItems);

  const pantries = db.col('pantries');
  const auditlogs = db.col('auditlogs');
  const itemById = new Map(pantryItems.map((p) => [p._id, p]));

  for (const d of deductions) {
    const item = [...itemById.values()].find((p) => p.key === d.key) || null;
    if (!item) continue;
    const next = Math.max(0, item.quantity - d.take);
    await pantries.updateOne({ _id: item._id }, { quantity: next, updatedAt: new Date().toISOString() });
    await auditlogs.insertOne({
      ownerId: user._id, itemId: item._id, name: item.name,
      before: item.quantity, after: next, delta: -(item.quantity - next), unit: item.unit,
      reason: `Cooked ${recipe.name}`, type: 'meal', at: new Date().toISOString()
    });
  }

  const days = plan.days.map((d, i) => {
    if (i !== dayIdx) return d;
    const meals = { ...d.meals, [slot]: { ...meal, done: true, doneAt: new Date().toISOString(), deductions, shortfall } };
    return { ...d, meals };
  });
  await db.col('mealplans').updateOne({ _id: plan._id }, { days });

  await logActivity(db, user._id, {
    action: 'used', target: recipe.name,
    detail: deductions.length
      ? `Deducted ${deductions.map((d) => d.display + ' ' + d.name).slice(0, 4).join(', ')}${deductions.length > 4 ? ` +${deductions.length - 4} more` : ''}`
      : 'Nothing in stock to deduct',
    icon: 'cooking'
  });

  const updated = await db.col('mealplans').findOne({ _id: plan._id });
  const { recipes } = await loadCtx(db, user);
  const pantryAfter = await db.col('pantries').find({ ownerId: user._id });
  res.json({
    alreadyDone: false,
    deductions,
    shortfall,
    message: shortfall.length
      ? `${recipe.name} marked done. Short: ${shortfall.map((s) => s.name).join(', ')} - deducted what was available.`
      : `${recipe.name} marked done. ${deductions.length} ingredient(s) deducted.`,
    plan: decoratePlan(updated, user, pantryAfter, recipes)
  });
}));

// POST /api/planner/unmark { date, slot } - UNDO: put deducted ingredients back
router.post('/unmark', asyncH(async (req, res) => {
  const db = req.db;
  const { date, slot } = req.body || {};
  if (!date || !slot) throw httpError(400, 'date and slot are required');
  const user = await db.col('users').findOne({ _id: req.userId });
  const plan = await getOrCreatePlan(db, user);
  const day = plan.days.find((d) => d.date === date);
  const meal = day && day.meals && day.meals[slot];
  if (!meal || !meal.done) throw httpError(400, 'That meal is not marked done - nothing to undo.');

  const pantries = db.col('pantries');
  const auditlogs = db.col('auditlogs');
  const pantryItems = await pantries.find({ ownerId: user._id });
  const itemByKey = new Map(pantryItems.filter((p) => p.key).map((p) => [p.key, p]));

  for (const d of meal.deductions || []) {
    const item = itemByKey.get(d.key);
    if (!item) continue;
    const next = item.quantity + d.take;
    await pantries.updateOne({ _id: item._id }, { quantity: next, updatedAt: new Date().toISOString() });
    await auditlogs.insertOne({
      ownerId: user._id, itemId: item._id, name: item.name,
      before: item.quantity, after: next, delta: d.take, unit: item.unit,
      reason: `Undo: ${meal.key} unmarked`, type: 'undo', at: new Date().toISOString()
    });
  }

  const days = plan.days.map((d) => {
    if (d.date !== date) return d;
    const meals = { ...d.meals, [slot]: { key: meal.key, locked: !!meal.locked, done: false, doneAt: null, deductions: [], shortfall: [] } };
    return { ...d, meals };
  });
  await db.col('mealplans').updateOne({ _id: plan._id }, { days });
  await logActivity(db, user._id, { action: 'changed', target: `Meal on ${date}`, detail: 'Undo - stock restored', icon: 'undo' });

  const updated = await db.col('mealplans').findOne({ _id: plan._id });
  const { recipes } = await loadCtx(db, user);
  const pantryAfter = await pantries.find({ ownerId: user._id });
  res.json({ ok: true, restored: (meal.deductions || []).length, plan: decoratePlan(updated, user, pantryAfter, recipes) });
}));

// POST /api/planner/sync-shopping - push plan shortages into the shopping list
router.post('/sync-shopping', asyncH(async (req, res) => {
  const db = req.db;
  const user = await db.col('users').findOne({ _id: req.userId });
  const plan = await getOrCreatePlan(db, user);
  const { pantryItems, recipes } = await loadCtx(db, user);
  const decorated = decoratePlan(plan, user, pantryItems, recipes);
  const needs = decorated.summary.needs;

  const lists = db.col('shoppinglists');
  let doc = await lists.findOne({ ownerId: user._id });
  if (!doc) doc = await lists.insertOne({ ownerId: user._id, items: [] });

  const items = [...(doc.items || [])];
  let added = 0;
  let merged = 0;
  for (const n of needs) {
    const existing = items.find((i) => i.key && i.key === n.key && i.source === 'plan');
    if (existing) {
      existing.toBuy = Math.max(existing.toBuy || 0, n.toBuy);
      existing.qty = n.have;
      existing.unit = n.unit;
      existing.buyDisplay = n.buyDisplay;
      existing.estCost = n.estCost;
      merged++;
    } else {
      items.push({
        id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${n.key}`,
        key: n.key,
        name: n.name,
        qty: n.have,
        unit: n.unit,
        toBuy: n.toBuy,
        buyDisplay: n.buyDisplay,
        estCost: n.estCost,
        source: 'plan',
        done: false,
        addedAt: new Date().toISOString()
      });
      added++;
    }
  }
  await lists.updateOne({ _id: doc._id }, { items });
  await logActivity(db, user._id, { action: 'changed', target: 'Shopping list', detail: `Synced ${added} plan shortage(s) into the list`, icon: 'cart' });
  res.json({ added, merged, total: needs.length, message: `Shopping list updated from the plan: ${added} added, ${merged} updated.` });
}));

// POST /api/planner/order - build best-price cart for the week's missing items
router.post('/order', asyncH(async (req, res) => {
  const db = req.db;
  const user = await db.col('users').findOne({ _id: req.userId });
  const plan = await getOrCreatePlan(db, user);
  const { pantryItems, recipes } = await loadCtx(db, user);
  const decorated = decoratePlan(plan, user, pantryItems, recipes);

  const items = decorated.summary.needs.map((n) => ({ key: n.key, name: n.name, qty: n.toBuy, unit: n.unit }));
  if (!items.length) {
    return res.json({ cart: null, message: 'Your pantry already covers the whole weekly plan. Nothing to order.' });
  }

  const comparison = compareBasket(items);
  const best = comparison.bestProvider;
  const quotesByProvider = {};
  for (const it of comparison.perItem) {
    for (const q of it.quotes) {
      if (!quotesByProvider[q.providerId]) quotesByProvider[q.providerId] = { name: q.providerName, items: [] };
      if (q.inStock) quotesByProvider[q.providerId].items.push({ key: it.key, name: it.name, qty: it.commercial.qty, unit: it.commercial.unit, price: q.lineTotal });
    }
  }

  const chosen = quotesByProvider[best.id];
  const basket = comparison.baskets.find((b) => b.providerId === best.id);
  const carts = db.col('carts');
  const cartDoc = {
    ownerId: user._id,
    providerId: best.id,
    providerName: best.name,
    items: chosen.items,
    subtotal: basket.subtotal,
    fee: basket.fee,
    total: basket.total,
    savings: comparison.savings,
    etaMin: best.etaMin,
    status: 'active',
    orderId: null,
    createdAt: new Date().toISOString()
  };
  await carts.deleteMany({ ownerId: user._id, status: 'active' });
  const cart = await carts.insertOne(cartDoc);
  res.json({ cart, comparison, message: `Cart built for ${best.name} at the best total price.` });
}));

module.exports = router;
