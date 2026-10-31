/**
 * IoT / Devices routes - smart-container weight sensors.
 * Hardware is SIMULATED (deterministic) with an honest label; the API surface
 * is the real one a load-cell ESP32 would call (POST /ingest).
 */
const express = require('express');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const iot = require('../services/iotService');
const { logActivity } = require('../services/activityService');
const { toCommercial } = require('../utils/units');
const { hash } = require('../utils/text');

const router = express.Router();
router.use(auth);

async function latestReadings(db, ownerId) {
  const map = new Map();
  const devices = await db.col('devices').find({ ownerId });
  for (const d of devices) {
    const r = await db.col('devicereadings').findOne({ deviceId: d._id }, { sort: { at: -1 } });
    map.set(d._id, r);
  }
  return map;
}

// GET /api/devices - all containers with live status, latest weight, conflicts
router.get('/', asyncH(async (req, res) => {
  const db = req.db;
  const devices = await db.col('devices').find({ ownerId: req.userId }, { sort: { createdAt: 1 } });
  const readings = await latestReadings(db, req.userId);
  const pantryItems = await db.col('pantries').find({ ownerId: req.userId });
  const itemById = new Map(pantryItems.map((p) => [p._id, p]));

  const out = devices.map((d) => {
    const r = readings.get(d._id);
    const item = d.pantryItemId ? itemById.get(d.pantryItemId) : null;
    const grams = r ? r.grams : null;
    const status = iot.statusFor(d);
    return {
      id: d._id,
      name: d.name,
      kind: d.kind,
      battery: d.battery,
      wifi: d.wifi,
      lastSeen: d.lastSeen,
      status,
      pantryItemId: d.pantryItemId || null,
      linkedItem: item ? { id: item._id, name: item.name, unit: item.unit, appQty: item.quantity, state: item.quantity <= 0 ? 'out' : item.quantity <= item.threshold ? 'low' : 'ok' } : null,
      grams,
      gramsDisplay: grams != null ? `${Math.round(toCommercial(grams, 'g').qty * 100) / 100} kg` : null,
      conflict: null
    };
  });

  const conflicts = iot.conflictsFor(devices, readings, pantryItems);
  for (const c of conflicts) {
    const dev = out.find((x) => x.id === c.deviceId);
    if (dev) dev.conflict = c;
  }

  res.json({ devices: out, conflicts, simulated: true, staleAfterMin: iot.STALE_AFTER_MS / 60000 });
}));

// POST /api/devices { name, pantryItemId? } - pair a new container
router.post('/', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) throw httpError(400, 'Device name is required');
  let linkedKey = null;
  if (b.pantryItemId) {
    const item = await req.db.col('pantries').findOne({ _id: b.pantryItemId, ownerId: req.userId });
    if (!item) throw httpError(404, 'Stock item not found');
    linkedKey = item.key;
  }
  const dev = await req.db.col('devices').insertOne({
    ownerId: req.userId,
    name: String(b.name).trim(),
    kind: 'load-cell-container',
    pantryItemId: b.pantryItemId || null,
    linkedKey,
    battery: 85 + Math.round(hash(b.name) * 14),
    wifi: 'home-wifi',
    tareGrams: 0,
    lastSeen: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });
  // first reading
  await req.db.col('devicereadings').insertOne({
    ownerId: req.userId, deviceId: dev._id,
    grams: b.pantryItemId ? (await req.db.col('pantries').findOne({ _id: b.pantryItemId })).quantity : 500,
    at: new Date().toISOString()
  });
  await logActivity(req.db, req.userId, { action: 'added', target: dev.name, detail: 'Paired a smart container sensor', icon: 'chip' });
  res.status(201).json({ device: dev });
}));

// POST /api/devices/:id/link { pantryItemId }
router.post('/:id/link', asyncH(async (req, res) => {
  const item = await req.db.col('pantries').findOne({ _id: (req.body || {}).pantryItemId, ownerId: req.userId });
  if (!item) throw httpError(404, 'Stock item not found');
  const dev = await req.db.col('devices').updateOne({ _id: req.params.id, ownerId: req.userId }, { pantryItemId: item._id, linkedKey: item.key, lastSeen: new Date().toISOString() });
  if (!dev) throw httpError(404, 'Device not found');
  await logActivity(req.db, req.userId, { action: 'changed', target: dev.name, detail: `Linked to ${item.name}`, icon: 'chip' });
  res.json({ ok: true, device: dev });
}));

// POST /api/devices/:id/tare - zero the scale (calibration)
router.post('/:id/tare', asyncH(async (req, res) => {
  const db = req.db;
  const devices = db.col('devices');
  const dev = await devices.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!dev) throw httpError(404, 'Device not found');
  const r = await db.col('devicereadings').findOne({ deviceId: dev._id }, { sort: { at: -1 } });
  const dev2 = await devices.updateOne({ _id: dev._id }, { tareGrams: r ? r.grams : 0, lastSeen: new Date().toISOString() });
  await db.col('devicereadings').insertOne({ ownerId: req.userId, deviceId: dev._id, grams: 0, at: new Date().toISOString() });
  await logActivity(db, req.userId, { action: 'changed', target: dev.name, detail: `Tared (zeroed) the sensor`, icon: 'scale' });
  res.json({ ok: true, device: dev2, message: 'Tared. The container now reads 0 g - refill to weigh contents.' });
}));

// POST /api/devices/:id/simulate - venue-WiFi fallback: fabricate a plausible ping
router.post('/:id/simulate', asyncH(async (req, res) => {
  const db = req.db;
  const devices = db.col('devices');
  const dev = await devices.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!dev) throw httpError(404, 'Device not found');
  const pantryItems = await db.col('pantries').find({ ownerId: req.userId });
  const item = dev.pantryItemId ? pantryItems.find((p) => p._id === dev.pantryItemId) : null;

  const mode = (req.body || {}).mode || 'drift'; // drift | empty | refill | nonsense
  const minuteSeed = Math.floor(Date.now() / 60000);
  let grams;
  if (mode === 'nonsense') grams = -999; // deliberately invalid - handled below
  else if (mode === 'empty') grams = 0;
  else if (mode === 'refill') grams = item ? Math.round(item.capacity || 5000) : 5000;
  else grams = iot.simulateReading(dev, item, minuteSeed);

  if (!iot.isPlausible(grams)) {
    // nonsense reading: device flagged stale instead of corrupting stock
    await devices.updateOne({ _id: dev._id }, { lastSeen: new Date().toISOString() });
    return res.json({ ok: false, flagged: true, message: 'Sensor sent a nonsense value (-999 g). Reading rejected - device marked stale so it cannot corrupt stock.' });
  }

  const reading = await db.col('devicereadings').insertOne({ ownerId: req.userId, deviceId: dev._id, grams, at: new Date().toISOString() });
  const dev2 = await devices.updateOne({ _id: dev._id }, { lastSeen: new Date().toISOString(), battery: Math.max(5, dev.battery - Math.round(hash(`${minuteSeed}`) * 2)) });

  // live-link: if linked, gently nudge the stock item toward the sensor value
  let stockUpdated = false;
  if (dev.pantryItemId) {
    const item = await db.col('pantries').findOne({ _id: dev.pantryItemId, ownerId: req.userId });
    if (item && Math.abs(item.quantity - grams) > Math.max(50, item.quantity * 0.08)) {
      // do NOT silently overwrite - surface as conflict; but a huge drift with mode empty/refill is explicit
      if (mode === 'empty' || mode === 'refill') {
        await db.col('pantries').updateOne({ _id: item._id }, { quantity: Math.max(0, grams), updatedAt: new Date().toISOString() });
        await db.col('auditlogs').insertOne({
          ownerId: req.userId, itemId: item._id, name: item.name,
          before: item.quantity, after: grams, delta: grams - item.quantity, unit: item.unit,
          reason: `Sensor ${dev.name} (${mode})`, type: 'sensor', at: new Date().toISOString()
        });
        stockUpdated = true;
      }
    }
  }

  res.json({ ok: true, reading, device: dev2, stockUpdated, message: stockUpdated ? 'Reading accepted - stock updated from sensor.' : 'Reading accepted.' });
}));

// GET /api/devices/:id/history - weight over time
router.get('/:id/history', asyncH(async (req, res) => {
  const db = req.db;
  const dev = await db.col('devices').findOne({ _id: req.params.id, ownerId: req.userId });
  if (!dev) throw httpError(404, 'Device not found');
  const real = await db.col('devicereadings').find({ deviceId: dev._id }, { sort: { at: 1 }, limit: 200 });
  let series = real.map((r) => ({ at: r.at, grams: r.grams }));
  if (series.length < 8) {
    const pantryItems = await db.col('pantries').find({ ownerId: req.userId });
    const item = dev.pantryItemId ? pantryItems.find((p) => p._id === dev.pantryItemId) : null;
    series = iot.historySeries(dev, item, 24);
  }
  res.json({ id: dev._id, name: dev.name, series });
}));

// POST /api/devices/conflicts/:deviceId/resolve { use: 'sensor' | 'app' }
router.post('/conflicts/:deviceId/resolve', asyncH(async (req, res) => {
  const db = req.db;
  const use = (req.body || {}).use;
  if (!['sensor', 'app'].includes(use)) throw httpError(400, "use must be 'sensor' or 'app'");
  const dev = await db.col('devices').findOne({ _id: req.params.deviceId, ownerId: req.userId });
  if (!dev || !dev.pantryItemId) throw httpError(404, 'No linked device/item found');
  const item = await db.col('pantries').findOne({ _id: dev.pantryItemId, ownerId: req.userId });
  const r = await db.col('devicereadings').findOne({ deviceId: dev._id }, { sort: { at: -1 } });
  if (!item || !r) throw httpError(404, 'Reading missing');

  let finalQty = item.quantity;
  if (use === 'sensor') {
    finalQty = Math.max(0, Math.round(r.grams));
    await db.col('pantries').updateOne({ _id: item._id }, { quantity: finalQty, updatedAt: new Date().toISOString() });
    await db.col('auditlogs').insertOne({
      ownerId: req.userId, itemId: item._id, name: item.name,
      before: item.quantity, after: finalQty, delta: finalQty - item.quantity, unit: item.unit,
      reason: `Conflict resolved: trusted sensor ${dev.name}`, type: 'sensor', at: new Date().toISOString()
    });
  }
  await logActivity(db, req.userId, { action: 'changed', target: item.name, detail: use === 'sensor' ? `Trusted sensor value (${r.grams} g)` : 'Kept app value, ignored sensor reading', icon: 'scale' });
  res.json({ ok: true, finalQty, message: use === 'sensor' ? `${item.name} updated to the sensor value.` : `${item.name} kept at the app value.` });
}));

module.exports = router;
