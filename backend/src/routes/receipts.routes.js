/**
 * Scan & Detect routes - the two phone-camera features:
 *
 *   1. Receipt scanner   photo -> model service -> standard JSON -> review -> confirm -> stock
 *   2. Expiry checker    photo -> model service -> expiry date -> review -> confirm -> item expiry
 *
 * Principles (matching the review notes):
 *   - The phone is the scanner: <input type="file" accept="image/*" capture="environment">
 *   - Nothing changes without approval: /scan returns a REVIEW payload, /confirm applies it.
 *   - Duplicate protection: sha256 of the image - scanning the same bill twice
 *     never doubles the stock.
 *   - Failure handling: model down / blurry photo / nothing detected -> an honest
 *     "Couldn't read this receipt" payload. Never a crash, never invented items.
 */
const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const env = require('../config/env');
const { callModel } = require('../services/modelClient');
const receiptSvc = require('../services/receiptService');
const { logActivity } = require('../services/activityService');
const { todayISO, addDaysISO, daysUntil } = require('../utils/dates');
const { smartQty } = require('../utils/units');
const { resolveCatalog } = require('../utils/text');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }
});
router.use(auth);

/* ------------------------------------------------------------------ */
/* 1) RECEIPT SCANNER                                                  */
/* ------------------------------------------------------------------ */

// POST /api/receipts/scan  (multipart field "receipt", or JSON {text})
router.post('/scan', upload.single('receipt'), asyncH(async (req, res) => {
  const file = req.file;
  const text = String((req.body && req.body.text) || '').trim();
  if (!file && !text) throw httpError(400, 'Send a receipt photo (multipart field "receipt") or receipt text');

  const receipts = req.db.col('receipts');
  const pantryItems = await req.db.col('pantries').find({ ownerId: req.userId });
  const contentHash = file ? receiptSvc.hashBuffer(file.buffer) : receiptSvc.hashBuffer(Buffer.from(text));

  // duplicate protection - the same bill must never double the stock
  const prev = await receipts.findOne({ ownerId: req.userId, hash: contentHash });
  if (prev) {
    return res.json({
      ok: true,
      duplicate: true,
      receiptId: prev._id,
      engine: prev.engine,
      items: prev.items || [],
      message: prev.status === 'confirmed'
        ? 'This receipt was already scanned and confirmed - stock was not changed again.'
        : 'This receipt was already scanned - showing the earlier review.'
    });
  }

  let rawItems = [];
  let engine = 'model';
  let receiptMetadata = null;
  let note = '';
  let ok = true;

  if (file) {
    // 1st choice: the dedicated Python/FastAPI model service (MODEL_SERVICE_URL)
    const modelRes = await callModel('/predict', file.buffer, file.originalname, file.mimetype, 'receipt');
    if (modelRes.ok && Array.isArray(modelRes.data.items) && modelRes.data.items.length) {
      rawItems = modelRes.data.items;
      receiptMetadata = modelRes.data.receipt || null;
      engine = modelRes.data.engine || 'PaddleOCR PP-OCRv5 mobile (CPU)';
    } else {
      // Receipt photos contain private shopping data. Keep image OCR local:
      // no external vision API fallback when the local PaddleOCR service fails.
      ok = false;
      note = modelRes.ok
        ? (modelRes.data.error || 'The local OCR engine found no grocery items.')
        : 'Start the local PaddleOCR model service and install its pretrained models once.';
    }
  } else {
    // Text review uses the local deterministic parser too. Receipt contents
    // never leave this installation for any external AI service.
    rawItems = receiptSvc.parseReceiptText(text).map((r) => ({ raw_name: r.raw_name, qty: r.qty, unit: r.unit, price: r.price }));
    engine = 'text-local';
  }

  if (!ok || !rawItems.length) {
    // Failure handling: never crash, never invent items.
    return res.json({
      ok: false,
      message: "Couldn't read this receipt. Retake the photo in good light, or add the items manually below.",
      hint: note || 'Blurry or angled photos are the usual cause. You can also paste the receipt text instead.'
    });
  }

  const items = receiptSvc.matchItems(rawItems, pantryItems);
  if (!items.length) {
    return res.json({ ok: false, message: "Couldn't read this receipt. Retake, or add items manually." });
  }

  const doc = await receipts.insertOne({
    ownerId: req.userId,
    hash: contentHash,
    engine,
    status: 'scanned',
    source: file ? 'photo' : 'text',
    receipt: receiptMetadata,
    items,
    note,
    createdAt: new Date().toISOString()
  });

  await logActivity(req.db, req.userId, { action: 'added', target: 'Receipt scan', detail: `${items.length} item(s) extracted - awaiting review`, icon: 'receipt' });

  res.json({
    ok: true,
    receiptId: doc._id,
    engine,
    items,
    receipt: doc.receipt || null,
    note,
    reviewNote: 'Review the list - fix quantities and untick anything the scan got wrong. Nothing is added until you confirm.'
  });
}));

// POST /api/receipts/demo - runs a receipt through the exact same normalize/
// match pipeline as a photo (unit parse -> fuzzy match -> review), deterministically.
// Optional body {text} scans a custom receipt (unique hash per test run).
router.post('/demo', asyncH(async (req, res) => {
  const text = String((req.body && req.body.text) || '') || receiptSvc.DEMO_TEXT;
  const pantryItems = await req.db.col('pantries').find({ ownerId: req.userId });
  const raw = receiptSvc.parseReceiptText(text);
  const items = receiptSvc.matchItems(raw, pantryItems);
  const hash = receiptSvc.hashBuffer(Buffer.from(text + (req.userId || '')));
  const prev = await req.db.col('receipts').findOne({ ownerId: req.userId, hash });
  if (prev) {
    return res.json({ ok: true, duplicate: true, receiptId: prev._id, engine: prev.engine, items: prev.items, message: 'This receipt was already scanned - showing the earlier review.' });
  }
  const doc = await req.db.col('receipts').insertOne({
    ownerId: req.userId, hash, engine: 'demo', status: 'scanned', source: 'demo', items, note: '', createdAt: new Date().toISOString()
  });
  res.json({ ok: true, receiptId: doc._id, engine: 'demo', items, reviewNote: 'Same pipeline as a real photo: unit parse -> fuzzy match -> review -> confirm.' });
}));

// POST /api/receipts/confirm { receiptId, items: [...] } -> stock updated
router.post('/confirm', asyncH(async (req, res) => {
  const b = req.body || {};
  const chosen = (b.items || []).filter((i) => i && i.checked !== false);
  if (!chosen.length) throw httpError(400, 'Tick at least one item to add');

  const receipts = req.db.col('receipts');
  let receipt = null;
  if (b.receiptId) {
    receipt = await receipts.findOne({ _id: b.receiptId, ownerId: req.userId });
    if (receipt && receipt.status === 'confirmed' && !b.force) {
      throw httpError(409, 'This receipt was already confirmed - stock was not changed twice.');
    }
  }

  const { added, mergedCount } = await receiptSvc.confirmItems(req.db, req.userId, chosen);
  if (receipt) {
    // keep the ORIGINAL review payload (with confidences) - only flip status
    await receipts.updateOne({ _id: receipt._id }, { status: 'confirmed', confirmedAt: new Date().toISOString() });
  }

  res.json({
    ok: true,
    added: added.length,
    merged: mergedCount,
    items: added,
    message: `${added.length} item(s) added to stock${mergedCount ? `, ${mergedCount} merged into existing items` : ''}.`
  });
}));

// GET /api/receipts/accuracy - measured accuracy badge for the Scan page
router.get('/accuracy', asyncH(async (req, res) => {
  res.json(receiptSvc.receiptSelfTest());
}));

/* ------------------------------------------------------------------ */
/* 2) EXPIRY DATE CHECKER (image capture)                              */
/* ------------------------------------------------------------------ */

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** Parse the date formats packs actually print: 17/08/2026, 17-08-26, AUG 2026, 08/26, 2026-08-17 */
function parseExpiryDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s);
  if (m) {
    // Indian packs print DD/MM/YYYY
    let y = +m[3]; if (y < 100) y += 2000;
    return iso(y, +m[2], +m[1]);
  }
  m = /^([a-z]{3,4})[\s\-]?(\d{4})$/i.exec(s);
  if (m) { const mo = MONTHS[m[1].toLowerCase()]; if (mo) return iso(+m[2], mo, 1); }
  m = /^(\d{1,2})[\/\-](\d{2,4})$/.exec(s);
  if (m) { let y = +m[2]; if (y < 100) y += 2000; return iso(y, +m[1], 1); }
  const d = new Date(s);
  return isNaN(d) ? null : iso(d.getFullYear(), d.getMonth() + 1, d.getDate());

  function iso(y, mo, d) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2099) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
}

// POST /api/receipts/expiry/scan  (multipart field "photo")
router.post('/expiry/scan', upload.single('photo'), asyncH(async (req, res) => {
  const file = req.file;
  if (!file) throw httpError(400, 'Send a product photo (multipart field "photo")');

  let result = null;
  let engine = 'model';

  // 1st choice: the model service
  const modelRes = await callModel('/expiry', file.buffer, file.originalname, file.mimetype, 'photo');
  if (modelRes.ok && modelRes.data) {
    result = modelRes.data;
  } else {
    // 2nd choice: z-ai vision
    const ai = require('../services/aiService');
    const b64 = `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
    try {
      result = await ai.visionExpiry(b64);
      engine = 'ai-vision';
    } catch {
      result = null;
    }
  }

  const expiryDate = result ? parseExpiryDate(result.expiry_date || result.expiryDate) : null;
  let confidence = result ? Number(result.confidence) : NaN;
  if (!Number.isFinite(confidence) || confidence <= 0) confidence = expiryDate ? 0.8 : 0;
  if (confidence > 1) confidence = confidence / 100;

  if (!expiryDate) {
    // Failure handling: say so, offer retake or manual entry. Never guess a date.
    return res.json({
      ok: false,
      needsManual: true,
      message: "Couldn't read the expiry date in this photo. Retake it closer and in focus, or type the date below.",
      engine
    });
  }

  const productName = result && result.product ? String(result.product).slice(0, 60) : null;
  const cat = productName ? resolveCatalog(productName) : null;

  res.json({
    ok: true,
    engine,
    productName: cat ? cat.name : productName,
    key: cat ? cat.key : null,
    expiryDate,
    confidence: Math.round(confidence * 1000) / 1000,
    lowConfidence: confidence < 0.7,
    daysLeft: daysUntil(expiryDate),
    note: 'Review before applying - the date lands on the item you pick below.'
  });
}));

// POST /api/receipts/expiry/confirm { itemId? | name?, category?, quantity?, unit?, expiryDate }
router.post('/expiry/confirm', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!b.expiryDate) throw httpError(400, 'expiryDate is required');
  const expiryDate = parseExpiryDate(b.expiryDate);
  if (!expiryDate) throw httpError(400, 'That date could not be parsed (use YYYY-MM-DD or DD/MM/YYYY)');

  const pantries = req.db.col('pantries');
  let item = null;
  if (b.itemId) {
    item = await pantries.findOne({ _id: b.itemId, ownerId: req.userId });
    if (!item) throw httpError(404, 'Stock item not found');
    item = await pantries.updateOne({ _id: item._id }, { expiryDate, expirySource: 'scanned', updatedAt: new Date().toISOString() });
  } else {
    const name = String(b.name || '').trim();
    if (!name) throw httpError(400, 'Pick an existing item or type a product name');
    const cat = resolveCatalog(name);
    const existing = (await pantries.find({ ownerId: req.userId })).find(
      (p) => (cat && p.key === cat.key) || p.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      item = await pantries.updateOne({ _id: existing._id }, { expiryDate, expirySource: 'scanned', updatedAt: new Date().toISOString() });
    } else {
      const qty = Number(b.quantity) || (cat && cat.unit === 'pc' ? 1 : 1000);
      const unit = b.unit || (cat ? cat.unit : 'g');
      item = await pantries.insertOne({
        ownerId: req.userId,
        key: cat ? cat.key : null,
        name: cat ? cat.name : name,
        category: cat ? cat.category : b.category || 'other',
        quantity: qty,
        unit,
        threshold: cat ? Math.max(1, Math.round(cat.unit === 'g' || cat.unit === 'ml' ? 250 : 1)) : 1,
        capacity: Math.max(qty * 1.25, 750),
        expiryDate,
        expirySource: 'scanned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  await req.db.col('auditlogs').insertOne({
    ownerId: req.userId, itemId: item._id, name: item.name,
    before: item.expiryDate, after: expiryDate, delta: null, unit: 'date',
    reason: 'Expiry date set from photo scan', type: 'adjust', at: new Date().toISOString()
  });
  await logActivity(req.db, req.userId, {
    action: 'changed', target: item.name,
    detail: `Expiry date set to ${expiryDate} (${daysUntil(expiryDate)} days left) from a photo scan`, icon: 'clock'
  });

  res.json({
    ok: true,
    item,
    reminder: { expiryDate, remindOn: addDaysISO(expiryDate, -7) },
    message: `${item.name}: expiry set to ${expiryDate} - you'll be reminded 1 week before (${addDaysISO(expiryDate, -7)}).`
  });
}));

module.exports = router;
