/**
 * Multi-store price comparison engine.
 *
 * NOTE (honest demo): Swiggy Instamart / Blinkit / Zepto / BigBasket do not offer
 * public price APIs, and scraping violates their ToS. So KitchenSync ships a
 * pluggable Provider-adapter interface with a deterministic SIMULATED pricing
 * engine (stable per item+store+day). Swap `simulatedProvider` for a real
 * adapter (affiliate API / official partner API) without touching any route.
 */
const CATALOG = require('../data/catalog');
const { resolveCatalog, hash } = require('../utils/text');
const { toBase, toCommercial, inr } = require('../utils/units');

const PROVIDERS = [
  { id: 'instamart', name: 'Swiggy Instamart', color: '#FC8019', fee: 25, freeAbove: 199, etaMin: 14, mult: 1.0, rating: 4.2, searchUrl: 'https://www.swiggy.com/instamart/search?query=' },
  { id: 'blinkit', name: 'Blinkit', color: '#0C831F', fee: 35, freeAbove: 199, etaMin: 9, mult: 1.05, rating: 4.3, searchUrl: 'https://blinkit.com/s/?q=' },
  { id: 'zepto', name: 'Zepto', color: '#6D28D9', fee: 25, freeAbove: 199, etaMin: 11, mult: 0.98, rating: 4.1, searchUrl: 'https://www.zeptonow.com/search?q=' },
  { id: 'bigbasket', name: 'BigBasket', color: '#84C225', fee: 40, freeAbove: 500, etaMin: 240, mult: 0.93, rating: 4.0, searchUrl: 'https://www.bigbasket.com/ps/?q=' }
];

const byKey = new Map(CATALOG.map((c) => [c.key, c]));

const MAX_UNIT_PRICE = 2000; // rupees per commercial unit - above this looks like a unit bug

/** Deterministic jitter in [0.92, 1.09] per item+store+day so prices look live but stable */
function jitter(itemSeed, providerId, day) {
  return 0.92 + hash(`${itemSeed}|${providerId}|${day}`) * 0.17;
}

function resolveItem(item) {
  const cat = (item.key && byKey.get(item.key)) || resolveCatalog(item.name);
  return cat;
}

/** Quotes for a single item across all 4 stores. */
function quotesFor(item) {
  const cat = resolveItem(item);
  const base = toBase(Number(item.qty) || 0, item.unit || 'g');
  const comm = toCommercial(base, cat ? cat.unit : (item.unit || 'g').startsWith('m') ? 'ml' : (item.unit || 'g') === 'pc' ? 'pc' : 'g');
  const basePrice = cat ? cat.price : 150; // fallback estimate for fully custom items
  const day = new Date().toISOString().slice(0, 10);
  const seedStr = cat ? cat.key : String(item.name || 'item').toLowerCase();

  const quotes = PROVIDERS.map((p) => {
    const j = jitter(seedStr, p.id, day);
    const inStock = hash(`${seedStr}|${p.id}|stock|${day}`) > 0.07;
    let unitPrice = basePrice * p.mult * j;
    let flag = null;
    // Sanity guard: implausible per-unit price (data/qty bug protection)
    if (unitPrice > MAX_UNIT_PRICE) { flag = 'implausible-unit-price'; unitPrice = MAX_UNIT_PRICE; }
    return {
      providerId: p.id,
      providerName: p.name,
      color: p.color,
      unitPrice: Math.round(unitPrice * 100) / 100,
      lineTotal: Math.round(unitPrice * comm.qty * 100) / 100,
      etaMin: p.etaMin,
      inStock,
      estimated: !cat,
      flag,
      searchUrl: p.searchUrl + encodeURIComponent(item.name || (cat && cat.name) || '')
    };
  });

  const lineTotal = quotes.reduce((s, q) => s + q.lineTotal, 0) / quotes.length;
  return {
    name: cat ? cat.name : item.name,
    key: cat ? cat.key : null,
    qty: base,
    unit: cat ? cat.unit : item.unit,
    commercial: { qty: Math.round(comm.qty * 100) / 100, unit: comm.unit },
    // Implant plausibility: a single grocery line should never cost > ₹5000
    sanity: lineTotal > 5000 ? { flag: 'implausible-line', note: `₹${Math.round(lineTotal)} for ${comm.qty} ${comm.unit} of ${cat ? cat.name : item.name} looks wrong - check quantity/unit.` } : null,
    quotes
  };
}

/** Compare a full basket: per-item quotes + per-store basket totals + best store. */
function compareBasket(items) {
  const perItem = items.map(quotesFor);
  const day = new Date().toISOString().slice(0, 10);

  const baskets = PROVIDERS.map((p) => {
    let subtotal = 0;
    let missing = 0;
    for (const it of perItem) {
      const q = it.quotes.find((x) => x.providerId === p.id);
      if (!q) continue;
      if (!q.inStock) { missing++; continue; }
      subtotal += q.lineTotal;
    }
    const feeWaived = subtotal >= p.freeAbove;
    return {
      providerId: p.id,
      providerName: p.name,
      color: p.color,
      subtotal: inr(subtotal),
      fee: subtotal === 0 ? 0 : (feeWaived ? 0 : p.fee),
      feeWaived,
      missing,
      total: inr(subtotal + (subtotal === 0 || feeWaived ? 0 : p.fee)),
      etaMin: p.etaMin,
      rating: p.rating
    };
  });

  const available = baskets.filter((b) => b.subtotal > 0);
  const best = available.length
    ? available.slice().sort((a, b) => (a.missing - b.missing) || (a.total - b.total))[0]
    : null;
  const worst = available.length ? available.slice().sort((a, b) => b.total - a.total)[0] : null;

  return {
    perItem,
    baskets,
    bestProvider: best ? { id: best.providerId, name: best.providerName, total: best.total, etaMin: best.etaMin } : null,
    savings: best && worst ? worst.total - best.total : 0,
    simulated: true
  };
}

/** Base unit price per commercial unit (used by planner cost estimates) */
function basePriceFor(key, name) {
  const cat = (key && byKey.get(key)) || resolveCatalog(name);
  return cat ? cat.price : 150;
}

module.exports = { PROVIDERS, quotesFor, compareBasket, basePriceFor };
