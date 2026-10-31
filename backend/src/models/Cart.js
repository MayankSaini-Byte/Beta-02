/** Cart model - simulated quick-commerce cart/order (Instamart, Blinkit, ...). */
const { Schema } = require('mongoose');

const CartSchema = new Schema(
  {
    ownerId: { type: String, index: true },
    providerId: String,
    providerName: String,
    items: { type: [Schema.Types.Mixed], default: [] },
    subtotal: Number,
    fee: Number,
    total: Number,
    savings: Number,
    etaMin: Number,
    status: { type: String, default: 'active' }, // active | ordered | received
    orderId: { type: String, default: null },
    createdAt: { type: String },
    orderedAt: { type: String, default: null }
  },
  { minimize: false }
);

module.exports = { CartSchema };
