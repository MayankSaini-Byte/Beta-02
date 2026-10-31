/**
 * IoT service - smart-container weight sensors (simulated hardware with an
 * honest label). Devices report net grams; readings build a time-series.
 * A "nonsense" guard rejects readings outside [-50g, 50kg].
 */
const { hash } = require('../utils/text');
const { daysUntil } = require('../utils/dates');

const STALE_AFTER_MS = 10 * 60 * 1000; // 10 min without a ping = stale
const CAPACITY_G = { default: 10000 };

function isPlausible(grams) {
  return Number.isFinite(grams) && grams > -50 && grams < 50000;
}

/** Simulated live reading for a device (deterministic-ish drift + jitter). */
function simulateReading(device, item, minuteSeed) {
  const base = item ? Number(item.quantity) : 0; // grams in base unit
  const drift = Math.round((hash(`${device._id}|${minuteSeed}`) - 0.5) * Math.max(20, base * 0.01));
  return Math.max(0, Math.round(base + drift));
}

/** Deterministic history for the last N hours (demo chart). */
function historySeries(device, item, points = 24) {
  const out = [];
  const now = Date.now();
  const start = item ? Number(item.quantity) : 500;
  for (let i = points - 1; i >= 0; i--) {
    const t = new Date(now - i * 3600 * 1000);
    const consumption = ((points - 1 - i) / (points - 1)) * start * 0.35; // drains 35% over the window
    const jitter = Math.round((hash(`${device._id}|${i}`) - 0.5) * start * 0.01);
    out.push({ at: t.toISOString(), grams: Math.max(0, Math.round(start - consumption + jitter)) });
  }
  return out;
}

function statusFor(device) {
  if (!device.lastSeen) return 'never-seen';
  const age = Date.now() - new Date(device.lastSeen).getTime();
  return age > STALE_AFTER_MS ? 'stale' : 'online';
}

/** Sensor vs app mismatch beyond tolerance -> conflict card. */
function conflictsFor(devices, readings, pantryItems) {
  const itemById = new Map(pantryItems.map((p) => [p._id, p]));
  const out = [];
  for (const d of devices) {
    if (!d.pantryItemId) continue;
    const item = itemById.get(d.pantryItemId);
    const latest = readings.get(d._id);
    if (!item || !latest) continue;
    const appG = Number(item.quantity) || 0;
    const sensorG = Number(latest.grams) || 0;
    const tol = Math.max(50, appG * 0.08);
    if (Math.abs(appG - sensorG) > tol) {
      out.push({
        deviceId: d._id,
        deviceName: d.name,
        itemId: item._id,
        itemName: item.name,
        unit: item.unit,
        appDisplay: `${Math.round(appG)} ${item.unit}`,
        sensorDisplay: `${Math.round(sensorG)} g`,
        diffG: Math.round(sensorG - appG),
        daysToExpiry: daysUntil(item.expiryDate)
      });
    }
  }
  return out;
}

module.exports = { isPlausible, simulateReading, historySeries, statusFor, conflictsFor, STALE_AFTER_MS, CAPACITY_G };
