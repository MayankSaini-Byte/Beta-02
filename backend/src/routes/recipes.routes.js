const express = require('express');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const { checkIngredients, stockMapFrom, portionFactor } = require('../services/availabilityService');
const { smartQty } = require('../utils/units');
const { logActivity } = require('../services/activityService');
const { estimateQuantities } = require('../services/aiService');
const { resolveCatalog } = require('../utils/text');
const { toCommercial } = require('../utils/units');
const { basePriceFor } = require('../services/priceService');
const { householdRecipeAllows } = require('../services/plannerService');
const crypto = require('crypto');

const router = express.Router();
router.use(auth);

async function ctx(req) {
  const [user, pantryItems, recipes] = await Promise.all([
    req.db.col('users').findOne({ _id: req.userId }),
    req.db.col('pantries').find({ ownerId: req.userId }),
    req.db.col('recipes').find({})
  ]);
  const stock = stockMapFrom(pantryItems);
  return { user, stock, recipes, factor: portionFactor(user.household) };
}

function youtubeUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Cost of the missing ingredients for a recipe at household factor (sanity-capped) */
function missingCost(rows) {
  return Math.min(rows
    .filter((r) => r.status !== 'have')
    .reduce((s, r) => {
      const comm = toCommercial(Math.max(0, r.need - r.have), r.unit);
      return s + basePriceFor(r.key) * comm.qty;
    }, 0), 5000);
}

// GET /api/recipes?q=&diet=&meal=&cookable=1&gym=1&sort=
router.get('/', asyncH(async (req, res) => {
  const { user, stock, recipes, factor } = await ctx(req);
  const q = String(req.query.q || '').toLowerCase();
  const diet = req.query.diet;
  const meal = req.query.meal;
  const cuisine = String(req.query.cuisine || '').trim().toLowerCase();
  const cookableOnly = req.query.cookable === '1';
  const gymOnly = req.query.gym === '1';
  const sort = req.query.sort;
  const favorites = new Set(user.favorites || []);

  let list = recipes.map((r) => {
    const check = checkIngredients(r.ingredients, stock, factor);
    const protein = (r.nutrition && r.nutrition.protein) || 0;
    return {
      key: r.key, name: r.name, cuisine: r.cuisine, diet: r.diet, meal: r.meal,
      timeMin: r.timeMin, kcal: r.kcal, rating: r.rating, ratingLabel: 'editorial',
      taste: r.taste, tags: r.tags,
      nutrition: r.nutrition || { protein: 0, carbs: 0, fat: 0, fiber: 0 },
      protein,
      source: r.source || 'library',
      favorite: favorites.has(r.key),
      availability: {
        coverage: check.coverage,
        haveCount: check.rows.filter((x) => x.status === 'have').length,
        totalCount: check.rows.length,
        missingCount: check.rows.filter((x) => x.status !== 'have').length
      }
    };
  });

  if (q) list = list.filter((r) => r.name.toLowerCase().includes(q) || (r.tags || []).some((t) => t.includes(q)) || r.cuisine.toLowerCase().includes(q));
  if (cuisine) list = list.filter((r) => r.cuisine.toLowerCase().includes(cuisine) || (r.tags || []).some((tag) => tag.toLowerCase().replace(/-/g, ' ').includes(cuisine)));
  if (diet === 'veg') list = list.filter((r) => r.diet === 'veg');
  if (diet === 'egg') list = list.filter((r) => ['veg', 'egg'].includes(r.diet));
  if (diet === 'nonveg') list = list.filter((r) => ['veg', 'egg', 'nonveg'].includes(r.diet));
  if (diet === 'jain') list = list.filter((r) => r.diet === 'veg' && !(r.ingredients || []).some((ingredient) => ['onion', 'garlic', 'ginger', 'ginger-garlic-paste', 'potato', 'sweet-potato', 'carrot', 'beetroot', 'radish'].includes(ingredient.key)));
  if (diet === 'vegan') list = list.filter((r) => r.diet === 'veg' && !(r.ingredients || []).some((ingredient) => ['milk', 'curd', 'paneer', 'butter', 'cheese', 'ghee', 'yogurt'].includes(ingredient.key)));
  if (meal) list = list.filter((r) => (r.meal || []).includes(meal));
  if (req.query.compatible === '1') {
    const selectedMember = (user.members || []).find((member) => member.id === String(req.query.memberId || ''));
    const compatibleMembers = selectedMember ? [selectedMember] : (user.members || []);
    const compatibleKeys = new Set(recipes.filter((recipe) => householdRecipeAllows(user.household || {}, recipe, compatibleMembers)).map((recipe) => recipe.key));
    list = list.filter((recipe) => compatibleKeys.has(recipe.key));
  }
  if (cookableOnly) list = list.filter((r) => r.availability.coverage >= 95);
  if (gymOnly) list = list.filter((r) => (r.tags || []).includes('gym') || (r.tags || []).includes('high-protein'));

  if (sort === 'protein') list.sort((a, b) => b.protein - a.protein);
  else list.sort((a, b) => b.availability.coverage - a.availability.coverage || b.protein - a.protein || b.rating - a.rating);

  // Gym corner: macro summary across the filtered set
  const gym = {
    mode: !!gymOnly,
    goal: (user.household && user.household.goal) || 'none',
    proteinMedian: list.length ? [...list.map((r) => r.protein)].sort((a, b) => a - b)[Math.floor(list.length / 2)] : 0,
    hint: 'Sort by protein to build a cut/bulk day: pick 1 breakfast + 1 lunch + 1 dinner above the median.'
  };

  res.json({ factor, count: list.length, recipes: list, gym });
}));

// GET /api/recipes/gym - dedicated gym-friendly endpoint (goal-aware)
router.get('/gym', asyncH(async (req, res) => {
  const { user, stock, recipes, factor } = await ctx(req);
  const goal = req.query.goal || (user.household && user.household.goal) || 'cut';
  const proteinMin = Number(req.query.proteinMin) || (goal === 'bulk' ? 25 : goal === 'cut' ? 20 : 15);
  const favorites = new Set(user.favorites || []);

  const pool = recipes.filter((r) => (r.tags || []).includes('gym') || (r.nutrition && r.nutrition.protein >= proteinMin));
  const list = pool.map((r) => {
    const check = checkIngredients(r.ingredients, stock, factor);
    const n = r.nutrition || {};
    return {
      key: r.key, name: r.name, diet: r.diet, meal: r.meal, timeMin: r.timeMin, kcal: r.kcal,
      nutrition: n, protein: n.protein || 0, carbs: n.carbs || 0, fat: n.fat || 0, fiber: n.fiber || 0,
      tags: r.tags, favorite: favorites.has(r.key),
      proteinPer100: Math.round(((n.protein || 0) / Math.max(1, r.kcal)) * 1000) / 10, // g protein per 100 kcal
      coverage: check.coverage
    };
  });

  list.sort((a, b) => goal === 'bulk'
    ? b.protein - a.protein || b.kcal - a.kcal
    : b.proteinPer100 - a.proteinPer100 || b.protein - a.protein);

  res.json({
    goal,
    proteinMin,
    advice: goal === 'bulk'
      ? 'Bulking: prioritise total protein + calories. Rice/paneer/milk-based picks help you hit surplus.'
      : goal === 'maintain'
        ? 'Maintenance: spread protein across 3 meals (~0.8-1 g per kg body weight per day).'
        : 'Cutting: prioritise protein density (g per 100 kcal) and fiber to stay full.',
    recipes: list
  });
}));

// POST /api/recipes/estimate - AI (with heuristic fallback) quantity estimation
router.post('/estimate', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.name) throw httpError(400, 'Recipe name is required');
  const result = await estimateQuantities({
    name: b.name,
    ingredients: Array.isArray(b.ingredients) ? b.ingredients : [],
    servings: b.servings || 2,
    diet: b.diet || 'veg'
  });
  res.json(result);
}));

// POST /api/recipes - add a recipe (user/AI-assisted) to the library
router.post('/', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) throw httpError(400, 'Recipe name is required');
  if (!Array.isArray(b.ingredients) || !b.ingredients.some((i) => String(i.name || '').trim())) throw httpError(400, 'At least one named ingredient is required');

  const { user, recipes } = await ctx(req);
  const norm = String(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let key = norm || `custom-${Date.now()}`;
  let n = 2;
  while (recipes.some((r) => r.key === key)) key = `${norm}-${n++}`;

  const ingredients = b.ingredients.filter((i) => String(i.name || '').trim()).slice(0, 25).map((i) => {
    const qty = Number(i.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw httpError(400, `Enter a valid quantity for ${String(i.name).trim()}`);
    const cat = (i.key && recipes && null) || resolveCatalog(i.name || '');
    const unit = ['g', 'ml', 'pc'].includes(i.unit) ? i.unit : cat ? cat.unit : 'g';
    return {
      key: i.key || (cat ? cat.key : null),
      name: cat ? cat.name : String(i.name || 'item'),
      qty,
      unit,
      estimated: !!i.estimated
    };
  });

  const created = await req.db.col('recipes').insertOne({
    key,
    name: String(b.name).trim(),
    cuisine: b.cuisine || 'Home Kitchen',
    diet: ['veg', 'egg', 'nonveg'].includes(b.diet) ? b.diet : 'veg',
    meal: Array.isArray(b.meal) && b.meal.length ? b.meal : ['lunch'],
    timeMin: Math.max(5, Number(b.timeMin) || 30),
    baseServings: Math.max(1, Number(b.baseServings || b.servings) || 2),
    kcal: Math.max(50, Number(b.kcal) || 300),
    nutrition: {
      protein: Math.max(0, Number((b.nutrition || {}).protein) || 0),
      carbs: Math.max(0, Number((b.nutrition || {}).carbs) || 0),
      fat: Math.max(0, Number((b.nutrition || {}).fat) || 0),
      fiber: Math.max(0, Number((b.nutrition || {}).fiber) || 0)
    },
    taste: Array.isArray(b.taste) ? b.taste.slice(0, 5) : [],
    tags: Array.isArray(b.tags) ? b.tags.slice(0, 6) : ['custom'],
    rating: 4.3,
    source: 'custom',
    createdBy: user.name || 'You',
    ingredients,
    steps: Array.isArray(b.steps) ? b.steps.filter(Boolean).slice(0, 12) : [],
    yt: b.yt || `${b.name} recipe`
  });

  await logActivity(req.db, req.userId, { action: 'added', target: created.name, detail: 'New recipe added to the library', icon: 'book' });
  res.status(201).json({ recipe: { ...created, _id: undefined, id: created._id }, youtubeUrl: youtubeUrl(created.yt) });
}));

// GET /api/recipes/favorites
router.get('/favorites', asyncH(async (req, res) => {
  const { user, stock, recipes, factor } = await ctx(req);
  const favs = new Set(user.favorites || []);
  const list = recipes.filter((r) => favs.has(r.key)).map((r) => {
    const check = checkIngredients(r.ingredients, stock, factor);
    return { key: r.key, name: r.name, rating: r.rating, timeMin: r.timeMin, coverage: check.coverage };
  });
  res.json({ recipes: list });
}));

// POST /api/recipes/:key/favorite  { on: true|false }
router.post('/:key/favorite', asyncH(async (req, res) => {
  const users = req.db.col('users');
  const user = await users.findOne({ _id: req.userId });
  const recipe = await req.db.col('recipes').findOne({ key: req.params.key });
  if (!recipe) throw httpError(404, 'Recipe not found');
  const set = new Set(user.favorites || []);
  const on = req.body && req.body.on !== undefined ? !!req.body.on : !set.has(recipe.key);
  if (on) set.add(recipe.key); else set.delete(recipe.key);
  await users.updateOne({ _id: user._id }, { favorites: [...set] });
  res.json({ key: recipe.key, favorite: on });
}));

// GET /api/recipes/:key - full detail, scaled to household, with availability + alternates
router.get('/:key', asyncH(async (req, res) => {
  const { user, stock, recipes, factor } = await ctx(req);
  const recipe = recipes.find((r) => r.key === req.params.key);
  if (!recipe) throw httpError(404, 'Recipe not found');

  const check = checkIngredients(recipe.ingredients, stock, factor);
  const favorites = new Set(user.favorites || []);

  res.json({
    recipe: {
      key: recipe.key,
      name: recipe.name,
      cuisine: recipe.cuisine,
      diet: recipe.diet,
      meal: recipe.meal,
      timeMin: recipe.timeMin,
      kcal: recipe.kcal,
      rating: recipe.rating,
      ratingLabel: 'editorial',
      source: recipe.source || 'library',
      createdBy: recipe.createdBy || null,
      taste: recipe.taste,
      tags: recipe.tags,
      nutrition: recipe.nutrition || { protein: 0, carbs: 0, fat: 0, fiber: 0 },
      steps: recipe.steps,
      youtubeUrl: youtubeUrl(recipe.yt || recipe.name + ' recipe')
    },
    servings: {
      base: recipe.baseServings,
      forHousehold: Math.round(factor * 10) / 10,
      factor,
      household: user.household
    },
    ingredients: check.rows.map((r) => ({
      ...r,
      needDisplay: smartQty(r.need, r.unit),
      haveDisplay: smartQty(r.have, r.unit)
    })),
    availability: {
      coverage: check.coverage,
      haveCount: check.rows.filter((x) => x.status === 'have').length,
      totalCount: check.rows.length,
      missingCount: check.rows.filter((x) => x.status !== 'have').length,
      missingKeys: check.rows.filter((x) => x.status !== 'have').map((x) => ({ key: x.key, name: x.name, need: x.need, unit: x.unit, have: x.have, alternate: x.alternate }))
    }
  });
}));

module.exports = router;
