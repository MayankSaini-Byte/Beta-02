/** ShoppingList model - saved list items (auto items are computed from pantry). */
const { Schema } = require('mongoose');

const ShoppingListSchema = new Schema(
  {
    ownerId: { type: String, index: true },
    items: { type: [Schema.Types.Mixed], default: [] }
  },
  { minimize: false }
);

module.exports = { ShoppingListSchema };
