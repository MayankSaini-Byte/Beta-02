/**
 * Text matching: maps free-text item names to catalog keys using
 * exact / synonym / substring matching (Hindi + English names).
 */
const CATALOG = require('../data/catalog');

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');

const byKey = new Map(CATALOG.map((c) => [c.key, c]));
const byName = new Map();
const bySyn = new Map();

for (const item of CATALOG) {
  byName.set(norm(item.name), item);
  for (const syn of item.synonyms || []) bySyn.set(norm(syn), item);
}

/** Resolve a free-text name to a catalog item (or null for custom items). */
function resolveCatalog(name) {
  const n = norm(name);
  if (!n) return null;
  if (byKey.has(n)) return byKey.get(n);
  if (byName.has(n)) return byName.get(n);
  if (bySyn.has(n)) return bySyn.get(n);
  // substring match both directions
  for (const item of CATALOG) {
    const itemName = norm(item.name);
    if (itemName.includes(n) || n.includes(itemName)) return item;
    for (const syn of item.synonyms || []) {
      const s = norm(syn);
      if (s === n || (s.length > 3 && (s.includes(n) || n.includes(s)))) return item;
    }
  }
  return null;
}

/** Deterministic small hash for seeded pseudo-random numbers */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

module.exports = { norm, resolveCatalog, hash, CATALOG };
