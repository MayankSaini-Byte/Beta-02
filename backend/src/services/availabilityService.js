/**
 * Ingredient availability engine:
 * - fuzzy-matches recipe ingredients against pantry stock (catalog keys + synonyms)
 * - computes coverage, missing list and alternate-ingredient suggestions
 * - scales quantities to the household (adult = 1.0 portion, child = 0.5 portion)
 */
const CATALOG = require('../data/catalog');
const { toBase } = require('../utils/units');

const byKey = new Map(CATALOG.map((c) => [c.key, c]));

function portionFactor(household) {
  if (household && ['hostel', 'commercial'].includes(household.kitchenType) && Number(household.residents) > 0) {
    return Math.min(5000, Number(household.residents));
  }
  const rawAdults = Number(household && household.adults);
  const adults = Number.isFinite(rawAdults) ? rawAdults : 1;
  const children = Number(household && household.children) || 0;
  return Math.max(0.5, adults + children * 0.5);
}

/**
 * @param {Array} ingredients  recipe ingredients [{key, qty, unit}]
 * @param {Map} stockMap       Map(catalogKey -> {qty in base unit, unit})
 * @param {Number} factor      portion multiplier
 */
function checkIngredients(ingredients, stockMap, factor) {
  const rows = ingredients.map((ing) => {
    const cat = byKey.get(ing.key);
    const need = toBase(ing.qty * factor, ing.unit);
    const have = stockMap.get(ing.key) ? stockMap.get(ing.key).qty : 0;
    const ratio = need > 0 ? have / need : 1;
    let status = 'missing';
    if (ratio >= 1) status = 'have';
    else if (have > 0) status = 'partial';

    let alternate = null;
    if (status !== 'have' && cat && cat.alternates && cat.alternates.length) {
      const altKey = cat.alternates[0];
      const altCat = byKey.get(altKey);
      if (altCat) alternate = { key: altCat.key, name: altCat.name, inStock: (stockMap.get(altKey)?.qty || 0) > 0 };
    }

    return {
      key: ing.key,
      name: cat ? cat.name : ing.key,
      need,
      needDisplay: ing.qty * factor,
      unit: ing.unit,
      have,
      status,
      alternate
    };
  });

  const coverage = rows.length
    ? Math.round((rows.reduce((s, r) => s + Math.min(1, r.need > 0 ? r.have / r.need : 1), 0) / rows.length) * 100)
    : 0;

  return { rows, coverage };
}

/** Build stockMap from pantry item docs (only items matched to a catalog key) */
function stockMapFrom(pantryItems) {
  const map = new Map();
  for (const p of pantryItems) {
    if (!p.key) continue;
    const cur = map.get(p.key) || { qty: 0, unit: p.unit };
    cur.qty += Number(p.quantity) || 0;
    map.set(p.key, cur);
  }
  return map;
}

module.exports = { portionFactor, checkIngredients, stockMapFrom };
