/**
 * Latest load-cell reading per device (id = hardware id, legacy default "scale1").
 * The ESP32 firmware POSTs here every ~0.5 s; the browser only ever READS this,
 * so the value applied to stock is the server's own latest reading and can
 * neither be faked by the client nor go stale unnoticed.
 */
const mongoose = require('mongoose');

const ScaleStateSchema = new mongoose.Schema(
  {
    _id: { type: String }, // device id, e.g. "scale1"
    deviceId: { type: String, default: '' },
    grams: { type: Number, default: 0 },
    stable: { type: Boolean, default: false },
    temperatureC: { type: Number, default: null },
    humidityPercent: { type: Number, default: null },
    readingId: { type: String, default: '' },
    source: { type: String, enum: ['simulator', 'physical'], default: 'physical' },
    timestamp: { type: String, default: '' },
    ts: { type: Number, default: 0 }, // epoch ms of the last accepted reading
    readings: { type: Number, default: 0 }, // accepted readings count
    rejected: { type: Number, default: 0 } // implausible readings rejected
  },
  { minimize: false }
);

module.exports = { ScaleStateSchema };
