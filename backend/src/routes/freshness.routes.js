const express = require('express');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const { todayISO } = require('../utils/dates');
const { logActivity } = require('../services/activityService');

const router = express.Router();
router.use(auth);

const DAY = 86_400_000;
const DAIRY_WORDS = /milk|curd|yogurt|yoghurt|paneer|cheese|butter|cream|dairy|ghee/i;
const PRODUCE_WORDS = /fruit|vegetable|spinach|methi|coriander|tomato|onion|potato|carrot|cucumber|gourd|banana|apple|orange|grape|papaya|mango|lemon|capsicum|cauliflower|cabbage|okra|brinjal|beetroot|garlic|ginger|chilli|pepper/i;
const DAIRY_LIFE = { milk: 5, curd: 10, yogurt: 10, paneer: 7, cheese: 21, butter: 30, cream: 5 };

function isoDaysBetween(from, to) {
  const a = Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DAY) : null;
}

function categoryOf(item) {
  const text = `${item.category || ''} ${item.name || ''}`.toLowerCase();
  if (DAIRY_WORDS.test(text)) return 'dairy';
  if (PRODUCE_WORDS.test(text) || /vegetable|fruit|produce/.test(text)) return 'produce';
  return null;
}

function typicalShelfLife(item, category) {
  if (Number(item.shelfLifeDays) > 0) return Number(item.shelfLifeDays);
  const text = String(item.name || '').toLowerCase();
  if (category === 'dairy') {
    const key = Object.keys(DAIRY_LIFE).find((word) => text.includes(word));
    return key ? DAIRY_LIFE[key] : 7;
  }
  if (/spinach|methi|leaf|coriander/.test(text)) return 4;
  if (/banana|papaya|mango/.test(text)) return 5;
  if (/potato|onion|garlic|ginger|carrot|beetroot/.test(text)) return 18;
  return 7;
}

function scoreItem(item, category) {
  const today = todayISO();
  const purchaseDate = item.purchaseDate || String(item.createdAt || today).slice(0, 10);
  const shelfLifeDays = typicalShelfLife(item, category);
  const storage = ['room', 'fridge', 'freezer'].includes(item.storage) ? item.storage : category === 'dairy' ? 'fridge' : 'fridge';
  const storageFactor = storage === 'room' ? 0.65 : storage === 'freezer' ? 2.5 : 1;
  const estimatedLife = Math.max(1, Math.round(shelfLifeDays * storageFactor));
  const estimatedExpiry = new Date(Date.parse(`${purchaseDate}T00:00:00Z`) + estimatedLife * DAY).toISOString().slice(0, 10);
  const baseExpiry = item.expiryDate && item.expirySource !== 'estimated' ? item.expiryDate : estimatedExpiry;
  let effectiveExpiry = baseExpiry;
  let openedDays = null;
  if (category === 'dairy' && item.opened) {
    const openedAt = item.openedAt || today;
    openedDays = Math.max(0, isoDaysBetween(openedAt, today) || 0);
    const lifeLeftAtOpening = Math.max(0, isoDaysBetween(openedAt, baseExpiry) || 0);
    effectiveExpiry = new Date(Date.parse(`${openedAt}T00:00:00Z`) + Math.max(1, Math.ceil(lifeLeftAtOpening * 0.5)) * DAY).toISOString().slice(0, 10);
  }
  const daysLeft = isoDaysBetween(today, effectiveExpiry) ?? 0;
  const totalLife = Math.max(1, isoDaysBetween(purchaseDate, effectiveExpiry) || shelfLifeDays);
  const score = Math.max(0, Math.min(100, Math.round((daysLeft / totalLife) * 100)));
  const label = daysLeft < 0 ? 'Expired' : score >= 80 ? 'Fresh' : score >= 60 ? 'Use soon' : score >= 40 ? 'Ageing' : 'Almost gone';
  return {
    id: String(item._id), name: item.name, score, label, daysLeft,
    daysLabel: daysLeft < 0 ? 'expired' : daysLeft === 0 ? 'expires today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
    opened: category === 'dairy' ? Boolean(item.opened) : false,
    openedAt: item.openedAt || null, openedDays, storage, quantity: Number(item.quantity) || 0,
    unit: item.unit || 'g', purchaseDate, expiryDate: effectiveExpiry,
    shelfLifeDays, category: item.category || category, subgroup: subgroup(item.name, category),
    discarded: daysLeft < 0 && category === 'dairy'
  };
}

function subgroup(name, category) {
  if (category !== 'produce') return null;
  const n = String(name || '').toLowerCase();
  if (/spinach|methi|coriander|leaf|lettuce|mint/.test(n)) return 'Leafy greens';
  if (/gourd|bottle|bitter|ridge|zucchini/.test(n)) return 'Gourds';
  if (/potato|carrot|beetroot|radish|turnip|yam/.test(n)) return 'Roots & tubers';
  if (/tomato|onion/.test(n)) return 'Tomatoes & onions';
  if (/fruit|banana|apple|orange|grape|papaya|mango|lemon/.test(n)) return 'Fruits';
  return 'Roots & tubers';
}

async function listCategory(req, res, category) {
  const pantry = await req.db.col('pantries').find({ ownerId: req.userId });
  const items = pantry.filter((item) => Number(item.quantity) > 0 && categoryOf(item) === category)
    .map((item) => scoreItem(item, category))
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  res.json({ items, average: items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : null });
}

router.get('/produce', asyncH((req, res) => listCategory(req, res, 'produce')));
router.get('/dairy', asyncH((req, res) => listCategory(req, res, 'dairy')));

router.post('/:category/:id/:action', asyncH(async (req, res) => {
  const { category, id, action } = req.params;
  if (!['produce', 'dairy'].includes(category) || !['used', 'spoiled'].includes(action)) throw httpError(404, 'Freshness action not found');
  const pantries = req.db.col('pantries');
  const item = await pantries.findOne({ _id: id, ownerId: req.userId });
  if (!item || categoryOf(item) !== category) throw httpError(404, 'Freshness item not found');
  const quantity = Number(item.quantity) || 0;
  if (quantity <= 0) throw httpError(400, 'This item has no stock left');
  const at = new Date().toISOString();
  const updated = await pantries.updateOne({ _id: id, ownerId: req.userId }, { quantity: 0, updatedAt: at });
  await req.db.col('auditlogs').insertOne({
    ownerId: req.userId, itemId: item.key || item.name, name: item.name,
    before: quantity, after: 0, delta: -quantity, unit: item.unit || 'g',
    reason: action === 'spoiled' ? 'freshness index - spoiled' : 'freshness index - used',
    type: action === 'spoiled' ? 'waste' : 'use', at
  });
  await logActivity(req.db, req.userId, {
    action: action === 'spoiled' ? 'wasted' : 'used', target: item.name,
    detail: `${quantity} ${item.unit || 'g'} ${action} from freshness tracking`, icon: action === 'spoiled' ? 'alert' : 'check'
  });
  res.json({ item: updated, action });
}));

module.exports = router;
