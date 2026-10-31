/**
 * Load-cell weighing station (real hardware endpoint - see hardware/esp32_scale).
 *
 *   ESP32 ──POST /api/scale/reading (x-device-key)──▶ this server keeps `latest`
 *   Browser polls GET /api/scale/latest ──▶ live weight, Stable ✅ / Settling…
 *   Browser POST /api/scale/stock/:id/weigh ──▶ server applies ITS OWN latest
 *   reading to stock (never a number the browser sent - can't be faked or stale).
 */
const express = require('express');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const env = require('../config/env');
const iot = require('../services/iotService');
const { toBase, smartQty } = require('../utils/units');
const { logActivity } = require('../services/activityService');

const router = express.Router();

const FRESH_MS = 3000;      // reading must be younger than this for a weigh-in
const ONLINE_MS = 5000;     // "online" badge window

async function getLatest(db) {
  let s = await db.col('scalestate').findOne({});
  if (!s) s = await db.col('scalestate').insertOne({ _id: 'scale1', grams: 0, stable: false, ts: 0, readings: 0, rejected: 0 });
  return s;
}

async function saveLatest(db, patch) {
  const cur = await getLatest(db);
  const next = { ...cur, ...patch, _id: cur._id || 'scale1' };
  const exists = await db.col('scalestate').findOne({});
  if (exists) return db.col('scalestate').updateOne({}, next);
  return db.col('scalestate').insertOne(next);
}

/* ---------- device -> server (no JWT; shared device key instead) ---------- */

// POST /api/scale/reading  { device_id, grams, stable }  header: x-device-key
router.post('/reading', asyncH(async (req, res) => {
  const key = req.headers['x-device-key'];
  if (!key || key !== env.DEVICE_KEY) return res.status(401).json({ error: 'Invalid device key' });

  const b = req.body || {};
  const grams = Number(b.grams);
  if (!Number.isFinite(grams) || !iot.isPlausible(grams)) {
    const s = await getLatest(req.db);
    await saveLatest(req.db, { rejected: (s.rejected || 0) + 1 });
    return res.status(422).json({ error: 'Implausible reading rejected' });
  }
  const stable = !!(b.stable ?? b.isStable);
  const deviceId = String(b.device_id || b.deviceId || 'scale1');

  await saveLatest(req.db, { grams: Math.round(grams * 10) / 10, stable, ts: Date.now(), readings: ((await getLatest(req.db)).readings || 0) + 1 });

  // If a paired IoT container shares this id, feed its history too (real hardware path)
  try {
    const dev = await req.db.col('devices').findOne({ _id: deviceId });
    if (dev) {
      await req.db.col('devicereadings').insertOne({ ownerId: dev.ownerId, deviceId: dev._id, grams, at: new Date().toISOString() });
      await req.db.col('devices').updateOne({ _id: dev._id }, { lastSeen: new Date().toISOString() });
    }
  } catch { /* device feed is best-effort */ }

  res.status(204).end();
}));

/* ---------- browser -> server ---------- */

// GET /api/scale/latest - live weight for the UI (poll every ~800 ms)
router.get('/latest', auth, asyncH(async (req, res) => {
  const s = await getLatest(req.db);
  const age = s.ts ? Date.now() - s.ts : Infinity;
  res.json({
    grams: s.ts ? s.grams : null,
    stable: !!s.stable,
    ts: s.ts || null,
    ageMs: isFinite(age) ? age : null,
    online: age < ONLINE_MS,
    readings: s.readings || 0,
    rejected: s.rejected || 0
  });
}));

// POST /api/scale/simulate - venue-Wi-Fi fallback: fabricate a fresh stable
// reading SERVER-SIDE so the demo survives missing hardware.
router.post('/simulate', auth, asyncH(async (req, res) => {
  const b = req.body || {};
  let grams = Number(b.grams);
  if (!Number.isFinite(grams) && b.itemId) {
    const item = await req.db.col('pantries').findOne({ _id: b.itemId, ownerId: req.userId });
    if (item) grams = item.quantity + (Number(b.containerWeight) || 0);
  }
  if (!Number.isFinite(grams)) grams = 1240 + Math.round(Math.random() * 40);
  const state = await saveLatest(req.db, { grams: Math.round(grams * 10) / 10, stable: true, ts: Date.now(), readings: ((await getLatest(req.db)).readings || 0) + 1 });
  await logActivity(req.db, req.userId, { action: 'changed', target: 'Weighing station', detail: `Simulated a stable sensor reading (${Math.round(grams)} g)`, icon: 'scale' });
  res.json({ ok: true, state, message: `Simulated a stable reading of ${Math.round(grams)} g.` });
}));

// POST /api/scale/stock/:id/weigh { mode: 'set'|'add', containerWeight } - weigh into stock
router.post('/stock/:id/weigh', auth, asyncH(async (req, res) => {
  const db = req.db;
  const b = req.body || {};
  const mode = b.mode === 'add' ? 'add' : 'set';

  const s = await getLatest(db);
  if (!s.ts || Date.now() - s.ts > FRESH_MS) throw httpError(409, 'Scale offline - no fresh reading. Check the ESP32 (or press Simulate sensor).');
  if (!s.stable) throw httpError(409, 'Weight not stable yet - wait for the Stable ✅ badge.');

  const item = await db.col('pantries').findOne({ _id: req.params.id, ownerId: req.userId });
  if (!item) throw httpError(404, 'Stock item not found');

  const containerWeight = Number(b.containerWeight) || 0;
  const net = Math.round((s.grams - containerWeight) * 10) / 10;
  if (net < 0) throw httpError(400, 'Reading below container weight - check the tare value.');

  const before = item.quantity;
  const after = mode === 'set' ? net : Math.max(0, before + net);
  const updated = await db.col('pantries').updateOne({ _id: item._id }, { quantity: after, updatedAt: new Date().toISOString() });

  await db.col('auditlogs').insertOne({
    ownerId: req.userId, itemId: item._id, name: item.name,
    before, after, delta: after - before, unit: item.unit,
    reason: `Weigh-in (${mode === 'set' ? 'set total' : 'added'}) - scale read ${s.grams} g, container ${containerWeight} g`,
    type: 'sensor', at: new Date().toISOString()
  });
  await logActivity(db, req.userId, { action: 'changed', target: item.name, detail: `Weighed on the load cell: ${smartQty(after, item.unit)} (${mode === 'set' ? 'set from scale' : `+${smartQty(net, item.unit)}`})`, icon: 'scale' });

  res.json({
    ok: true,
    item: updated,
    applied: { mode, netGrams: net, scaleGrams: s.grams, containerWeight },
    message: `${item.name}: ${smartQty(after, item.unit)} (${mode === 'set' ? 'set from scale' : `+${smartQty(net, item.unit)}`}).`
  });
}));

// GET /api/scale/reweigh/:itemId - post-cook check: expected (app) vs measured (scale)
router.get('/reweigh/:itemId', auth, asyncH(async (req, res) => {
  const db = req.db;
  const item = await db.col('pantries').findOne({ _id: req.params.itemId, ownerId: req.userId });
  if (!item) throw httpError(404, 'Stock item not found');
  const s = await getLatest(db);
  const online = !!s.ts && Date.now() - s.ts < ONLINE_MS;
  const lastDeduction = await db.col('auditlogs').findOne({ ownerId: req.userId, itemId: item._id, type: 'meal' }, { sort: { at: -1 } });
  res.json({
    itemId: item._id,
    name: item.name,
    unit: item.unit,
    appGrams: item.quantity,
    scaleGrams: online ? s.grams : null,
    online,
    diffGrams: online ? Math.round(s.grams - item.quantity) : null,
    lastDeduction: lastDeduction ? { delta: lastDeduction.delta, unit: lastDeduction.unit, at: lastDeduction.at, reason: lastDeduction.reason } : null
  });
}));

module.exports = router;
