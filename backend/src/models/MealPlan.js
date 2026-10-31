/**
 * MealPlan model - one week of planned meals.
 * Each meal slot: { key, locked?, done?, doneAt?, deductions?: [{key,name,qty,unit,display,clamped}] }
 * - locked  : Re-optimize must not change this slot
 * - done    : meal was cooked; ingredients were deducted from stock (idempotent)
 * - deductions: what was actually deducted (shown to user, restorable via Undo)
 */
const { Schema } = require('mongoose');

const MealPlanSchema = new Schema(
  {
    ownerId: { type: String, index: true },
    weekKey: { type: String }, // start date of the plan (first planned day)
    days: { type: [Schema.Types.Mixed], default: [] },
    summary: { type: Schema.Types.Mixed, default: {} },
    generatedAt: { type: String }
  },
  { minimize: false }
);

module.exports = { MealPlanSchema };
