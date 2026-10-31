/**
 * Per-serving nutrition (grams) for the base 23-recipe library.
 * Values are standard nutritional estimates for home-cooked Indian portions
 * (per serving, matching the kcal already stored on each recipe).
 * New recipes carry their nutrition inline; this map is merged in recipes.js.
 */
const NUTRITION = {
  'poha':                { protein: 6,  carbs: 48, fat: 9,  fiber: 3 },
  'aloo-paratha':        { protein: 10, carbs: 55, fat: 17, fiber: 5 },
  'masala-dosa':         { protein: 8,  carbs: 52, fat: 11, fiber: 3 },
  'upma':                { protein: 7,  carbs: 46, fat: 10, fiber: 4 },
  'dal-tadka':           { protein: 14, carbs: 42, fat: 9,  fiber: 7 },
  'rajma-masala':        { protein: 16, carbs: 52, fat: 10, fiber: 11 },
  'chole':               { protein: 15, carbs: 50, fat: 9,  fiber: 10 },
  'paneer-butter-masala':{ protein: 16, carbs: 30, fat: 34, fiber: 4 },
  'palak-paneer':        { protein: 15, carbs: 22, fat: 24, fiber: 5 },
  'aloo-gobhi':          { protein: 6,  carbs: 38, fat: 15, fiber: 6 },
  'bhindi-masala':       { protein: 5,  carbs: 26, fat: 17, fiber: 6 },
  'veg-pulao':           { protein: 8,  carbs: 60, fat: 12, fiber: 4 },
  'veg-biryani':         { protein: 11, carbs: 72, fat: 18, fiber: 6 },
  'khichdi':             { protein: 12, carbs: 48, fat: 8,  fiber: 5 },
  'pav-bhaji':           { protein: 11, carbs: 62, fat: 20, fiber: 8 },
  'masala-maggi':        { protein: 9,  carbs: 48, fat: 13, fiber: 3 },
  'grilled-sandwich':    { protein: 11, carbs: 46, fat: 15, fiber: 4 },
  'curd-rice':           { protein: 8,  carbs: 48, fat: 7,  fiber: 2 },
  'hakka-noodles':       { protein: 10, carbs: 62, fat: 14, fiber: 5 },
  'tomato-rasam':        { protein: 5,  carbs: 22, fat: 4,  fiber: 3 },
  'egg-bhurji':          { protein: 18, carbs: 8,  fat: 24, fiber: 1 },
  'chicken-curry':       { protein: 32, carbs: 12, fat: 28, fiber: 2 },
  'masala-chai':         { protein: 3,  carbs: 12, fat: 3,  fiber: 0 }
};

module.exports = NUTRITION;
