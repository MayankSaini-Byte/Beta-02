require('dotenv').config();

const path = require('path');

const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGO_URI: (process.env.MONGO_URI || '').trim(),
  DEMO_MEMORY: process.env.KS_DEMO_MEMORY === '1',
  FILE_DB_PATH: process.env.KS_FILE_DB || '',
  JWT_SECRET: process.env.JWT_SECRET || 'kitchensync-dev-secret-change-me-in-production',
  JWT_EXPIRES: process.env.JWT_EXPIRES || '7d',
  OFF_TIMEOUT_MS: parseInt(process.env.OFF_TIMEOUT_MS || '2500', 10),
  FRONTEND_DIST: process.env.FRONTEND_DIST || '',
  // Local OCR model service (Python/FastAPI - see model-service/). Receipt photos
  // are forwarded only to this same-machine service with a hard timeout.
  MODEL_SERVICE_URL: (process.env.MODEL_SERVICE_URL || '').trim(),
  MODEL_TIMEOUT_MS: parseInt(process.env.MODEL_TIMEOUT_MS || '60000', 10),
  // Shared secret the ESP32 load-cell firmware sends in the x-device-key header
  DEVICE_KEY: process.env.DEVICE_KEY || 'secret-device-key'
};

env.FILE_DB_PATH = env.FILE_DB_PATH
  ? path.resolve(env.FILE_DB_PATH)
  : path.resolve(__dirname, '../../../db/kitchensync-store.json');

env.FRONTEND_DIST_PATH = env.FRONTEND_DIST
  ? path.resolve(env.FRONTEND_DIST)
  : path.resolve(__dirname, '../../../frontend/dist');

module.exports = env;
