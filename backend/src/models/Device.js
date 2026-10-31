/**
 * Device model - IoT smart-container weight sensor (simulated hardware).
 * `gramsOffset` is the tare; readings report gross weight minus tare.
 */
const { Schema } = require('mongoose');

const DeviceSchema = new Schema(
  {
    ownerId: { type: String, index: true },
    name: { type: String, required: true },
    kind: { type: String, default: 'load-cell-container' },
    pantryItemId: { type: String, default: null },  // linked stock item
    linkedKey: { type: String, default: null },     // catalog key of linked item
    battery: { type: Number, default: 87 },         // %
    wifi: { type: String, default: 'home-wifi' },
    tareGrams: { type: Number, default: 0 },        // container empty weight
    lastSeen: { type: String, default: null },      // ISO datetime
    createdAt: { type: String }
  },
  { minimize: false }
);

module.exports = { DeviceSchema };
