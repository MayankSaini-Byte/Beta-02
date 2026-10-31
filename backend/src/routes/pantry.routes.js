const express = require('express');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const { resolveCatalog, norm } = require('../utils/text');
const { daysUntil, todayISO, addDaysISO } = require('../utils/dates');
const { smartQty } = require('../utils/units');
const { basePriceFor } = require('../services/priceService');
const { toCommercial } = require('../utils/units');
const { logActivity } = require('../services/activityService');

const router = express.Router();
router.use(auth);

const EXPIRY_WARN_DAYS = 7; // barcode/hardware reminder window: notify 1 week before expiry

function enrich(p) {
  const d = daysUntil(p.expiryDate);
  const state = p.quantity <= 0 ? 'out' : p.quantity <= p.threshold ? 'low' : 'ok';
  const expiryState = d === null ? 'none' : d < 0 ? 'expired' : d <= EXPIRY_WARN_DAYS ? 'soon' : 'ok';
  return {
    ...p,
    state,
    daysToExpiry: d,
    expiryState,
    remindOn: p.expiryDate ? addDaysISO(p.expiryDate, -EXPIRY_WARN_DAYS) : null,
    qtyDisplay: smartQty(p.quantity, p.unit),
    thresholdDisplay: smartQty(p.threshold, p.unit),
    estValue: Math.min(Math.round(basePriceFor(p.key, p.name) * toCommercial(p.quantity, p.unit).qty), 3000)
  };
}

async function getUser(req) {
  const user = await req.db.col('users').findOne({ _id: req.userId });
  if (!user) throw httpError(401, 'User not found');
  return user;
}

// GET /api/pantry - full stock with live status + alerts
router.get('/', asyncH(async (req, res) => {
  const items = (await req.db.col('pantries').find({ ownerId: req.userId }, { sort: { name: 1 } })).map(enrich);
  const alerts = {
    out: items.filter((i) => i.state === 'out'),
    low: items.filter((i) => i.state === 'low'),
    expiringSoon: items.filter((i) => i.expiryState === 'soon'),
    expired: items.filter((i) => i.expiryState === 'expired')
  };
  res.json({
    items,
    alerts,
    stats: {
      total: items.length,
      out: alerts.out.length,
      low: alerts.low.length,
      expiringSoon: alerts.expiringSoon.length,
      expired: alerts.expired.length,
      estValue: items.reduce((s, i) => s + i.estValue, 0)
    }
  });
}));

// POST /api/pantry - add or restock (mode: 'add' | 'set')
router.post('/', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.name) throw httpError(400, 'Item name is required');
  const cat = resolveCatalog(b.name);
  const pantries = req.db.col('pantries');
  const nameKey = cat ? cat.key : null;
  const searchName = norm(b.name);

  const existing = (await pantries.find({ ownerId: req.userId })).find(
    (p) => (p.key && p.key === nameKey) || norm(p.name) === searchName
  );

  const quantity = Math.max(0, Number(b.quantity) || 0);
  const unit = b.unit || (cat ? cat.unit : 'g');
  const threshold = b.threshold != null ? Math.max(0, Number(b.threshold)) : existing ? existing.threshold : Math.max(1, Math.round(quantity * 0.25));
  const expiryDate = b.expiryDate || (cat ? addDaysISO(todayISO(), cat.shelfLifeDays) : addDaysISO(todayISO(), 7));

  if (existing) {
    const mode = b.mode === 'set' ? 'set' : 'add';
    const nextQty = mode === 'add' ? existing.quantity + quantity : quantity;
    const updated = await pantries.updateOne(
      { _id: existing._id },
      { quantity: nextQty, unit, threshold, expiryDate, capacity: Math.max(existing.capacity, Math.ceil(nextQty * 1.25), threshold * 3), category: b.category || existing.category, key: nameKey || existing.key, updatedAt: new Date().toISOString() }
    );
    return res.json({ item: enrich(updated), merged: true });
  }

  const catInfo = cat ? { key: cat.key, category: cat.category } : { key: null, category: b.category || 'other' };
  const created = await pantries.insertOne({
    ownerId: req.userId,
    ...catInfo,
    name: cat ? cat.name : String(b.name).trim(),
    quantity,
    unit,
    threshold,
    capacity: Math.max(Math.ceil(quantity * 1.25), threshold * 3, threshold + 1),
    expiryDate,
    addedBy: (req.body || {}).addedBy || 'Owner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  await logActivity(req.db, req.userId, { actor: (req.body || {}).addedBy || 'Owner', action: 'added', target: created.name, detail: `${smartQty(quantity, unit)} added to stock`, icon: 'plus' });
  res.status(201).json({ item: enrich(created), merged: false });
}));

// PATCH /api/pantry/:id
router.patch('/:id', asyncH(async (req, res) => {
  const patch = { updatedAt: new Date().toISOString() };
  const b = req.body || {};
  for (const f of ['name', 'category', 'unit', 'expiryDate']) if (b[f] !== undefined) patch[f] = b[f];
  if (b.quantity !== undefined) patch.quantity = Math.max(0, Number(b.quantity) || 0);
  if (b.threshold !== undefined) patch.threshold = Math.max(0, Number(b.threshold) || 0);
  const updated = await req.db.col('pantries').updateOne({ _id: req.params.id, ownerId: req.userId }, patch);
  if (!updated) throw httpError(404, 'Item not found');
  res.json({ item: enrich(updated) });
}));

// DELETE /api/pantry/:id
router.delete('/:id', asyncH(async (req, res) => {
  const item = await req.db.col('pantries').findOne({ _id: req.params.id, ownerId: req.userId });
  await req.db.col('pantries').deleteOne({ _id: req.params.id, ownerId: req.userId });
  if (item) await logActivity(req.db, req.userId, { action: 'removed', target: item.name, detail: 'Deleted from stock', icon: 'trash' });
  res.json({ ok: true });
}));

// POST /api/pantry/:id/adjust - quick +/- with audit trail (stock accuracy)
router.post('/:id/adjust', asyncH(async (req, res) => {
  const pantries = req.db.col('pantries');
  const item = await pantries.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!item) throw httpError(404, 'Item not found');
  const delta = Number((req.body || {}).delta) || 0;
  const reason = (req.body || {}).reason || 'manual update';
  const next = Math.max(0, item.quantity + delta);
  const updated = await pantries.updateOne({ _id: item._id }, { quantity: next, updatedAt: new Date().toISOString() });
  await req.db.col('auditlogs').insertOne({
    ownerId: req.userId, itemId: item._id, name: item.name,
    before: item.quantity, after: next, delta: next - item.quantity, unit: item.unit,
    reason, type: 'adjust', at: new Date().toISOString()
  });
  res.json({ item: enrich(updated) });
}));

// POST /api/pantry/reconcile - physical count vs recorded (stock accuracy feature)
router.post('/reconcile', asyncH(async (req, res) => {
  const counts = (req.body || {}).counts || [];
  const pantries = req.db.col('pantries');
  const auditlogs = req.db.col('auditlogs');
  const users = req.db.col('users');
  const user = await getUser(req);

  let diffSum = 0;
  let totalSum = 0;
  const changes = [];
  for (const c of counts) {
    const item = await pantries.findOne({ _id: c.id, ownerId: req.userId });
    if (!item) continue;
    const physical = Math.max(0, Number(c.physical) || 0);
    if (physical === item.quantity) continue;
    diffSum += Math.abs(physical - item.quantity);
    totalSum += Math.max(item.quantity, physical, 1);
    await pantries.updateOne({ _id: item._id }, { quantity: physical, updatedAt: new Date().toISOString() });
    await auditlogs.insertOne({
      ownerId: req.userId, itemId: item._id, name: item.name,
      before: item.quantity, after: physical, delta: physical - item.quantity, unit: item.unit,
      reason: 'physical reconciliation', type: 'reconcile', at: new Date().toISOString()
    });
    changes.push({ name: item.name, before: item.quantity, after: physical });
  }

  const accuracy = totalSum === 0 ? 100 : Math.max(0, Math.round((1 - diffSum / totalSum) * 1000) / 10);
  const at = new Date().toISOString();
  await users.updateOne({ _id: user._id }, { lastReconcile: { at, accuracy } });
  await req.db.col('reconciliations').insertOne({
    ownerId: req.userId,
    at,
    accuracy,
    checked: counts.length,
    changes: changes.map((c) => ({ ...c, gap: c.after - c.before }))
  });
  if (changes.length) {
    await logActivity(req.db, req.userId, { action: 'reconciled', target: 'Physical stock', detail: `${counts.length} item(s) counted - ${changes.length} correction(s), accuracy ${accuracy}%`, icon: 'scale' });
  }
  res.json({ accuracy, changes, at });
}));

// GET /api/pantry/catalog - catalog for autocomplete (name, unit, category, default pack)
router.get('/catalog', asyncH(async (req, res) => {
  const CATALOG = require('../data/catalog');
  res.json({
    catalog: CATALOG.map((c) => ({ key: c.key, name: c.name, unit: c.unit, category: c.category, price: c.price }))
  });
}));

// GET /api/pantry/export - CSV export
router.get('/export', asyncH(async (req, res) => {
  const items = (await req.db.col('pantries').find({ ownerId: req.userId }, { sort: { name: 1 } })).map(enrich);
  const rows = [
    ['Name', 'Category', 'Quantity', 'Unit', 'Threshold', 'Expiry', 'Status', 'EstValue(INR)'],
    ...items.map((i) => [i.name, i.category, i.quantity, i.unit, i.threshold, i.expiryDate || '', i.state, i.estValue])
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kitchensync-inventory.csv"');
  res.send(csv);
}));

module.exports = router;
