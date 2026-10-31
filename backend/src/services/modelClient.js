/**
 * Client for the local OCR model service (Python/FastAPI - see model-service/).
 *
 * The Node backend never parses pixels itself: it forwards the image bytes with a
 * hard timeout and normalizes whatever comes back into the standard JSON format.
 * If the local service is down / slow / returns garbage, the receipt route
 * shows an honest failure card. Receipt photos are never sent to cloud OCR.
 *
 * Expected endpoints on the model service:
 *   POST /predict         multipart field "receipt" -> { items: [{ raw_name, name, qty, unit, price, confidence }] }
 *   POST /expiry          multipart field "photo"   -> { product, expiry_date, confidence }
 *   GET  /health
 */
const env = require('../config/env');

async function callModel(path, buffer, filename, mime, field = 'receipt', timeoutMs) {
  if (!env.MODEL_SERVICE_URL) return { ok: false, reason: 'no-model-service' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || env.MODEL_TIMEOUT_MS);
  try {
    const fd = new FormData();
    fd.append(field, new Blob([buffer], { type: mime || 'image/jpeg' }), filename || 'upload.jpg');
    const res = await fetch(`${env.MODEL_SERVICE_URL.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      body: fd,
      signal: ctrl.signal
    });
    if (!res.ok) return { ok: false, reason: `model-http-${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: e && e.name === 'AbortError' ? 'model-timeout' : 'model-unreachable' };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { callModel };
