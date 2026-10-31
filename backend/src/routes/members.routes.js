/**
 * Members routes - household members with roles (admin / member).
 * Serves the multi-user / flatmates bonus: who lives here, who can change what.
 */
const express = require('express');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const { logActivity } = require('../services/activityService');
const crypto = require('crypto');
const DIETS = ['inherit', 'veg', 'egg', 'nonveg', 'vegan', 'jain', 'custom'];

function cleanAllergies(values) {
  if (Array.isArray(values)) return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].slice(0, 30);
  if (typeof values === 'string') return [...new Set(values.split(',').map((value) => value.trim()).filter(Boolean))].slice(0, 30);
  return [];
}

const router = express.Router();
router.use(auth);

async function getUser(req) {
  const user = await req.db.col('users').findOne({ _id: req.userId });
  if (!user) throw httpError(401, 'User not found');
  return user;
}

// GET /api/members
router.get('/', asyncH(async (req, res) => {
  const user = await getUser(req);
  res.json({ members: user.members || [], me: { id: user._id, name: user.name, role: 'admin', email: user.email } });
}));

// POST /api/members { name, role, type, calorieTarget }
router.post('/', asyncH(async (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) throw httpError(400, 'Name is required');
  const user = await getUser(req);
  const member = {
    id: crypto.randomUUID(),
    name: String(b.name).trim(),
    role: ['admin', 'member'].includes(b.role) ? b.role : 'member',
    type: ['adult', 'child'].includes(b.type) ? b.type : 'adult',
    diet: DIETS.includes(b.diet) ? b.diet : 'inherit',
    allergies: cleanAllergies(b.allergies),
    calorieTarget: Math.max(800, Number(b.calorieTarget) || (b.type === 'child' ? 1500 : 2000)),
    proteinTarget: Math.max(0, Number(b.proteinTarget) || 75)
  };
  const members = [...(user.members || []), member];
  await req.db.col('users').updateOne({ _id: user._id }, { members });
  await logActivity(req.db, req.userId, { actor: member.name, action: 'added', target: member.name, detail: `Joined the kitchen as ${member.role} (${member.type})`, icon: 'users' });
  res.status(201).json({ member, members });
}));

// PATCH /api/members/:id { name?, role?, type?, calorieTarget? }
router.patch('/:id', asyncH(async (req, res) => {
  const user = await getUser(req);
  const b = req.body || {};
  const existing = (user.members || []).find((m) => m.id === req.params.id);
  if (!existing) throw httpError(404, 'Member not found');
  if (b.name !== undefined && !String(b.name).trim()) throw httpError(400, 'Member name cannot be empty');
  const members = (user.members || []).map((m) => {
    if (m.id !== req.params.id) return m;
    return {
      ...m,
      name: b.name !== undefined ? String(b.name).trim() : m.name,
      role: ['admin', 'member'].includes(b.role) ? b.role : m.role,
      type: ['adult', 'child'].includes(b.type) ? b.type : m.type,
      diet: DIETS.includes(b.diet) ? b.diet : m.diet || 'inherit',
      allergies: b.allergies !== undefined ? cleanAllergies(b.allergies) : m.allergies || [],
      calorieTarget: b.calorieTarget !== undefined ? Math.max(800, Number(b.calorieTarget) || m.calorieTarget) : m.calorieTarget,
      proteinTarget: b.proteinTarget !== undefined ? Math.max(0, Number(b.proteinTarget) || 0) : m.proteinTarget || 75
    };
  });
  await req.db.col('users').updateOne({ _id: user._id }, { members });
  res.json({ members });
}));

// DELETE /api/members/:id
router.delete('/:id', asyncH(async (req, res) => {
  const user = await getUser(req);
  const before = user.members || [];
  const members = before.filter((m) => m.id !== req.params.id);
  if (members.length === before.length) throw httpError(404, 'Member not found');
  await req.db.col('users').updateOne({ _id: user._id }, { members });
  res.json({ ok: true, members });
}));

module.exports = router;
