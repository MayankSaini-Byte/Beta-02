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
    hardwareId: { type: String, default: '', index: true }, // device_id sent by the paired ESP32
    source: { type: String, enum: ['simulator', 'physical'], default: 'simulator' },
    pantryItemId: { type: String, default: null },  // linked stock item
    linkedKey: { type: String, default: null },     // catalog key of linked item
    battery: { type: Number, default: 87 },         // %
    wifi: { type: String, default: 'home-wifi' },
    tareGrams: { type: Number, default: 0 },        // container empty weight
    lastSeen: { type: String, default: null },      // ISO datetime
    lastReadingAt: { type: String, default: null },
    latestGrams: { type: Number, default: null },
    latestStable: { type: Boolean, default: false },
    latestTemperatureC: { type: Number, default: null },
    latestHumidityPercent: { type: Number, default: null },
    createdAt: { type: String }
  },
  { minimize: false }
);

module.exports = { DeviceSchema };
