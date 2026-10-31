/**
 * Recipe model - library + user-created recipes with full nutrition.
 * Ingredient quantities are for `baseServings` people; the API scales them to
 * the household (adult = 1.0 portion, child = 0.5 portion).
 * `nutrition` is per base serving: { protein, carbs, fat, fiber } in grams.
 * Custom/AI-added recipes flag estimated ingredient quantities (editable).
 */
const { Schema } = require('mongoose');

const RecipeSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    cuisine: String,
    diet: { type: String, default: 'veg' }, // veg | egg | nonveg
    meal: { type: [String], default: [] },  // breakfast | lunch | dinner | snack
    timeMin: Number,
    baseServings: { type: Number, default: 2 },
    kcal: Number,
    nutrition: {
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 }
    },
    taste: { type: [String], default: [] },
    tags: { type: [String], default: [] },  // e.g. 'gym', 'high-protein', 'quick'
    rating: { type: Number, default: 4.2 }, // editorial rating (labeled as such in UI)
    source: { type: String, default: 'library' }, // library | custom | ai
    createdBy: { type: String, default: null },
    ingredients: { type: [Schema.Types.Mixed], default: [] }, // {key, qty, unit, estimated?}
    steps: { type: [String], default: [] },
    yt: String
  },
  { minimize: false }
);

module.exports = { RecipeSchema };
