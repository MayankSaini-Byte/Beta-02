/**
 * Members routes - household members with roles (admin / member).
 * Serves the multi-user / flatmates bonus: who lives here, who can change what.
 */
const express = require('express');
const auth = require('../middleware/auth');
const { asyncH, httpError } = require('../middleware/errors');
const { logActivity } = require('../services/activityService');
const crypto = require('crypto');

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
  if (!b.name) throw httpError(400, 'Name is required');
  const user = await getUser(req);
  const member = {
    id: crypto.randomUUID(),
    name: String(b.name).trim(),
    role: ['admin', 'member'].includes(b.role) ? b.role : 'member',
    type: ['adult', 'child'].includes(b.type) ? b.type : 'adult',
    calorieTarget: Math.max(800, Number(b.calorieTarget) || (b.type === 'child' ? 1500 : 2000))
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
  const members = (user.members || []).map((m) => {
    if (m.id !== req.params.id) return m;
    return {
      ...m,
      name: b.name !== undefined ? String(b.name).trim() : m.name,
      role: ['admin', 'member'].includes(b.role) ? b.role : m.role,
      type: ['adult', 'child'].includes(b.type) ? b.type : m.type,
      calorieTarget: b.calorieTarget !== undefined ? Math.max(800, Number(b.calorieTarget) || m.calorieTarget) : m.calorieTarget
    };
  });
  await req.db.col('users').updateOne({ _id: user._id }, { members });
  res.json({ members });
}));

// DELETE /api/members/:id
router.delete('/:id', asyncH(async (req, res) => {
  const user = await getUser(req);
  const members = (user.members || []).filter((m) => m.id !== req.params.id);
  await req.db.col('users').updateOne({ _id: user._id }, { members });
  res.json({ ok: true, members });
}));

module.exports = router;
