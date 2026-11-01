/**
 * IoT / Devices routes - smart-container weight sensors.
 * Hardware is SIMULATED (deterministic) with an honest label; the API surface
 * is the real one a load-cell ESP32 would call (POST /ingest).
 */
const express = require('express');
const auth = require('../middleware/auth');
const { requireAccountType } = require('../middleware/accountType');
const { asyncH, httpError } = require('../middleware/errors');
const iot = require('../services/iotService');
const { logActivity } = require('../services/activityService');
const { toCommercial } = require('../utils/units');
const { hash } = require('../utils/text');

const router = express.Router();
router.use(auth);
router.use(requireAccountType('commercial', 'service'));

async function latestReadings(db, ownerId, devices) {
  const map = new Map();
  for (const device of devices) {
    if (device.lastReadingAt) {
      map.set(device._id, {
        deviceId: device._id, grams: device.latestGrams, stable: device.latestStable,
        temperatureC: device.latestTemperatureC, humidityPercent: device.latestHumidityPercent,
        at: device.lastReadingAt, source: device.source || 'simulator'
      });
      continue;
    }
    // Compatibility with simulator records created before latest-value fields existed.
    const reading = await db.col('devicereadings').findOne({ ownerId, deviceId: device._id }, { sort: { at: -1 } });
    if (reading) map.set(device._id, reading);
  }
  return map;
}

// GET /api/devices - all containers with live status, latest weight, conflicts
router.get('/', asyncH(async (req, res) => {
  const db = req.db;
  const devices = await db.col('devices').find({ ownerId: req.userId }, { sort: { createdAt: 1 } });
  const readings = await latestReadings(db, req.userId, devices);
  const pantryItems = await db.col('pantries').find({ ownerId: req.userId });
  const itemById = new Map(pantryItems.map((p) => [p._id, p]));

  const out = devices.map((d) => {
    const r = readings.get(d._id);
    const item = d.pantryItemId ? itemById.get(d.pantryItemId) : null;
    const grams = r ? r.grams : null;
    const source = r?.source || d.source || 'simulator';
    const ageMs = d.lastSeen ? Math.max(0, Date.now() - Date.parse(d.lastSeen)) : Infinity;
    const status = source === 'physical'
      ? (ageMs <= 10000 ? 'online' : 'offline')
      : iot.statusFor(d);
    return {
      id: d._id,
      name: d.name,
      kind: d.kind,
      hardwareId: d.hardwareId || '',
      source,
      battery: d.battery,
      wifi: d.wifi,
      lastSeen: d.lastSeen,
      status,
      pantryItemId: d.pantryItemId || null,
      linkedItem: item ? { id: item._id, name: item.name, unit: item.unit, appQty: item.quantity, state: item.quantity <= 0 ? 'out' : item.quantity <= item.threshold ? 'low' : 'ok' } : null,
      grams,
      netGrams: grams == null ? null : Math.max(0, Math.round((grams - (Number(d.tareGrams) || 0)) * 10) / 10),
      stable: r ? r.stable === true : false,
      temperatureC: r?.temperatureC ?? null,
      humidityPercent: r?.humidityPercent ?? null,
      lastReadingAt: r?.at || d.lastReadingAt || null,
      tareGrams: Number(d.tareGrams) || 0,
      gramsDisplay: grams != null ? `${Math.round(toCommercial(grams, 'g').qty * 100) / 100} kg` : null,
      conflict: null
    };
  });

  const conflictReadings = new Map(devices.map((device) => {
    const reading = readings.get(device._id);
    if (device.source === 'physical' && (!reading || reading.stable !== true || Date.now() - Date.parse(reading.at) > 3000)) return [device._id, null];
    const netGrams = reading && device.source === 'physical'
      ? Math.max(0, Number(reading.grams) - (Number(device.tareGrams) || 0))
      : reading?.grams;
    return [device._id, reading ? { ...reading, grams: netGrams } : reading];
  }));
  const conflicts = iot.conflictsFor(devices, conflictReadings, pantryItems);
  for (const c of conflicts) {
    const dev = out.find((x) => x.id === c.deviceId);
    if (dev) dev.conflict = c;
  }

  res.json({ devices: out, conflicts, simulated: out.every((device) => device.source !== 'physical'), physicalDeviceCount: out.filter((device) => device.source === 'physical').length, staleAfterMin: iot.STALE_AFTER_MS / 60000 });
}));

// POST /api/devices { name, pantryItemId? } - pair a new container
router.post('/', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) throw httpError(400, 'Device name is required');
  const hardwareId = String(b.hardwareId || '').trim();
  if (hardwareId && !/^[A-Za-z0-9._:-]{1,80}$/.test(hardwareId)) throw httpError(400, 'Device ID must contain 1–80 letters, numbers, dots, underscores, colons, or hyphens');
  if (hardwareId) {
    const existing = await req.db.col('devices').findOne({ hardwareId });
    if (existing) {
      if (existing.ownerId === req.userId) {
        return res.json({ device: existing, source: existing.source, alreadyPaired: true });
      }
      throw httpError(409, 'This Device ID is already paired to another account. Sign into the account that paired it to view its readings.');
    }
  }
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
    hardwareId,
    source: hardwareId ? 'physical' : 'simulator',
    pantryItemId: b.pantryItemId || null,
    linkedKey,
    battery: 85 + Math.round(hash(b.name) * 14),
    wifi: hardwareId ? 'Waiting for sensor' : 'home-wifi',
    tareGrams: 0,
    lastSeen: hardwareId ? null : new Date().toISOString(),
    createdAt: new Date().toISOString()
  });
  if (!hardwareId) {
    // Keep the existing simulator's starter reading for demo storage points.
    const initialGrams = b.pantryItemId ? (await req.db.col('pantries').findOne({ _id: b.pantryItemId })).quantity : 500;
    const initialAt = new Date().toISOString();
    await req.db.col('devicereadings').insertOne({ ownerId: req.userId, deviceId: dev._id, grams: initialGrams, stable: true, source: 'simulator', at: initialAt });
    await req.db.col('devices').updateOne({ _id: dev._id }, { latestGrams: initialGrams, latestStable: true, lastReadingAt: initialAt });
  }
  await logActivity(req.db, req.userId, { action: 'added', target: dev.name, detail: hardwareId ? `Paired physical sensor ${hardwareId}` : 'Added a simulated smart container sensor', icon: 'chip' });
  res.status(201).json({ device: dev, source: dev.source });
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
  if (dev.source === 'physical' && (!r || r.stable !== true || Date.now() - Date.parse(r.at) > 3000)) throw httpError(409, 'A fresh stable sensor reading is required before setting tare');
  const dev2 = await devices.updateOne({ _id: dev._id }, { tareGrams: r ? r.grams : 0, lastSeen: new Date().toISOString() });
  if (dev.source !== 'physical') {
    const taredAt = new Date().toISOString();
    const tareReading = { ownerId: req.userId, deviceId: dev._id, grams: 0, stable: true, temperatureC: r?.temperatureC ?? null, humidityPercent: r?.humidityPercent ?? null, source: 'simulator', at: taredAt };
    await db.col('devicereadings').insertOne(tareReading);
    await devices.updateOne({ _id: dev._id }, { lastReadingAt: taredAt, latestGrams: 0, latestStable: true, latestTemperatureC: tareReading.temperatureC, latestHumidityPercent: tareReading.humidityPercent });
  }
  await logActivity(db, req.userId, { action: 'changed', target: dev.name, detail: `Tared (zeroed) the sensor`, icon: 'scale' });
  res.json({ ok: true, device: dev2, message: 'Tared. The container now reads 0 g - refill to weigh contents.' });
}));

// POST /api/devices/:id/simulate - venue-WiFi fallback: fabricate a plausible ping
router.post('/:id/simulate', asyncH(async (req, res) => {
  const db = req.db;
  const devices = db.col('devices');
  const dev = await devices.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!dev) throw httpError(404, 'Device not found');
  if (dev.source === 'physical' || dev.hardwareId) throw httpError(409, 'This is a physical sensor. Simulator readings are disabled for it.');
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

  const reading = await db.col('devicereadings').insertOne({ ownerId: req.userId, deviceId: dev._id, grams, stable: true, source: 'simulator', at: new Date().toISOString() });
  const readingAt = new Date().toISOString();
  const dev2 = await devices.updateOne({ _id: dev._id }, { lastSeen: readingAt, lastReadingAt: readingAt, latestGrams: grams, latestStable: true, latestTemperatureC: null, latestHumidityPercent: null, source: 'simulator', battery: Math.max(5, dev.battery - Math.round(hash(`${minuteSeed}`) * 2)) });

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
  const recent = await db.col('devicereadings').find({ ownerId: req.userId, deviceId: dev._id }, { sort: { at: -1 }, limit: 200 });
  const real = recent.reverse();
  let series = real.map((r) => ({ at: r.at, grams: r.grams, stable: r.stable === true, temperatureC: r.temperatureC ?? null, humidityPercent: r.humidityPercent ?? null, source: r.source || dev.source || 'simulator' }));
  if (dev.source !== 'physical' && series.length < 8) {
    const pantryItems = await db.col('pantries').find({ ownerId: req.userId });
    const item = dev.pantryItemId ? pantryItems.find((p) => p._id === dev.pantryItemId) : null;
    series = iot.historySeries(dev, item, 24);
  }
  res.json({ id: dev._id, name: dev.name, source: dev.source || 'simulator', series });
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
  if (dev.source === 'physical' && (r.stable !== true || Date.now() - Date.parse(r.at) > 3000)) throw httpError(409, 'A fresh stable physical reading is required before applying it to stock');

  let finalQty = item.quantity;
  if (use === 'sensor') {
    finalQty = Math.max(0, Math.round(Number(r.grams) - (dev.source === 'physical' ? Number(dev.tareGrams || 0) : 0)));
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
