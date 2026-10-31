/** Daily food log used to subtract outside meals from a household member's targets. */
const { Schema } = require('mongoose');

const DietLogSchema = new Schema({
  ownerId: { type: String, required: true, index: true },
  memberId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  name: { type: String, required: true },
  calories: { type: Number, min: 0, required: true },
  protein: { type: Number, min: 0, default: 0 },
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], default: 'dinner' },
  source: { type: String, enum: ['outside', 'home'], default: 'outside' },
  isEstimated: { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { minimize: false });

module.exports = { DietLogSchema };
