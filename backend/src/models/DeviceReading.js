/** DeviceReading model - authenticated weight and environment time-series. */
const { Schema } = require('mongoose');

const DeviceReadingSchema = new Schema(
  {
    ownerId: { type: String, index: true },
    deviceId: { type: String, index: true },
    sensorId: { type: String, default: '' }, // external device_id, when available
    grams: { type: Number, required: true }, // gross grams; device tare is applied by the server
    stable: { type: Boolean, default: false },
    temperatureC: { type: Number, default: null },
    humidityPercent: { type: Number, default: null },
    readingId: { type: String, default: '' },
    source: { type: String, enum: ['simulator', 'physical'], default: 'simulator' },
    at: { type: String, index: true }
  },
  { minimize: false }
);

DeviceReadingSchema.index({ ownerId: 1, deviceId: 1, at: -1 });
DeviceReadingSchema.index({ deviceId: 1, readingId: 1 });

module.exports = { DeviceReadingSchema };
