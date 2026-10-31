/**
 * PantryItem model - one physical quantity of a grocery item in the kitchen.
 * `quantity` is ALWAYS in the base unit (g | ml | pc); display/pricing converts.
 */
const { Schema } = require('mongoose');

const PantryItemSchema = new Schema(
  {
    ownerId: { type: String, index: true },
    key: { type: String, default: null }, // catalog key (null for custom items)
    name: { type: String, required: true },
    category: { type: String, default: 'other' },
    quantity: { type: Number, default: 0 }, // base unit
    unit: { type: String, default: 'g' },   // g | ml | pc
    threshold: { type: Number, default: 0 },
    capacity: { type: Number, default: 0 },
    expiryDate: { type: String, default: null }, // ISO yyyy-mm-dd
    expirySource: { type: String, enum: ['entered', 'scanned', 'estimated', 'recorded'], default: 'recorded' },
    addedBy: { type: String, default: 'owner' }, // activity log / flatmates bonus
    createdAt: { type: String },
    updatedAt: { type: String }
  },
  { minimize: false }
);

module.exports = { PantryItemSchema };
