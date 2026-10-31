/**
 * Weekly meal planner optimizer (v2).
 *
 * Strategy (greedy with seeded tie-breaking so plans are stable):
 *   score = 2.0*stockCoverage + 0.8*tasteMatch + 1.1*usesExpiringItems
 *         + 0.7*varietyPenalty + 0.3*rating + tiny seeded randomness
 * After each pick, ingredients are virtually consumed so later days adapt.
 *
 * v2 behaviour:
 *  - plans start TODAY (never in the past); past days in an existing plan are
 *    kept for history but greyed out and excluded from "to buy"
 *  - locked meal slots survive re-optimization
 *  - every meal gets an explainer ("uses spinach - expiring in 2 days")
 *  - budget constraint: summary.budget reports fit/over + cheaper swap hints
 *  - mark-done deduction engine with clamping, shortfall flags and Undo support
 */
const { checkIngredients, stockMapFrom, portionFactor } = require('./availabilityService');
const { basePriceFor } = require('./priceService');
const CATALOG = require('../data/catalog');
const { hash } = require('../utils/text');
const { toBase, toCommercial } = require('../utils/units');
const { addDaysISO, dayLabel, daysUntil, todayISO } = require('../utils/dates');

const byKey = new Map(CATALOG.map((c) => [c.key, c]));
const SLOTS = ['breakfast', 'lunch', 'dinner'];
const MAX_LINE_COST = 3000; // rupees - anything above this per line is flagged implausible

function dietAllows(userDiet, recipeDiet) {
  if (userDiet === 'nonveg') return true;
  if (userDiet === 'egg') return recipeDiet === 'veg' || recipeDiet === 'egg';
  return recipeDiet === 'veg';
}

/** Reopt-friendly generation. Locked slots from an existing plan are preserved. */
function generateWeek({ user, pantryItems, recipes, startISO, days = 7, existingPlan = null }) {
  const hh = user.household || {};
  const tastes = new Set(hh.tastes || []);
  const stock = stockMapFrom(pantryItems);
  const usedCount = new Map();
  const seedBase = `${user._id}|${startISO}`;

  // Locked and completed slots, by date: { slot: recipeKey }
  const locked = new Map();
  if (existingPlan && Array.isArray(existingPlan.days)) {
    for (const d of existingPlan.days) {
      for (const slot of SLOTS) {
        const m = d.meals && d.meals[slot];
        if (m && (m.locked || m.done) && m.key) {
          if (!locked.has(d.date)) locked.set(d.date, {});
          locked.get(d.date)[slot] = m.key;
        }
      }
    }
  }

  const expiring = new Set();
  for (const p of pantryItems) {
    const d = daysUntil(p.expiryDate);
    if (p.key && d !== null && d <= 3 && d >= -1 && p.quantity > 0) expiring.add(p.key);
  }

  const planDays = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysISO(startISO, i);
    const meals = {};
    for (const slot of SLOTS) {
      const lockedKey = locked.get(date) && locked.get(date)[slot];
      if (lockedKey) {
        const r = recipes.find((x) => x.key === lockedKey);
        if (r) {
          usedCount.set(r.key, (usedCount.get(r.key) || 0) + 1);
          const previous = existingPlan.days.find((d) => d.date === date)?.meals?.[slot];
          meals[slot] = previous && previous.done
            ? { ...previous, key: r.key, locked: !!previous.locked }
            : { key: r.key, locked: true, done: false };
          if (!previous?.done) {
            for (const ing of r.ingredients) {
              const cur = stock.get(ing.key);
              if (cur) cur.qty = Math.max(0, cur.qty - toBase(ing.qty, ing.unit));
            }
          }
          continue;
        }
      }
      const candidates = recipes.filter((r) => (r.meal || []).includes(slot) && dietAllows(hh.diet || 'veg', r.diet));
      let best = null;
      let bestScore = -1;
      for (const r of candidates) {
        const check = checkIngredients(r.ingredients, stock, 1);
        const tasteMatch = r.taste.some((t) => tastes.has(t)) ? 1 : 0;
        const urgency = r.ingredients.filter((ing) => expiring.has(ing.key)).length / Math.max(1, r.ingredients.length);
        const variety = 1 - 0.45 * (usedCount.get(r.key) || 0);
        const score =
          2.0 * (check.coverage / 100) +
          0.8 * tasteMatch +
          1.1 * urgency +
          0.7 * variety +
          0.3 * (r.rating / 5) +
          0.08 * hash(`${seedBase}|${slot}|${i}|${r.key}`);
        if (score > bestScore) {
          bestScore = score;
          best = r;
        }
      }
      if (best) {
        usedCount.set(best.key, (usedCount.get(best.key) || 0) + 1);
        for (const ing of best.ingredients) {
          const cur = stock.get(ing.key);
          if (cur) cur.qty = Math.max(0, cur.qty - toBase(ing.qty, ing.unit));
        }
        meals[slot] = { key: best.key, locked: false };
      }
    }
    planDays.push({ date, label: dayLabel(date), meals });
  }

  return { weekKey: startISO, days: planDays, generatedAt: new Date().toISOString() };
}

/** Price sanity guard: flags implausible line costs caused by unit bugs. */
function sanityLine(name, estCost) {
  if (!Number.isFinite(estCost) || estCost <= 0) return { estCost: 0, flag: 'invalid' };
  if (estCost > MAX_LINE_COST) {
    return { estCost: MAX_LINE_COST, flag: 'implausible', note: `${name} would cost > ₹${MAX_LINE_COST} - quantity or unit looks off; estimate capped. Please check the item.` };
  }
  return { estCost: Math.round(estCost), flag: null };
}

/**
 * Recompute live coverage, per-meal explainers, missing items and weekly
 * shopping needs for a saved plan. Needs only include TODAY onwards and skip
 * meals already marked done.
 */
function decoratePlan(plan, user, pantryItems, recipes) {
  const hh = user.household || {};
  const factor = portionFactor(hh);
  const initial = stockMapFrom(pantryItems);
  const recipeByKey = new Map(recipes.map((r) => [r.key, r]));
  const today = todayISO();

  const expiring = new Map(); // key -> days left
  for (const p of pantryItems) {
    const d = daysUntil(p.expiryDate);
    if (p.key && d !== null && p.quantity > 0 && d <= 3 && d >= -1) expiring.set(p.key, d);
  }

  const needsAgg = new Map();
  let coverageSum = 0;
  let mealCount = 0;
  let pastMealCount = 0;

  const outDays = (plan.days || []).map((day) => {
    const isPast = day.date < today;
    const meals = {};
    for (const slot of SLOTS) {
      const m = day.meals && day.meals[slot];
      if (!m || !m.key) { meals[slot] = null; continue; }
      const recipe = recipeByKey.get(m.key);
      if (!recipe) { meals[slot] = null; continue; }

      const check = checkIngredients(recipe.ingredients, initial, factor);
      const missing = check.rows.filter((r) => r.status !== 'have');
      const missingKeys = missing.map((r) => ({ key: r.key, name: r.name, need: r.need, unit: r.unit, alternate: r.alternate }));

      const why = [];
      if (check.coverage >= 95) why.push(`Everything in stock (${check.coverage}% coverage)`);
      else if (check.coverage >= 60) why.push(`Mostly in stock (${check.coverage}%)`);
      else why.push(`Needs ${missingKeys.length} item(s) from the store (${check.coverage}% coverage)`);
      for (const ing of recipe.ingredients) {
        if (expiring.has(ing.key)) {
          const d = expiring.get(ing.key);
          why.push(`Uses ${byKey.get(ing.key) ? byKey.get(ing.key).name : ing.key} - expiring ${d < 0 ? 'today/tomorrow' : `in ${d} day${d === 1 ? '' : 's'}`} (use-first pick)`);
        }
      }
      if ((recipe.tags || []).includes('gym')) why.push(`Gym-friendly: ${recipe.nutrition ? recipe.nutrition.protein : '?'} g protein per serving`);
      if (recipe.taste.some((t) => (hh.tastes || []).includes(t))) why.push(`Matches your taste preference`);

      const stockChip = missing.length === 0 ? 'full' : missing.length < check.rows.length ? 'partial' : 'missing';

      if (!isPast && !m.done) {
        mealCount++;
        coverageSum += check.coverage;
        for (const row of check.rows) {
          const agg = needsAgg.get(row.key) || { key: row.key, need: 0 };
          agg.need += row.need;
          needsAgg.set(row.key, agg);
        }
      } else if (isPast) {
        pastMealCount++;
      }

      meals[slot] = {
        key: recipe.key,
        name: recipe.name,
        timeMin: recipe.timeMin,
        kcal: recipe.kcal,
        diet: recipe.diet,
        nutrition: recipe.nutrition || null,
        coverage: check.coverage,
        stockChip,
        missing: missing.map((r) => ({ name: r.name, alternate: r.alternate })),
        missingKeys,
        usesExpiring: recipe.ingredients.filter((ing) => expiring.has(ing.key)).map((ing) => (byKey.get(ing.key) || {}).name || ing.key),
        why,
        locked: !!m.locked,
        done: !!m.done,
        doneAt: m.doneAt || null,
        deductions: m.deductions || [],
        shortfall: m.shortfall || []
      };
    }
    return { date: day.date, label: day.label, isPast, meals };
  });

  const needs = [...needsAgg.values()].map((agg) => {
    const cat = byKey.get(agg.key);
    const unit = cat ? cat.unit : 'g';
    const have = initial.get(agg.key) ? initial.get(agg.key).qty : 0;
    const toBuy = Math.max(0, agg.need - have);
    const comm = toCommercial(toBuy, unit);
    const rawCost = basePriceFor(agg.key) * comm.qty;
    const sanity = sanityLine(cat ? cat.name : agg.key, rawCost);
    return {
      key: agg.key,
      name: cat ? cat.name : agg.key,
      category: cat ? cat.category : 'other',
      need: agg.need,
      have,
      toBuy,
      unit,
      buyDisplay: `${Math.round(comm.qty * 100) / 100} ${comm.unit}`,
      estCost: sanity.estCost,
      flag: sanity.flag,
      note: sanity.note || null
    };
  }).filter((n) => n.toBuy > 0).sort((a, b) => b.estCost - a.estCost);

  const totalCost = needs.reduce((s, n) => s + n.estCost, 0);
  const budget = Number(hh.weeklyBudget) || 1500;
  const budgetInfo = {
    budget,
    totalCost,
    fits: totalCost <= budget,
    pct: Math.min(999, Math.round((totalCost / budget) * 100)),
    message:
      totalCost <= budget
        ? `Plan fits budget - ₹${totalCost} of ₹${budget}`
        : `Over budget by ₹${totalCost - budget} (₹${totalCost} vs ₹${budget})`
  };

  // Cheaper swap suggestions when over budget: look at future days, try to find
  // an alternative recipe for the costliest slots that cuts missing-item cost.
  const cheaperSwaps = [];
  if (!budgetInfo.fits) {
    for (const day of outDays) {
      if (day.isPast) continue;
      for (const slot of SLOTS) {
        const m = day.meals[slot];
        if (!m || m.locked || m.done) continue;
        const recipe = recipeByKey.get(m.key);
        if (!recipe) continue;
        const candidates = recipes.filter((r) => (r.meal || []).includes(slot) && dietAllows(hh.diet || 'veg', r.diet) && r.key !== m.key);
        let bestAlt = null;
        for (const alt of candidates) {
          const altCheck = checkIngredients(alt.ingredients, initial, factor);
          const altMissingCost = altCheck.rows
            .filter((r) => r.status !== 'have')
            .reduce((s, r) => {
              const cat = byKey.get(r.key);
              const comm = toCommercial(Math.max(0, r.need - r.have), cat ? cat.unit : 'g');
              return s + basePriceFor(r.key) * comm.qty;
            }, 0);
          const curMissingCost = m.missingKeys.reduce((s, r) => {
            const cat = byKey.get(r.key);
            const comm = toCommercial(Math.max(0, r.need - r.have), cat ? cat.unit : 'g');
            return s + basePriceFor(r.key) * comm.qty;
          }, 0);
          if (altMissingCost < curMissingCost - 30 && (!bestAlt || altMissingCost < bestAlt.missingCost)) {
            bestAlt = { key: alt.key, name: alt.name, missingCost: altMissingCost };
          }
        }
        if (bestAlt) {
          const curCost = m.missingKeys.reduce((s, r) => {
            const cat = byKey.get(r.key);
            const comm = toCommercial(Math.max(0, r.need - r.have), cat ? cat.unit : 'g');
            return s + basePriceFor(r.key) * comm.qty;
          }, 0);
          cheaperSwaps.push({
            date: day.date, slot, from: recipe.name, to: bestAlt.name, toKey: bestAlt.key,
            saving: Math.round(curCost - bestAlt.missingCost),
            note: `Swap ${recipe.name} → ${bestAlt.name} on ${day.label} ${day.date.slice(5)} - saves about ₹${Math.round(curCost - bestAlt.missingCost)}`
          });
        }
        if (cheaperSwaps.length >= 3) break;
      }
      if (cheaperSwaps.length >= 3) break;
    }
  }

  return {
    weekKey: plan.weekKey,
    today,
    generatedAt: plan.generatedAt,
    days: outDays,
    summary: {
      avgCoverage: mealCount ? Math.round(coverageSum / mealCount) : 0,
      mealsPlanned: mealCount,
      pastMeals: pastMealCount,
      needs,
      totalCost,
      toBuyCount: needs.length,
      budget: budgetInfo,
      cheaperSwaps
    }
  };
}

/**
 * Compute what marking a meal "done" should deduct (does NOT mutate stock).
 * Clamps to available stock and flags shortfalls; units normalized to the
 * stock item's base unit.
 */
function computeDeductions(recipe, factor, pantryItems) {
  const stock = stockMapFrom(pantryItems);
  const deductions = [];
  const shortfall = [];
  for (const ing of recipe.ingredients) {
    const need = toBase(ing.qty * factor, ing.unit);
    const have = stock.get(ing.key) ? stock.get(ing.key).qty : 0;
    const cat = byKey.get(ing.key);
    const unit = cat ? cat.unit : ing.unit;
    const take = Math.min(need, have);
    const row = {
      key: ing.key,
      name: cat ? cat.name : ing.key,
      unit,
      need,
      have,
      take,
      display: `${Math.round(toCommercial(take, unit).qty * 100) / 100} ${toCommercial(take, unit).unit}`
    };
    if (take <= 0 && need > 0) {
      row.display = `0 ${toCommercial(0, unit).unit}`;
      shortfall.push({ key: ing.key, name: row.name, need, have });
    } else if (take < need) {
      shortfall.push({ key: ing.key, name: row.name, need, have });
    }
    if (take > 0) deductions.push(row);
  }
  return { deductions, shortfall };
}

module.exports = { generateWeek, decoratePlan, computeDeductions, sanityLine, SLOTS, MAX_LINE_COST };
