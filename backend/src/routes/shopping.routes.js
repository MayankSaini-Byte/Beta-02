const express = require('express');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const { compareBasket, quotesFor, PROVIDERS, basePriceFor } = require('../services/priceService');
const { resolveCatalog, norm } = require('../utils/text');
const { toCommercial, toBase, smartQty } = require('../utils/units');
const { daysUntil } = require('../utils/dates');
const { logActivity } = require('../services/activityService');
const { decoratePlan } = require('../services/plannerService');
const { getOrCreatePlan } = require('../services/mealPlanStore');
const { searchListings, compareOffers } = require('../services/rewaltoService');

const router = express.Router();
router.use(auth);

async function listDoc(db, userId) {
  const lists = db.col('shoppinglists');
  let doc = await lists.findOne({ ownerId: userId });
  if (!doc) doc = await lists.insertOne({ ownerId: userId, items: [] });
  return doc;
}

async function requireHousehold(req) {
  const user = await req.db.col('users').findOne({ _id: req.userId });
  if (!user) throw httpError(401, 'User not found');
  const accountType = user.accountType || (user.household?.kitchenType === 'commercial' ? 'commercial' : user.household?.kitchenType === 'hostel' ? 'service' : 'household');
  if (accountType !== 'household') throw httpError(403, 'Store price comparison is available for household accounts');
}

/** Auto-generated items: out-of-stock + below-threshold pantry items */
function autoItems(pantryItems) {
  return pantryItems
    .filter((p) => p.quantity <= p.threshold)
    .map((p) => {
      const suggested = Math.max(p.threshold * 2 - p.quantity, p.threshold, p.unit === 'g' || p.unit === 'ml' ? 250 : 1);
      const comm = toCommercial(suggested, p.unit);
      const raw = basePriceFor(p.key, p.name) * comm.qty;
      return {
        key: p.key,
        name: p.name,
        category: p.category,
        qty: p.quantity,
        unit: p.unit,
        toBuy: suggested,
        buyDisplay: `${Math.round(comm.qty * 100) / 100} ${comm.unit}`,
        reason: p.quantity <= 0 ? 'Out of stock' : daysUntil(p.expiryDate) !== null && daysUntil(p.expiryDate) < 0 ? 'Expired - replace' : 'Running low',
        estCost: Math.min(Math.round(raw), 3000)
      };
    })
    .sort((a, b) => b.estCost - a.estCost);
}

/** Merge duplicates by catalog key (keep the bigger ask) */
function mergeItems(items) {
  const byKey = new Map();
  const out = [];
  for (const i of items) {
    const k = i.key || `name:${norm(i.name)}`;
    if (byKey.has(k)) {
      const prev = byKey.get(k);
      if ((i.toBuy || 0) > (prev.toBuy || 0)) {
        Object.assign(prev, { toBuy: i.toBuy, buyDisplay: i.buyDisplay, estCost: i.estCost });
      }
      prev.sources = [...new Set([...(prev.sources || [prev.source]), ...(i.sources || [i.source])].filter(Boolean))];
      if (prev.done && !i.done) Object.assign(prev, { ...i, done: false });
      continue;
    }
    byKey.set(k, { ...i, sources: [i.source].filter(Boolean) });
    out.push(byKey.get(k));
  }
  return out;
}

// GET /api/shopping/list - auto + saved + plan shortages (single source of truth)
router.get('/list', asyncH(async (req, res) => {
  const db = req.db;
  const pantryItems = await db.col('pantries').find({ ownerId: req.userId });
  const doc = await listDoc(db, req.userId);
  const rawItems = doc.items || [];
  const stableItems = rawItems.map((item) => ({ ...item, id: item.id || item._id || require('crypto').randomUUID() }));
  if (stableItems.some((item, index) => item.id !== rawItems[index].id)) {
    await db.col('shoppinglists').updateOne({ _id: doc._id }, { items: stableItems });
    doc.items = stableItems;
  }

  // Plan shortages: needs for today onwards (planner summary), excluding done meals
  let planNeeds = [];
  try {
    const user = await db.col('users').findOne({ _id: req.userId });
    const plan = user ? await getOrCreatePlan(db, user) : null;
    if (user && plan) {
      const recipes = await db.col('recipes').find({});
      const decorated = decoratePlan(plan, user, pantryItems, recipes);
      planNeeds = decorated.summary.needs.map((n) => ({
        key: n.key, name: n.name, category: n.category, toBuy: n.toBuy, unit: n.unit,
        buyDisplay: n.buyDisplay, estCost: n.estCost, inList: (doc.items || []).some((i) => i.key === n.key)
      }));
    }
  } catch { /* plan needs are best-effort */ }

  res.json({
    auto: autoItems(pantryItems),
    saved: mergeItems(doc.items),
    planNeeds,
    providers: PROVIDERS.map((p) => ({ id: p.id, name: p.name, color: p.color, etaMin: p.etaMin, fee: p.fee, freeAbove: p.freeAbove }))
  });
}));

// POST /api/shopping/items { key?, name, qty, unit, source }
router.post('/items', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) throw httpError(400, 'Item name is required');
  const cat = resolveCatalog(b.name);
  const doc = await listDoc(req.db, req.userId);
  const requestedQty = b.qty === undefined ? null : Number(b.qty);
  if (requestedQty !== null && (!Number.isFinite(requestedQty) || requestedQty <= 0)) throw httpError(400, 'Quantity must be greater than zero');
  if (b.unit !== undefined && !['g', 'ml', 'pc', 'kg', 'l', 'L'].includes(b.unit)) throw httpError(400, 'Unit must be g, kg, ml, L, l, or pc');
  const item = {
    id: require('crypto').randomUUID(),
    key: b.key || (cat ? cat.key : null),
    name: cat ? cat.name : String(b.name).trim(),
    category: cat ? cat.category : 'other',
    qty: requestedQty ?? (cat ? cat.unit === 'g' ? 1000 : cat.unit === 'ml' ? 1000 : 1 : 1),
    unit: b.unit || (cat ? cat.unit : 'g'),
    toBuy: Number(b.toBuy) || null,
    source: ['manual', 'plan', 'recipe', 'gym'].includes(b.source) ? b.source : 'manual',
    done: false,
    addedAt: new Date().toISOString()
  };
  await req.db.col('shoppinglists').updateOne({ _id: doc._id }, { items: [...(doc.items || []), item] });
  await logActivity(req.db, req.userId, { action: 'added', target: item.name, detail: 'Added to shopping list', icon: 'cart' });
  res.status(201).json({ item });
}));

// POST /api/shopping/sync-plan - push planner shortages into the list (merge/dedupe)
router.post('/sync-plan', asyncH(async (req, res) => {
  const db = req.db;
  const user = await db.col('users').findOne({ _id: req.userId });
  const pantryItems = await db.col('pantries').find({ ownerId: req.userId });
  if (!user) throw httpError(401, 'User not found');
  const plan = await getOrCreatePlan(db, user);
  const recipes = await db.col('recipes').find({});
  const decorated = decoratePlan(plan, user, pantryItems, recipes);
  const needs = decorated.summary.needs;

  const doc = await listDoc(db, req.userId);
  const items = [...(doc.items || [])];
  let added = 0, merged = 0;
  for (const n of needs) {
    const existing = items.find((i) => i.key && i.key === n.key && !i.done);
    if (existing) {
      existing.toBuy = Math.max(existing.toBuy || 0, n.toBuy);
      existing.buyDisplay = n.buyDisplay;
      existing.estCost = Math.max(existing.estCost || 0, n.estCost);
      existing.source = existing.source || 'plan';
      existing.sources = [...new Set([...(existing.sources || [existing.source]), 'plan'])];
      merged++;
    } else {
      items.push({
        id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${n.key}`,
        key: n.key, name: n.name, category: n.category,
        qty: n.have, unit: n.unit, toBuy: n.toBuy, buyDisplay: n.buyDisplay,
        estCost: n.estCost, source: 'plan', sources: ['plan'], done: false,
        addedAt: new Date().toISOString()
      });
      added++;
    }
  }
  await db.col('shoppinglists').updateOne({ _id: doc._id }, { items });
  await logActivity(db, req.userId, { action: 'changed', target: 'Shopping list', detail: `Synced ${added} plan shortage(s)`, icon: 'cart' });
  res.json({ added, merged, total: needs.length, message: `Plan synced: ${added} added, ${merged} updated in your list.` });
}));

// PATCH /api/shopping/items/:id { done }
router.patch('/items/:id', asyncH(async (req, res) => {
  const doc = await listDoc(req.db, req.userId);
  let found = false;
  const items = (doc.items || []).map((i) => {
    if (i.id !== req.params.id) return i;
    found = true;
    return { ...i, done: !!(req.body || {}).done };
  });
  if (!found) throw httpError(404, 'List item not found');
  await req.db.col('shoppinglists').updateOne({ _id: doc._id }, { items });
  res.json({ ok: true, item: items.find((i) => i.id === req.params.id) });
}));

// POST /api/shopping/items/:id/bought - "Mark bought" -> adds to kitchen stock
router.post('/items/:id/bought', asyncH(async (req, res) => {
  const db = req.db;
  const doc = await listDoc(db, req.userId);
  const item = (doc.items || []).find((i) => i.id === req.params.id);
  if (!item) throw httpError(404, 'List item not found');
  if (item.done) throw httpError(409, 'This item is already marked bought');

  const pantries = db.col('pantries');
  const auditlogs = db.col('auditlogs');
  const qtyBase = toBase(Number(item.toBuy || item.qty) || 0, item.unit === 'kg' ? 'kg' : item.unit === 'L' ? 'l' : item.unit);
  const cat = resolveCatalog(item.name);
  const existing = (await pantries.find({ ownerId: req.userId })).find(
    (p) => (item.key && p.key === item.key) || norm(p.name) === norm(item.name)
  );

  let pantryItem;
  if (existing) {
    pantryItem = await pantries.updateOne(
      { _id: existing._id },
      { quantity: existing.quantity + qtyBase, updatedAt: new Date().toISOString() }
    );
    await auditlogs.insertOne({
      ownerId: req.userId, itemId: existing._id, name: existing.name,
      before: existing.quantity, after: existing.quantity + qtyBase, delta: qtyBase, unit: existing.unit,
      reason: 'Bought from shopping list', type: 'purchase', at: new Date().toISOString()
    });
  } else {
    pantryItem = await pantries.insertOne({
      ownerId: req.userId,
      key: item.key || (cat ? cat.key : null),
      name: item.name,
      category: cat ? cat.category : item.category || 'other',
      quantity: qtyBase,
      unit: cat ? cat.unit : item.unit || 'g',
      threshold: cat ? Math.max(1, Math.round((cat.unit === 'g' || cat.unit === 'ml' ? 250 : 2))) : 1,
      capacity: Math.max(qtyBase * 1.25, 750),
      expiryDate: cat ? null : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await auditlogs.insertOne({
      ownerId: req.userId, itemId: pantryItem._id, name: pantryItem.name,
      before: 0, after: qtyBase, delta: qtyBase, unit: pantryItem.unit,
      reason: 'Bought from shopping list', type: 'purchase', at: new Date().toISOString()
    });
  }

  const items = (doc.items || []).map((i) => (i.id === item.id ? { ...i, done: true, boughtAt: new Date().toISOString() } : i));
  await db.col('shoppinglists').updateOne({ _id: doc._id }, { items });
  await logActivity(db, req.userId, { action: 'added', target: item.name, detail: 'Marked bought - stock updated', icon: 'check' });

  res.json({
    ok: true,
    message: `${item.name} added to your kitchen stock (${smartQty(qtyBase, pantryItem.unit)}).`,
    item: pantryItem
  });
}));

// DELETE /api/shopping/items/:id
router.delete('/items/:id', asyncH(async (req, res) => {
  const doc = await listDoc(req.db, req.userId);
  const before = doc.items || [];
  const items = before.filter((i) => i.id !== req.params.id);
  if (items.length === before.length) throw httpError(404, 'List item not found');
  await req.db.col('shoppinglists').updateOne({ _id: doc._id }, { items });
  res.json({ ok: true });
}));

// POST /api/shopping/share - plain-text list for WhatsApp / clipboard
router.post('/share', asyncH(async (req, res) => {
  const pantryItems = await req.db.col('pantries').find({ ownerId: req.userId });
  const doc = await listDoc(req.db, req.userId);
  const auto = autoItems(pantryItems);
  const saved = mergeItems(doc.items || []).filter((i) => !i.done);

  const lines = ['*KitchenSync shopping list*', ''];
  if (auto.length) {
    lines.push('Auto (low/out of stock):');
    for (const a of auto) lines.push(`- ${a.name}: ${a.buyDisplay} (~₹${a.estCost})`);
    lines.push('');
  }
  if (saved.length) {
    lines.push('Added by us:');
    for (const s of saved) lines.push(`- ${s.name}${s.toBuy ? `: ${s.buyDisplay || `${s.toBuy} ${s.unit}`}` : ''}`);
    lines.push('');
  }
  const total = auto.reduce((s, a) => s + a.estCost, 0) + saved.reduce((s, x) => s + (x.estCost || 0), 0);
  lines.push(`Estimated total: ~₹${total}`);
  const text = lines.join('\n');
  res.json({ text, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(text)}`, total });
}));

// POST /api/shopping/compare { items }
router.post('/compare', asyncH(async (req, res) => {
  await requireHousehold(req);
  const items = (req.body || {}).items || [];
  if (!items.length) throw httpError(400, 'Provide at least one item to compare');
  res.json(compareBasket(items));
}));

// Live Rewalto comparison. This is deliberately separate from /compare, which
// remains the clearly labelled deterministic demo used by the simulated cart.
router.get('/live-compare/status', asyncH(async (req, res) => {
  await requireHousehold(req);
  const env = require('../config/env');
  res.json({ configured: Boolean(env.MULTISTOREAPI), provider: 'Rewalto', cacheDays: 7 });
}));

router.post('/live-compare', asyncH(async (req, res) => {
  await requireHousehold(req);
  const { items, pincode, forceRefresh = false } = req.body || {};
  const pin = String(pincode || '').trim();
  if (!/^[1-9]\d{5}$/.test(pin)) throw httpError(400, 'Enter a valid six-digit Indian delivery PIN.');
  if (!Array.isArray(items) || !items.length || items.length > 20) throw httpError(400, 'Choose between 1 and 20 shopping items to compare.');
  const normalized = items.map((item) => ({
    name: String(item?.name || '').trim().slice(0, 100),
    qty: Number(item?.qty),
    unit: String(item?.unit || '')
  }));
  if (normalized.some((item) => !item.name || !Number.isFinite(item.qty) || item.qty <= 0 || !['g', 'kg', 'ml', 'l', 'L', 'pc', 'pieces'].includes(item.unit))) {
    throw httpError(400, 'Every item needs a name, positive amount, and supported unit.');
  }

  const comparisons = [];
  for (const item of normalized) {
    try {
      const result = await searchListings(item.name, pin, Boolean(forceRefresh));
      const matched = compareOffers(result.listings, item);
      comparisons.push({ ...item, ...matched, credits: result.credits, cached: result.cached, asOf: result.asOf });
    } catch (error) {
      comparisons.push({ ...item, offers: [], cheapest: null, cached: false, error: error.message, requestId: error.requestId || null });
    }
  }

  const availableItems = comparisons.filter((item) => !item.error);
  const cheapest = availableItems.map((item) => item.cheapest);
  const cheapestBasketMinor = cheapest.length === comparisons.length && cheapest.every(Boolean)
    ? cheapest.reduce((sum, offer) => sum + offer.lineTotalMinor, 0) : null;
  const retailers = [...new Set(availableItems.flatMap((item) => item.offers.filter((offer) => offer.comparable).map((offer) => offer.retailer)))];
  const storeBaskets = retailers.map((retailer) => {
    const offers = availableItems.map((item) => item.offers.filter((offer) => offer.comparable && offer.retailer === retailer).sort((a, b) => a.lineTotalMinor - b.lineTotalMinor)[0]);
    return offers.every(Boolean) ? { retailer, totalMinor: offers.reduce((sum, offer) => sum + offer.lineTotalMinor, 0) } : null;
  }).filter(Boolean).sort((a, b) => a.totalMinor - b.totalMinor);
  const creditsCharged = comparisons.reduce((total, item) => total + (item.cached ? 0 : Number(item.credits?.charged || 0)), 0);
  res.json({ provider: 'Rewalto', pincode: pin, items: comparisons, cheapestBasketMinor, bestSingleStore: storeBaskets[0] || null, creditsCharged, cachedItems: comparisons.filter((item) => item.cached).length });
}));

// GET /api/shopping/quotes?name=&qty=&unit=
router.get('/quotes', asyncH(async (req, res) => {
  await requireHousehold(req);
  if (!req.query.name) throw httpError(400, 'name query param required');
  res.json(quotesFor({ name: req.query.name, key: req.query.key, qty: Number(req.query.qty) || 1, unit: req.query.unit || 'g' }));
}));

// GET /api/shopping/cart
router.get('/cart', asyncH(async (req, res) => {
  await requireHousehold(req);
  const cart = await req.db.col('carts').findOne({ ownerId: req.userId, status: 'active' });
  const order = await req.db.col('carts').findOne({ ownerId: req.userId, status: 'ordered' });
  res.json({ cart, lastOrder: order });
}));

// POST /api/shopping/cart { providerId, items }
router.post('/cart', asyncH(async (req, res) => {
  await requireHousehold(req);
  const { providerId } = req.body || {};
  const items = (req.body || {}).items || [];
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) throw httpError(400, 'Unknown provider');
  if (!items.length) throw httpError(400, 'Cart needs at least one item');

  const comparison = compareBasket(items);
  const basket = comparison.baskets.find((b) => b.providerId === providerId);
  const lineItems = comparison.perItem.map((it) => {
    const q = it.quotes.find((x) => x.providerId === providerId);
    return { key: it.key, name: it.name, qty: it.commercial.qty, unit: it.commercial.unit, price: q ? q.lineTotal : 0, inStock: q ? q.inStock : true, flag: it.sanity ? it.sanity.flag : null };
  });

  const carts = req.db.col('carts');
  await carts.deleteMany({ ownerId: req.userId, status: 'active' });
  const cart = await carts.insertOne({
    ownerId: req.userId,
    providerId,
    providerName: provider.name,
    items: lineItems,
    subtotal: basket.subtotal,
    fee: basket.fee,
    total: basket.total,
    savings: comparison.savings,
    etaMin: provider.etaMin,
    status: 'active',
    orderId: null,
    createdAt: new Date().toISOString()
  });
  res.json({ cart, comparison });
}));

// POST /api/shopping/cart/checkout
router.post('/cart/checkout', asyncH(async (req, res) => {
  await requireHousehold(req);
  const carts = req.db.col('carts');
  const cart = await carts.findOne({ ownerId: req.userId, status: 'active' });
  if (!cart) throw httpError(404, 'No active cart. Compare prices and add items first.');
  const orderId = `KS${Date.now().toString().slice(-8)}`;
  const updated = await carts.updateOne({ _id: cart._id }, { status: 'ordered', orderId, orderedAt: new Date().toISOString() });
  await logActivity(req.db, req.userId, { action: 'ordered', target: cart.providerName, detail: `Order ${orderId} - ${cart.items.length} items, ₹${cart.total}`, icon: 'truck' });
  res.json({ order: { ...updated, orderId }, message: `Order placed on ${cart.providerName}. ${cart.items.length} items, ETA ${cart.etaMin} min (simulated).` });
}));

// POST /api/shopping/cart/receive - delivery arrives -> stock updated
router.post('/cart/receive', asyncH(async (req, res) => {
  await requireHousehold(req);
  const carts = req.db.col('carts');
  const pantries = req.db.col('pantries');
  const auditlogs = req.db.col('auditlogs');
  const cart = await carts.findOne({ ownerId: req.userId, status: 'ordered' });
  if (!cart) throw httpError(404, 'No delivered order to receive');

  let added = 0;
  for (const line of cart.items) {
    const searchName = String(line.name || '').toLowerCase();
    const existing = (await pantries.find({ ownerId: req.userId })).find((p) => (p.key && line.key && p.key === line.key) || p.name.toLowerCase() === searchName);
    const baseQty = toBase(Number(line.qty) || 0, line.unit === 'kg' ? 'kg' : line.unit === 'L' ? 'l' : line.unit === 'pc' ? 'pc' : line.unit);
    if (existing) {
      await pantries.updateOne({ _id: existing._id }, { quantity: existing.quantity + baseQty, updatedAt: new Date().toISOString() });
    } else {
      const cat = resolveCatalog(line.name);
      await pantries.insertOne({
        ownerId: req.userId,
        key: line.key || (cat ? cat.key : null),
        name: line.name,
        category: cat ? cat.category : 'other',
        quantity: baseQty,
        unit: cat ? cat.unit : 'g',
        threshold: cat ? Math.max(1, Math.round(cat.unit === 'g' || cat.unit === 'ml' ? 250 : 2)) : 1,
        capacity: Math.max(baseQty * 1.25, 750),
        expiryDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    added++;
  }
  await carts.updateOne({ _id: cart._id }, { status: 'received' });
  await auditlogs.insertOne({
    ownerId: req.userId, itemId: null, name: `${cart.providerName} order ${cart.orderId}`,
    before: 0, after: added, delta: added, unit: 'items',
    reason: 'delivery received', type: 'delivery', at: new Date().toISOString()
  });
  await logActivity(req.db, req.userId, { action: 'added', target: `${cart.providerName} delivery`, detail: `${added} items restocked automatically`, icon: 'truck' });
  res.json({ added, message: `Delivery received: ${added} items added to your kitchen stock.` });
}));

// POST /api/shopping/handoff { providerId, items } - deep-link hand-off to the real app
// No quick-commerce platform exposes a public cart API, so we open each item's
// pre-filled search page on the store itself: the list "arrives" there and the
// user ticks items into the real cart. Copy text included as the keyboard path.
router.post('/handoff', asyncH(async (req, res) => {
  await requireHousehold(req);
  const { providerId } = req.body || {};
  const items = (req.body || {}).items || [];
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) throw httpError(400, 'Unknown provider');

  const links = items.slice(0, 40).map((it) => {
    const q = Number(it.qty) || Number(it.toBuy) || 1;
    const unit = it.unit || 'g';
    const comm = toCommercial(toBase(q, unit === 'kg' ? 'kg' : unit === 'L' ? 'l' : unit), unit === 'pc' ? 'pc' : (unit === 'ml' || unit === 'l') ? 'ml' : 'g');
    const qtyText = `${Math.round(comm.qty * 100) / 100} ${comm.unit}`;
    const search = encodeURIComponent(`${it.name} ${unit === 'pc' ? '' : qtyText}`.trim());
    return {
      name: it.name,
      qtyText,
      estCost: basePriceFor(it.key, it.name) * comm.qty,
      url: provider.searchUrl + search
    };
  });

  const total = links.reduce((s, l) => s + (l.estCost || 0), 0);
  const lines = [`${provider.name} - KitchenSync list`, ''];
  for (const l of links) lines.push(`- ${l.name} (${l.qtyText})`);
  lines.push('', `~${links.length} items · est ₹${Math.round(total)} (simulated estimate)`);
  const listText = lines.join('\n');

  await logActivity(req.db, req.userId, { action: 'ordered', target: provider.name, detail: `Handed off ${links.length} item(s) via deep links`, icon: 'truck' });

  res.json({
    provider: { id: provider.id, name: provider.name, color: provider.color, etaMin: provider.etaMin },
    items: links,
    openUrl: links.length ? links[0].url : provider.searchUrl,
    listText,
    total: Math.round(total),
    note: `${provider.name} has no public cart API - each link opens the item's pre-filled search; add to cart there. Copy the list as the fast path.`
  });
}));

module.exports = router;
