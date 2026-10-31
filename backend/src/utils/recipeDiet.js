const JAIN_AVOID = new Set([
  'onion', 'shallot', 'leek', 'garlic', 'ginger', 'ginger-garlic-paste',
  'potato', 'sweet-potato', 'carrot', 'beetroot', 'radish', 'turnip',
  'yam', 'taro', 'arbi', 'cassava', 'parsnip', 'lotus-root', 'water-chestnut'
]);

const EGG_INGREDIENTS = new Set(['egg', 'eggs', 'egg-white', 'egg-yolk']);
const MEAT_INGREDIENTS = new Set([
  'chicken', 'chicken-breast', 'mutton', 'lamb', 'goat', 'beef', 'pork',
  'bacon', 'ham', 'sausage', 'turkey', 'duck', 'fish', 'prawn', 'prawns',
  'shrimp', 'crab', 'lobster', 'seafood', 'anchovy', 'gelatin', 'lard'
]);
const VEGAN_AVOID = new Set([
  ...EGG_INGREDIENTS, ...MEAT_INGREDIENTS,
  'milk', 'curd', 'dahi', 'yogurt', 'yoghurt', 'paneer', 'butter', 'cheese',
  'ghee', 'cream', 'whey', 'casein', 'honey', 'ghee', 'milk-powder', 'gelatin'
]);
const PLANT_MILK_PREFIXES = ['almond', 'oat', 'soy', 'soya', 'coconut', 'cashew', 'rice', 'pea', 'hemp'];

function ingredientTokens(recipe) {
  return (recipe.ingredients || []).flatMap((ingredient) => [ingredient.key, ingredient.name])
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
}

function hasIngredient(recipe, blocked) {
  return ingredientTokens(recipe).some((token) => {
    if (PLANT_MILK_PREFIXES.some((prefix) => token === `${prefix}-milk`)) return false;
    return token.split('-').some((part) => blocked.has(part)) || blocked.has(token);
  });
}

function recipeMatchesDiet(recipe, preference) {
  const diet = String(preference || '').toLowerCase();
  if (!diet || diet === 'custom') return true;

  const recipeType = String(recipe.diet || 'veg').toLowerCase();
  const hasMeat = recipeType === 'nonveg' || hasIngredient(recipe, MEAT_INGREDIENTS);
  const hasEgg = recipeType === 'egg' || hasIngredient(recipe, EGG_INGREDIENTS);
  const vegetarian = !hasMeat && !hasEgg;

  if (diet === 'nonveg') return true;
  if (diet === 'egg') return !hasMeat;
  if (diet === 'veg') return vegetarian;
  if (diet === 'vegan') return vegetarian && !hasIngredient(recipe, VEGAN_AVOID);
  if (diet === 'jain') return vegetarian && !hasIngredient(recipe, JAIN_AVOID);
  return true;
}

module.exports = { recipeMatchesDiet, JAIN_AVOID, VEGAN_AVOID };
