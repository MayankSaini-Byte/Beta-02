const crypto = require('crypto');
const env = require('../config/env');

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cache = new Map();
const UNIT_KIND = { g: ['mass', 1], kg: ['mass', 1000], ml: ['volume', 1], l: ['volume', 1000], L: ['volume', 1000], pc: ['count', 1], pieces: ['count', 1] };

function packMeasure(listing) {
  const raw = String(listing.packSizeRaw || listing.title || '');
  const match = raw.match(/(?:(\d+(?:[.,]\d+)?)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|litres?|liters?|l|ml|millilitres?|milliliters?|pieces?|pcs|count)\b/i);
  if (!match) return null;
  const outer = Number((match[1] || '1').replace(',', '.'));
  const amount = Number(match[2].replace(',', '.')) * outer;
  const unit = match[3].toLowerCase();
  if (unit === 'kg') return { quantity: amount * 1000, kind: 'mass', unit: 'g' };
  if (unit === 'g') return { quantity: amount, kind: 'mass', unit: 'g' };
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(unit)) return { quantity: amount * 1000, kind: 'volume', unit: 'ml' };
  if (['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(unit)) return { quantity: amount, kind: 'volume', unit: 'ml' };
  return { quantity: amount, kind: 'count', unit: 'pc' };
}

function stockState(value, state, observedAt) {
  let available = null;
  if (typeof value === 'boolean') available = value;
  else if (value === 0 || value === 1) available = Boolean(value);
  else if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['true', '1', 'yes', 'in_stock', 'instock', 'available', 'stocked', 'buyable'].includes(normalized)) available = true;
    if (['false', '0', 'no', 'out_of_stock', 'outofstock', 'unavailable', 'sold_out', 'oos'].includes(normalized)) available = false;
  }
  if (available === null && typeof state === 'string') {
    const normalized = state.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['out_of_stock', 'outofstock', 'unavailable', 'sold_out', 'oos'].includes(normalized)) available = false;
    if (['in_stock', 'instock', 'available', 'stocked', 'priced_in_stock'].includes(normalized)) available = true;
  }
  if (available === null || !observedAt) return null;
  const time = Date.parse(observedAt);
  const age = Date.now() - time;
  return Number.isFinite(time) && age >= -5 * 60_000 && age <= 24 * 60 * 60_000 ? available : null;
}

async function searchListings(query, pincode, forceRefresh = false) {
  const key = crypto.createHash('sha256').update(`${query.trim().toLowerCase()}|${pincode}`).digest('hex');
  const cached = cache.get(key);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return { ...cached.result, cached: true };
  if (!env.MULTISTOREAPI) {
    const error = new Error('Live price comparison is not configured. Add MULTISTOREAPI to backend/.env and restart KitchenSync.');
    error.status = 503;
    throw error;
  }

  const params = new URLSearchParams({ q: query, limit: '5', include: 'latest', pincode });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;
  try {
    response = await fetch(`${env.REWALTO_CORE_API_URL}/v1/data/listings/search?${params}`, {
      headers: { Authorization: `Bearer ${env.MULTISTOREAPI}`, Accept: 'application/json', 'User-Agent': 'KitchenSync/1.0' },
      signal: controller.signal
    });
  } catch (cause) {
    const error = new Error(cause.name === 'AbortError' ? 'Rewalto price search timed out. Try again.' : 'Could not reach Rewalto right now.');
    error.status = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages = {
      401: 'Rewalto rejected the API key. Check MULTISTOREAPI in backend/.env.',
      402: 'Rewalto credits are exhausted or this account plan does not include grocery data.',
      403: 'This Rewalto key cannot read grocery listings.',
      429: 'Rewalto is rate-limiting requests. Try again later.'
    };
    const error = new Error(messages[response.status] || `Rewalto request failed (${response.status}).`);
    error.status = response.status === 401 || response.status === 403 ? 502 : response.status;
    error.requestId = response.headers.get('x-request-id');
    throw error;
  }

  const listings = (Array.isArray(payload.data) ? payload.data : []).map((listing) => {
    const latest = listing.latest || {};
    const measured = packMeasure(listing);
    return {
      title: listing.title || 'Untitled listing',
      retailer: listing.retailer || 'Store',
      url: listing.url || listing.sourceUrl || latest.sourceUrl || null,
      packSize: listing.packSizeRaw || null,
      matchAllWords: Boolean((listing.match || {}).allWords),
      priceMinor: latest.priceMinor ?? null,
      currency: latest.currency || 'INR',
      stock: stockState(latest.inStock ?? latest.stock, latest.state, latest.observedAt),
      pincode: latest.pincode || pincode,
      observedAt: latest.observedAt || null,
      priceState: latest.state || 'no_recent_reading',
      pack: measured
    };
  });
  const result = { listings, credits: (payload.meta || {}).credits || {}, asOf: (payload.meta || {}).asOf || null };
  cache.set(key, { result, fetchedAt: Date.now() });
  return { ...result, cached: false };
}

function compareOffers(listings, item) {
  const unit = UNIT_KIND[item.unit] || UNIT_KIND[String(item.unit).toLowerCase()];
  const required = Number(item.qty) * (unit ? unit[1] : NaN);
  const usable = listings.map((offer) => {
    const pack = offer.pack;
    const matches = pack && unit && pack.kind === unit[0] && offer.matchAllWords;
    const packsNeeded = matches && pack.quantity > 0 ? Math.max(1, Math.ceil(required / pack.quantity - 1e-9)) : null;
    const lineTotalMinor = packsNeeded !== null && offer.priceMinor !== null ? packsNeeded * offer.priceMinor : null;
    return {
      ...offer,
      comparable: Boolean(matches && Number.isFinite(required) && required > 0 && lineTotalMinor !== null && offer.stock !== false),
      packsNeeded,
      lineTotalMinor,
      unitPriceMinor: pack && offer.priceMinor !== null ? Math.round(offer.priceMinor * (pack.kind === 'count' ? 1 : 1000) / pack.quantity) : null
    };
  });
  const cheapest = usable.filter((offer) => offer.comparable).sort((a, b) => a.lineTotalMinor - b.lineTotalMinor)[0] || null;
  usable.sort((a, b) => {
    if (a.comparable !== b.comparable) return a.comparable ? -1 : 1;
    if (a.comparable && b.comparable) return a.lineTotalMinor - b.lineTotalMinor;
    if (a.stock !== b.stock) return a.stock === true ? -1 : b.stock === true ? 1 : 0;
    if (a.priceMinor == null) return 1;
    if (b.priceMinor == null) return -1;
    return a.priceMinor - b.priceMinor;
  });
  return { offers: usable, cheapest };
}

module.exports = { searchListings, compareOffers };
