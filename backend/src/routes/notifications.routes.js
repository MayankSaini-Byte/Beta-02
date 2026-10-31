const express = require('express');
const auth = require('../middleware/auth');
const { asyncH } = require('../middleware/errors');
const { daysUntil } = require('../utils/dates');
const { decoratePlan } = require('../services/plannerService');
const { getOrCreatePlan } = require('../services/mealPlanStore');

const router = express.Router();
router.use(auth);

/** GET /api/notifications - smart reminder center */
router.get('/', asyncH(async (req, res) => {
  const db = req.db;
  const user = await db.col('users').findOne({ _id: req.userId });
  if (!user) return res.json({ notifications: [], unread: 0 });

  const items = (await db.col('pantries').find({ ownerId: req.userId })).map((p) => ({ ...p, daysToExpiry: daysUntil(p.expiryDate) }));
  const out = [];

  for (const p of items) {
    if (p.quantity <= 0) {
      out.push({ id: `out-${p._id}`, type: 'stock', severity: 'danger', title: `Out of stock: ${p.name}`, message: 'Auto-added to your shopping list with best-price comparison.', when: p.updatedAt });
    } else if (p.quantity <= p.threshold) {
      out.push({ id: `low-${p._id}`, type: 'stock', severity: 'warning', title: `Running low: ${p.name}`, message: `Only ${p.quantity} ${p.unit} left (threshold ${p.threshold}). Consider restocking.`, when: p.updatedAt });
    }
    if (p.daysToExpiry !== null && p.daysToExpiry < 0) {
      out.push({ id: `exp-${p._id}`, type: 'expiry', severity: 'danger', title: `${p.name} has expired`, message: 'Remove it or mark as used to keep stock accuracy high.', when: p.updatedAt });
    } else if (p.daysToExpiry !== null && p.daysToExpiry <= 7) {
      out.push({ id: `exp-${p._id}`, type: 'expiry', severity: p.daysToExpiry <= 3 ? 'warning' : 'info', title: `${p.name} expires in ${p.daysToExpiry} day(s)`, message: 'Use it in a meal this week - the planner already prefers it.', when: p.updatedAt });
    }
  }

  // Pre-meal alert with actual ingredient names: "Dinner: missing paneer"
  try {
    const plan = await getOrCreatePlan(db, user);
    const pantryItems = await db.col('pantries').find({ ownerId: user._id });
    const recipes = await db.col('recipes').find({});
    const decorated = decoratePlan(plan, user, pantryItems, recipes);
    const today = new Date().toISOString().slice(0, 10);
    const todayPlan = decorated.days.find((d) => d.date === today);
    if (todayPlan) {
      for (const slot of ['breakfast', 'lunch', 'dinner']) {
        const m = todayPlan.meals[slot];
        if (m && !m.done && m.missing && m.missing.length) {
          const names = m.missing.map((x) => x.name).slice(0, 3).join(', ');
          out.push({
            id: `premeal-${today}-${slot}`,
            type: 'planner',
            severity: 'warning',
            title: `${slot[0].toUpperCase() + slot.slice(1)}: missing ${names}${m.missing.length > 3 ? ` +${m.missing.length - 3} more` : ''}`,
            message: `${m.name} needs ${m.missing.length} item(s). Sync the plan into your shopping list or order the missing items.`,
            when: plan.generatedAt || new Date().toISOString()
          });
          break; // alert for the earliest upcoming meal only
        }
      }
    }
  } catch { /* planner hint is best-effort */ }

  // Budget hint (based on active cart)
  const cart = await db.col('carts').findOne({ ownerId: user._id, status: 'active' });
  const budget = (user.household && user.household.weeklyBudget) || 1500;
  if (cart && cart.total > budget * 0.6) {
    out.push({ id: 'budget-cart', type: 'budget', severity: 'info', title: `Cart is ${Math.round((cart.total / budget) * 100)}% of weekly budget`, message: `Rs ${cart.total} of Rs ${budget} in your ${cart.providerName} cart.`, when: cart.createdAt });
  }

  const rank = { danger: 0, warning: 1, info: 2 };
  out.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const readAt = user.notificationsReadAt ? new Date(user.notificationsReadAt).getTime() : 0;
  const unread = out.filter((n) => new Date(n.when || 0).getTime() > readAt).length;

  res.json({ notifications: out, unread });
}));

// POST /api/notifications/read-all
router.post('/read-all', asyncH(async (req, res) => {
  await req.db.col('users').updateOne({ _id: req.userId }, { notificationsReadAt: new Date().toISOString() });
  res.json({ ok: true });
}));

module.exports = router;
