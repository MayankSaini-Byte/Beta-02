/** DeviceReading model - weight time-series for one sensor (grams, net of tare). */
const { Schema } = require('mongoose');

const DeviceReadingSchema = new Schema(
  {
    ownerId: { type: String, index: true },
    deviceId: { type: String, index: true },
    grams: { type: Number, required: true }, // net grams
    at: { type: String }
  },
  { minimize: false }
);

module.exports = { DeviceReadingSchema };
