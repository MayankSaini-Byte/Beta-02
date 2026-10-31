const express = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');

const router = express.Router();
router.use(auth);

async function requireBusiness(req) {
  const user = await req.db.col('users').findOne({ _id: req.userId });
  if (!user) throw httpError(401, 'User not found');
  const type = user.accountType || (user.household?.kitchenType === 'commercial' ? 'commercial' : user.household?.kitchenType === 'hostel' ? 'service' : 'household');
  if (!['commercial', 'service'].includes(type)) throw httpError(403, 'Vendor restocking is for commercial and food-service profiles');
  return user;
}

router.get('/', asyncH(async (req, res) => {
  await requireBusiness(req);
  const vendors = await req.db.col('vendors').find({ ownerId: req.userId });
  res.json({ vendors: vendors.sort((a, b) => a.name.localeCompare(b.name)) });
}));

router.post('/', asyncH(async (req, res) => {
  await requireBusiness(req);
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (!name || !phone) throw httpError(400, 'Vendor name and WhatsApp phone are required');
  if (!/[0-9]{7,15}/.test(phone.replace(/\D/g, ''))) throw httpError(400, 'Enter a valid phone number with country code');
  const vendor = await req.db.col('vendors').insertOne({ id: crypto.randomUUID(), ownerId: req.userId, name, phone, notes: String(req.body?.notes || '').trim(), createdAt: new Date().toISOString() });
  res.status(201).json({ vendor });
}));

router.patch('/:id', asyncH(async (req, res) => {
  await requireBusiness(req);
  const vendors = req.db.col('vendors');
  const existing = await vendors.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!existing) throw httpError(404, 'Vendor not found');
  const name = req.body?.name === undefined ? existing.name : String(req.body.name).trim();
  const phone = req.body?.phone === undefined ? existing.phone : String(req.body.phone).trim();
  if (!name || !phone || !/[0-9]{7,15}/.test(phone.replace(/\D/g, ''))) throw httpError(400, 'Enter a vendor name and valid WhatsApp phone number');
  const vendor = await vendors.updateOne({ _id: existing._id }, { name, phone, notes: req.body?.notes === undefined ? existing.notes : String(req.body.notes).trim() });
  res.json({ vendor });
}));

router.delete('/:id', asyncH(async (req, res) => {
  await requireBusiness(req);
  const vendors = req.db.col('vendors');
  const vendor = await vendors.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!vendor) throw httpError(404, 'Vendor not found');
  await vendors.deleteOne({ _id: vendor._id, ownerId: req.userId });
  res.json({ ok: true });
}));

module.exports = router;
