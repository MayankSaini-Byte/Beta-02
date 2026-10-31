/**
 * Fuzzy string matching (Dice coefficient over character bigrams).
 * Used to join receipt lines like "TOMATO LOCAL 1KG" to the existing stock
 * item "Tomato" and to the catalog - no external dependency needed.
 */

function bigrams(s) {
  const out = new Set();
  const t = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (t.length < 2) return out;
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  for (const w of t.split(' ')) if (w.length >= 2) out.add(w); // whole words weigh too
  return out;
}

/** Dice similarity in [0, 1]. */
function dice(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/**
 * Best candidate for a raw name.
 * candidates: [{ id, label, payload }] -> { id, score, payload } | null
 */
function bestMatch(rawName, candidates, minScore = 0.34) {
  let best = null;
  for (const c of candidates || []) {
    const score = dice(rawName, c.label);
    if (!best || score > best.score) best = { id: c.id, score, payload: c.payload };
  }
  return best && best.score >= minScore ? best : null;
}

module.exports = { dice, bestMatch, bigrams };
