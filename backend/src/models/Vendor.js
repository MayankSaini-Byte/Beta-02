/** Supplier contact owned by a restaurant, cloud kitchen, cafe, PG or tiffin service. */
const { Schema } = require('mongoose');

const VendorSchema = new Schema({
  ownerId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  notes: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { minimize: false });

module.exports = { VendorSchema };
