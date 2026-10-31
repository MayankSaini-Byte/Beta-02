/**
 * Unit handling. Base units: g (weight), ml (volume), pc (count).
 * Recipe/pantry quantities are always normalized to base units for comparison;
 * display/pricing converts back to commercial units (kg / L / pc).
 */

const TO_BASE = { g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], pc: ['pc', 1] };

function toBase(qty, unit) {
  const entry = TO_BASE[unit] || TO_BASE.pc;
  return qty * entry[1];
}

function baseUnit(unit) {
  return (TO_BASE[unit] || TO_BASE.pc)[0];
}

/** Convert a base-unit quantity to its commercial unit (kg / l / pc) */
function toCommercial(qty, base) {
  if (base === 'g') return { qty: qty / 1000, unit: 'kg' };
  if (base === 'ml') return { qty: qty / 1000, unit: 'L' };
  return { qty, unit: 'pc' };
}

/** Human display: 1500 g -> "1.5 kg", 500 g -> "500 g" */
function smartQty(qty, unit) {
  if (unit === 'g' && qty >= 1000) return `${round1(qty / 1000)} kg`;
  if (unit === 'ml' && qty >= 1000) return `${round1(qty / 1000)} L`;
  return `${Math.round(qty * 100) / 100} ${unit}`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function inr(n) {
  return Math.round(n);
}

module.exports = { toBase, baseUnit, toCommercial, smartQty, round1, inr };
