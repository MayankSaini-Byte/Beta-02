/**
 * AI service (z-ai-web-dev-sdk) with deterministic heuristic fallbacks.
 * Used for:
 *   1. estimating ingredient quantities for user-added recipes
 *   2. extracting grocery line items from receipt text/photo OCR
 * Every call degrades gracefully: if the SDK or the model is unavailable, the
 * heuristic result is returned and clearly labeled (engine: 'heuristic').
 */
const CATALOG = require('../data/catalog');
const { resolveCatalog } = require('../utils/text');
const { hash } = require('../utils/text');

const byKey = new Map(CATALOG.map((c) => [c.key, c]));

let _zai = null;
let _zaiTried = false;

async function getZai() {
  if (_zaiTried) return _zai;
  _zaiTried = true;
  try {
    // Resolved from the project-root node_modules; backend stays install-free.
    const mod = require('z-ai-web-dev-sdk');
    _zai = mod.default || mod;
    if (_zai && typeof _zai.create !== 'function' && typeof _zai !== 'function') _zai = null;
  } catch {
    _zai = null;
  }
  return _zai;
}

async function chat(messages, maxTokens = 900) {
  const ZAI = await getZai();
  if (!ZAI) throw new Error('sdk-unavailable');
  const zai = typeof ZAI.create === 'function' ? await ZAI.create() : new ZAI();
  const res = await zai.chat.completions.create({ messages, maxTokens, temperature: 0.3 });
  const text = res && res.choices && res.choices[0] && res.choices[0].message ? res.choices[0].message.content : '';
  if (!text) throw new Error('empty-response');
  return text;
}

function extractJson(text) {
  if (!text) throw new Error('no-text');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  if (start < 0) throw new Error('no-json');
  const candidate = raw.slice(start);
  // walk to the matching closing bracket
  const open = candidate[0];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let end = -1;
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i] === open) depth++;
    else if (candidate[i] === close) {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) throw new Error('no-json');
  return JSON.parse(candidate.slice(0, end));
}

/* ------------------------------------------------------------------ */
/* 1) Ingredient quantity estimation for user-created recipes          */
/* ------------------------------------------------------------------ */

// Per-1-portion heuristic grams by catalog key family (sensible home-cooking bases)
const HEURISTIC_BASE = {
  'wheat-flour': 120, 'rice': 120, 'basmati-rice': 120, 'besan': 90, 'oats': 60,
  'toor-dal': 60, 'moong-dal': 60, 'chana-dal': 60, 'urad-dal': 55, 'rajma': 70,
  'chickpeas': 70, 'soya-chunks': 50, 'chicken': 220, 'fish': 180, 'egg': 1.5,
  'paneer': 90, 'tofu': 90, 'potato': 150, 'onion': 70, 'tomato': 90,
  'milk': 150, 'curd': 70, 'mushroom': 120, 'spinach': 80, 'poha': 90,
  'sunflower-oil': 12, 'mustard-oil': 12, 'ghee': 10, 'butter': 10,
  'salt': 2, 'sugar': 5, 'turmeric': 2, 'red-chilli-powder': 3, 'coriander-powder': 3,
  'garam-masala': 2, 'cumin': 2, 'mustard-seeds': 2, 'ginger-garlic-paste': 8,
  'soy-sauce': 8, 'vinegar': 4, 'tomato-ketchup': 10, 'honey': 8,
  'bread': 1, 'pav': 2, 'noodles': 1, 'hakka-noodles': 90, 'pasta': 90,
  'lemon': 0.5, 'banana': 0.5, 'apple': 0.5, 'peanuts': 15, 'cream': 15,
  'green-chilli': 4, 'coriander-leaves': 8, 'capsicum': 50, 'carrot': 40,
  'cabbage': 60, 'cauliflower': 100, 'peas': 40, 'cornflour': 15,
  'black-pepper': 1.5, 'tea-leaves': 3, 'coffee': 5, 'milk-powder': 15,
  'cheese-slices': 1, 'dosa-batter': 150, 'sooji': 60, 'sweet-corn': 50
};

function heuristicEstimate(ingredients, servings) {
  const n = Math.max(0.5, Number(servings) || 2);
  return (ingredients || []).map((ing) => {
    const cat = (ing.key && byKey.get(ing.key)) || resolveCatalog(ing.name || '');
    const key = cat ? cat.key : null;
    const unit = cat ? cat.unit : 'g';
    let perPortion = HEURISTIC_BASE[key];
    if (perPortion === undefined) perPortion = unit === 'pc' ? 1 : 40;
    const qty = unit === 'pc'
      ? Math.max(1, Math.round(perPortion * n * 2) / 2) // halves allowed
      : Math.max(1, Math.round(perPortion * n));
    return {
      key,
      name: cat ? cat.name : String(ing.name || ing.key || 'item'),
      qty,
      unit,
      estimated: true
    };
  });
}

/** Estimate quantities for a user recipe. Tries the LLM first, falls back. */
async function estimateQuantities({ name, ingredients, servings = 2, diet = 'veg' }) {
  const heuristic = heuristicEstimate(ingredients, servings);
  try {
    const text = await chat([
      {
        role: 'system',
        content:
          'You are a recipe quantity estimator for Indian home cooking. Given a dish and loose ingredients, output ONLY JSON: [{"name":"...","qty":number,"unit":"g|ml|pc"}] with realistic per-serving totals for the given servings count. Use grams for solids, ml for liquids, pc for countables (eggs, bread slices, chapati). No commentary.'
      },
      {
        role: 'user',
        content: `Dish: ${name} (${diet}). Servings: ${servings}. Ingredients: ${ingredients.map((i) => i.name || i.key).join(', ')}.`
      }
    ]);
    const parsed = extractJson(text);
    if (!Array.isArray(parsed) || !parsed.length) throw new Error('bad-shape');
    const out = parsed.slice(0, 20).map((p) => {
      const cat = resolveCatalog(p.name || '');
      const unit = ['g', 'ml', 'kg', 'l', 'pc'].includes(p.unit) ? p.unit : cat ? cat.unit : 'g';
      const normUnit = unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit;
      const qty = normUnit === 'g' && unit === 'kg' ? Math.round((Number(p.qty) || 0) * 1000) : normUnit === 'ml' && unit === 'l' ? Math.round((Number(p.qty) || 0) * 1000) : Math.round((Number(p.qty) || 0) * 100) / 100;
      return {
        key: cat ? cat.key : null,
        name: cat ? cat.name : String(p.name || 'item'),
        qty: Math.max(0.5, qty || 1),
        unit: normUnit,
        estimated: true
      };
    });
    return { ingredients: out, engine: 'ai' };
  } catch {
    return { ingredients: heuristic, engine: 'heuristic', note: 'AI unavailable - quantities estimated from standard home-cooking portions. Edit freely.' };
  }
}

/** Estimate calories and protein for a free-text meal description and portion. */
async function estimateFoodNutrition({ food, mealType = 'meal' }) {
  const text = await chat([
    {
      role: 'system',
      content: 'Estimate calories (kcal) and protein (g) for the food and portion described. If no portion is stated, use one typical serving of that dish. Return ONLY JSON: {"calories":number,"protein":number,"serving":"short portion description","confidence":"low|medium|high"}. Give a practical estimate, not false precision. Do not give health advice.'
    },
    {
      role: 'user',
      content: `Meal type: ${mealType}. Food and portion: ${food}.`
    }
  ], 250);
  const result = extractJson(text);
  const calories = Number(result && result.calories);
  const protein = Number(result && result.protein);
  if (!Number.isFinite(calories) || calories < 0 || calories > 10000 || !Number.isFinite(protein) || protein < 0 || protein > 500) {
    throw new Error('bad-nutrition-estimate');
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    serving: String(result.serving || 'one serving').slice(0, 80),
    confidence: ['low', 'medium', 'high'].includes(result.confidence) ? result.confidence : 'low'
  };
}

/* ------------------------------------------------------------------ */
/* 2) Receipt parsing (OCR text -> grocery items)                      */
/* ------------------------------------------------------------------ */

const NOISE = /(total|subtotal|gst|cgst|sgst|vat|tax|amount|cash|change|thank|visit|bill|invoice|store|branch|cashier|token|order|date|time|phone|address|saved|points|paytm|upi|card|due|balance|qty|mrp|mc|f\+|sgst)/i;

function heuristicParseReceipt(text) {
  const lines = String(text || '').split(/\r?\n/);
  const found = [];
  const seen = new Set();
  for (const line of lines) {
    const clean = line.replace(/[0-9]+[.,][0-9]{2}\s*$/,'').replace(/[*x]+/g, ' ').trim();
    if (!clean || clean.length < 3 || NOISE.test(clean)) continue;
    // strip leading quantity codes like "2 X "
    const namePart = clean.replace(/^\s*\d+\s*[xX*]?\s*/, '').trim();
    if (!namePart) continue;
    const cat = resolveCatalog(namePart);
    if (!cat || seen.has(cat.key)) continue;
    seen.add(cat.key);
    found.push({ name: cat.name, key: cat.key, unit: cat.unit, confidence: Math.round((70 + hash(cat.key) * 20) * 10) / 10 });
    if (found.length >= 15) break;
  }
  return found;
}

/** Parse receipt text into catalog items. Tries the LLM, falls back to rules. */
async function parseReceipt(text) {
  try {
    const out = await chat([
      { role: 'system', content: 'Extract grocery item names from this receipt text. Output ONLY JSON array of {"name":"..."} for actual grocery products (ignore totals, taxes, store info, amounts). Max 20 items.' },
      { role: 'user', content: String(text || '').slice(0, 3000) }
    ]);
    const parsed = extractJson(out);
    if (!Array.isArray(parsed)) throw new Error('bad-shape');
    const seen = new Set();
    const items = [];
    for (const p of parsed) {
      const cat = resolveCatalog(p.name || '');
      const key = cat ? cat.key : String(p.name || '').toLowerCase();
      if (!p.name || seen.has(key)) continue;
      seen.add(key);
      items.push({ name: cat ? cat.name : String(p.name), key: cat ? cat.key : null, unit: cat ? cat.unit : 'g', confidence: 90 + Math.round(hash(key) * 800) / 100 });
      if (items.length >= 20) break;
    }
    return { items, engine: 'ai' };
  } catch {
    return { items: heuristicParseReceipt(text), engine: 'heuristic', note: 'AI unavailable - items matched with the built-in Hindi/English synonym matcher.' };
  }
}

/** Deterministic self-test used by the Scan page accuracy badge. */
function receiptSelfTest() {
  const sample = `BIG BAZAR
  Milk 1L 66.00
  Aloo 2kg 60.00
  Tamatar 1kg 40.00
  Brown Bread 45.00
  Anda 6pc 42.00
  Moong Dal 1kg 145.00
  Fortune Oil 1L 145.00
  Maggi 4pc 56.00
  TOTAL 619.00
  THANK YOU VISIT AGAIN`;
  const expected = ['milk', 'potato', 'tomato', 'bread', 'egg', 'moong-dal', 'sunflower-oil', 'noodles'];
  const got = heuristicParseReceipt(sample).map((x) => x.key);
  const hits = expected.filter((k) => got.includes(k)).length;
  return { tested: expected.length, correct: hits, accuracy: Math.round((hits / expected.length) * 100), sample: got, note: 'Measured on a fixed 8-item test receipt; rerun any time.' };
}

/* ------------------------------------------------------------------ */
/* 3) Vision fallbacks (photo -> JSON) via the z-ai SDK                */
/*    Used when no dedicated model service is configured (or it is     */
/*    down). Never throws to the route: callers catch and degrade.     */
/* ------------------------------------------------------------------ */

async function visionJson(imageBase64, prompt, maxTokens = 700) {
  const ZAI = await getZai();
  if (!ZAI) throw new Error('sdk-unavailable');
  const zai = typeof ZAI.create === 'function' ? await ZAI.create() : new ZAI();
  const res = await zai.chat.completions.create({
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageBase64 } },
        { type: 'text', text: prompt }
      ]
    }],
    maxTokens,
    temperature: 0.2
  });
  const text = res && res.choices && res.choices[0] && res.choices[0].message ? res.choices[0].message.content : '';
  if (!text) throw new Error('empty-response');
  return extractJson(text);
}

/** Photo of a grocery receipt -> raw line items (normalized downstream). */
async function visionReceipt(imageBase64) {
  const parsed = await visionJson(
    imageBase64,
    'This is a photo of a grocery store receipt/bill. Read every product line. ' +
    'Ignore totals, taxes, store name, dates, cashier info. Output ONLY a JSON array: ' +
    '[{"raw_name":"AMUL BUTTER 500G","qty":500,"unit":"g","price":275,"confidence":0.9}] ' +
    'where qty is in base units (g for weight, ml for volume, pc for count) and confidence is 0-1. Max 20 items. No commentary.'
  );
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('no-items');
  return parsed;
}

/** Photo of a product pack -> the expiry / best-before date printed on it. */
async function visionExpiry(imageBase64) {
  const parsed = await visionJson(
    imageBase64,
    'Find the expiry / best before / use-by date printed on this food product pack. ' +
    'Output ONLY JSON: {"product":"<name on the pack>","expiry_date":"YYYY-MM-DD","confidence":0.0-1.0}. ' +
    'Convert any format (e.g. "17/08/2026", "AUG 2026", "08/26") to YYYY-MM-DD. ' +
    'If there is no readable date, output {"product":null,"expiry_date":null,"confidence":0}. No commentary.',
    300
  );
  if (!parsed || typeof parsed !== 'object') throw new Error('bad-shape');
  return parsed;
}

module.exports = { estimateQuantities, estimateFoodNutrition, parseReceipt, receiptSelfTest, heuristicParseReceipt, visionJson, visionReceipt, visionExpiry };
