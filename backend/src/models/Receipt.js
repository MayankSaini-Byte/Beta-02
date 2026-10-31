/** Receipt scan document - duplicate protection + review-before-apply trail. */
const mongoose = require('mongoose');

const ReceiptSchema = new mongoose.Schema(
  {
    ownerId: { type: String, index: true },
    // sha256 of the image bytes (or text content) - scanning the same bill
    // twice must never double the stock
    hash: { type: String, index: true },
    engine: { type: String, default: 'model' }, // model | ai-vision | text-ai | text-heuristic | demo
    status: { type: String, enum: ['scanned', 'confirmed'], default: 'scanned' },
    source: { type: String, default: 'photo' }, // photo | text | demo
    items: { type: mongoose.Schema.Types.Mixed, default: [] },
    note: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date }
  },
  { minimize: false }
);

module.exports = { ReceiptSchema };
