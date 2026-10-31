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
const { requireAccountType } = require('../middleware/accountType');
const { asyncH, httpError } = require('../middleware/errors');
const env = require('../config/env');
const iot = require('../services/iotService');
const { toBase, smartQty } = require('../utils/units');
const { logActivity } = require('../services/activityService');

const router = express.Router();

const FRESH_MS = 3000;      // reading must be younger than this for a weigh-in
const ONLINE_MS = 10000;    // allow for normal Wi-Fi jitter between ESP32 posts

async function findOwnedSensor(db, ownerId, sensorId) {
  let device = await db.col('devices').findOne({ ownerId, hardwareId: sensorId });
  if (!device) device = await db.col('devices').findOne({ ownerId, _id: sensorId });
  return device;
}

async function getLatest(db, deviceId = 'scale1') {
  let s = await db.col('scalestate').findOne({ _id: deviceId });
  if (!s) s = await db.col('scalestate').insertOne({ _id: deviceId, deviceId, grams: 0, stable: false, ts: 0, readings: 0, rejected: 0 });
  return s;
}

async function saveLatest(db, deviceId, patch) {
  const cur = await getLatest(db, deviceId);
  const next = { ...cur, ...patch, deviceId, _id: deviceId };
  const exists = await db.col('scalestate').findOne({ _id: deviceId });
  if (exists) {
    const { _id, ...update } = next;
    return db.col('scalestate').updateOne({ _id: deviceId }, update);
  }
  return db.col('scalestate').insertOne(next);
}

function optionalReading(value, min, max, name) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && !value.trim()) throw httpError(422, `${name} must be a number`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw httpError(422, `${name} must be between ${min} and ${max}`);
  return Math.round(number * 10) / 10;
}

function readingTimestamp(body, now) {
  const raw = body.timestamp_ms ?? body.timestamp ?? body.ts;
  if (raw === undefined || raw === null || raw === '') return now;
  const timestamp = typeof raw === 'number' || /^\d{10,13}$/.test(String(raw).trim())
    ? Number(raw)
    : Date.parse(raw);
  if (!Number.isFinite(timestamp)) throw httpError(422, 'Invalid reading timestamp');
  if (timestamp > now + 30_000 || now - timestamp > 30_000) throw httpError(422, 'Reading timestamp is stale or in the future');
  return timestamp;
}

/* ---------- device -> server (no JWT; shared device key instead) ---------- */

// POST /api/scale/reading  { device_id, grams, stable, temperature_c?, humidity_percent?, timestamp_ms?, reading_id? }
// header: x-device-key. Environmental values use the same authenticated reading.
router.post('/reading', asyncH(async (req, res) => {
  const key = req.headers['x-device-key'];
  if (!key || key !== env.DEVICE_KEY) return res.status(401).json({ error: 'Invalid device key' });

  const b = req.body || {};
  const deviceId = String(b.device_id || b.deviceId || 'scale1');
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(deviceId)) throw httpError(422, 'device_id must contain 1–80 letters, numbers, dots, underscores, colons, or hyphens');
  if (b.grams === undefined || b.grams === null || (typeof b.grams === 'string' && !b.grams.trim())) throw httpError(422, 'grams is required');
  const grams = Number(b.grams);
  if (!Number.isFinite(grams) || !iot.isPlausible(grams)) {
    const existing = await req.db.col('scalestate').findOne({ _id: deviceId });
    if (existing) await saveLatest(req.db, deviceId, { rejected: (existing.rejected || 0) + 1 });
    return res.status(422).json({ error: 'Implausible reading rejected' });
  }
  const stableValue = b.stable ?? b.isStable;
  if (stableValue !== undefined && typeof stableValue !== 'boolean') throw httpError(422, 'stable must be a boolean');
  const stable = stableValue === true;
  const temperatureC = optionalReading(b.temperature_c ?? b.temperatureC, -40, 80, 'temperature_c');
  const humidityPercent = optionalReading(b.humidity_percent ?? b.humidityPercent, 0, 100, 'humidity_percent');
  const now = Date.now();
  const ts = readingTimestamp(b, now);
  const at = new Date(ts).toISOString();
  const readingId = String(b.reading_id || b.readingId || '').trim().slice(0, 128);

  let device = await req.db.col('devices').findOne({ hardwareId: deviceId });
  if (!device) device = await req.db.col('devices').findOne({ _id: deviceId });
  // Keep the legacy unpaired scale1 endpoint working; all other sensor IDs must be paired.
  if (!device && deviceId !== 'scale1') throw httpError(404, 'Unknown device_id. Pair this sensor from the Devices page first.');

  const deviceReadings = req.db.col('devicereadings');
  const readingDeviceId = device ? device._id : deviceId;
  if (readingId && await deviceReadings.findOne({ deviceId: readingDeviceId, readingId })) return res.status(204).end();
  const previous = device
    ? await deviceReadings.findOne({ deviceId: readingDeviceId }, { sort: { at: -1 } })
    : await getLatest(req.db, deviceId);
  const previousTs = previous?.at ? Date.parse(previous.at) : Number(previous?.ts) || 0;
  if (previousTs && ts <= previousTs) {
    if (previousTs === ts && Number(previous.grams) === grams && (previous.readingId || '') === readingId) return res.status(204).end();
    throw httpError(409, 'Out-of-order sensor reading rejected');
  }

  const current = await getLatest(req.db, deviceId);
  await saveLatest(req.db, deviceId, {
    grams: Math.round(grams * 10) / 10, stable, temperatureC, humidityPercent,
    timestamp: at, readingId, source: 'physical', ts: now,
    readings: (current.readings || 0) + 1
  });

  if (device) {
    await deviceReadings.insertOne({
      ownerId: device.ownerId, deviceId: device._id, sensorId: deviceId, grams: Math.round(grams * 10) / 10,
      stable, temperatureC, humidityPercent, readingId, source: 'physical', at
    });
    await req.db.col('devices').updateOne({ _id: device._id }, {
      lastSeen: new Date(now).toISOString(), lastReadingAt: at, latestGrams: Math.round(grams * 10) / 10,
      latestStable: stable, latestTemperatureC: temperatureC, latestHumidityPercent: humidityPercent,
      source: 'physical', wifi: 'ESP32'
    });
  }

  res.status(204).end();
}));

/* ---------- browser -> server ---------- */

// GET /api/scale/latest - live weight for the UI (poll every ~800 ms)
router.get('/latest', auth, requireAccountType('commercial', 'service'), asyncH(async (req, res) => {
  const deviceId = String(req.query.device_id || 'scale1');
  const device = await findOwnedSensor(req.db, req.userId, deviceId);
  if (deviceId !== 'scale1' && !device) throw httpError(404, 'Paired sensor not found');
  const s = await getLatest(req.db, deviceId);
  const age = s.ts ? Date.now() - s.ts : Infinity;
  res.json({
    deviceId,
    deviceName: device?.name || null,
    grams: s.ts ? s.grams : null,
    stable: !!s.stable,
    temperatureC: s.temperatureC ?? null,
    humidityPercent: s.humidityPercent ?? null,
    tareGrams: Number(device?.tareGrams) || 0,
    netGrams: Math.max(0, Math.round((Number(s.grams) - (Number(device?.tareGrams) || 0)) * 10) / 10),
    source: s.source || (device ? device.source : 'simulator'),
    timestamp: s.timestamp || null,
    ts: s.ts || null,
    ageMs: isFinite(age) ? age : null,
    online: age >= -5000 && age < ONLINE_MS,
    readings: s.readings || 0,
    rejected: s.rejected || 0
  });
}));

// POST /api/scale/simulate - venue-Wi-Fi fallback: fabricate a fresh stable
// reading SERVER-SIDE so the demo survives missing hardware.
router.post('/simulate', auth, requireAccountType('commercial', 'service'), asyncH(async (req, res) => {
  const b = req.body || {};
  let grams = Number(b.grams);
  if (!Number.isFinite(grams) && b.itemId) {
    const item = await req.db.col('pantries').findOne({ _id: b.itemId, ownerId: req.userId });
    if (item) grams = item.quantity + (Number(b.containerWeight) || 0);
  }
  if (!Number.isFinite(grams)) grams = 1240 + Math.round(Math.random() * 40);
  const current = await getLatest(req.db, 'scale1');
  const state = await saveLatest(req.db, 'scale1', { grams: Math.round(grams * 10) / 10, stable: true, temperatureC: null, humidityPercent: null, source: 'simulator', timestamp: new Date().toISOString(), ts: Date.now(), readings: (current.readings || 0) + 1 });
  await logActivity(req.db, req.userId, { action: 'changed', target: 'Weighing station', detail: `Simulated a stable sensor reading (${Math.round(grams)} g)`, icon: 'scale' });
  res.json({ ok: true, state, message: `Simulated a stable reading of ${Math.round(grams)} g.` });
}));

// POST /api/scale/stock/:id/weigh { mode: 'set'|'add', containerWeight } - weigh into stock
router.post('/stock/:id/weigh', auth, requireAccountType('commercial', 'service'), asyncH(async (req, res) => {
  const db = req.db;
  const b = req.body || {};
  const mode = b.mode === 'add' ? 'add' : 'set';
  const deviceId = String(b.deviceId || 'scale1');
  const device = await findOwnedSensor(db, req.userId, deviceId);
  if (deviceId !== 'scale1' && !device) throw httpError(404, 'Paired sensor not found');

  const s = await getLatest(db, deviceId);
  const readingAge = Date.now() - Number(s.ts || 0);
  if (!s.ts || readingAge < -5000 || readingAge > FRESH_MS) throw httpError(409, 'Scale offline - no fresh reading. Check the ESP32 (or press Simulate sensor).');
  if (!s.stable) throw httpError(409, 'Weight not stable yet - wait for the Stable ✅ badge.');

  const item = await db.col('pantries').findOne({ _id: req.params.id, ownerId: req.userId });
  if (!item) throw httpError(404, 'Stock item not found');

  const containerWeight = Number(b.containerWeight ?? device?.tareGrams ?? 0) || 0;
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
router.get('/reweigh/:itemId', auth, requireAccountType('commercial', 'service'), asyncH(async (req, res) => {
  const db = req.db;
  const item = await db.col('pantries').findOne({ _id: req.params.itemId, ownerId: req.userId });
  if (!item) throw httpError(404, 'Stock item not found');
  const deviceId = String(req.query.device_id || 'scale1');
  const device = await findOwnedSensor(db, req.userId, deviceId);
  if (deviceId !== 'scale1' && !device) throw httpError(404, 'Paired sensor not found');
  const s = await getLatest(db, deviceId);
  const online = !!s.ts && Date.now() - s.ts >= -5000 && Date.now() - s.ts < ONLINE_MS;
  const measuredGrams = online ? Math.max(0, s.grams - (Number(device?.tareGrams) || 0)) : null;
  const lastDeduction = await db.col('auditlogs').findOne({ ownerId: req.userId, itemId: item._id, type: 'meal' }, { sort: { at: -1 } });
  res.json({
    itemId: item._id,
    name: item.name,
    unit: item.unit,
    appGrams: item.quantity,
    scaleGrams: measuredGrams,
    online,
    diffGrams: online ? Math.round(measuredGrams - item.quantity) : null,
    lastDeduction: lastDeduction ? { delta: lastDeduction.delta, unit: lastDeduction.unit, at: lastDeduction.at, reason: lastDeduction.reason } : null
  });
}));

module.exports = router;
