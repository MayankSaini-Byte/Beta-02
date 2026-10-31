const express = require('express');
const auth = require('../middleware/auth');
const { asyncH } = require('../middleware/errors');
const { summarize } = require('../services/analyticsService');
const { shape } = require('../services/activityService');

const router = express.Router();
router.use(auth);

// GET /api/analytics/summary
router.get('/summary', asyncH(async (req, res) => {
  const [user, pantryItems, auditlogs, reconciliations] = await Promise.all([
    req.db.col('users').findOne({ _id: req.userId }),
    req.db.col('pantries').find({ ownerId: req.userId }),
    req.db.col('auditlogs').find({ ownerId: req.userId }, { sort: { at: -1 }, limit: 300 }),
    req.db.col('reconciliations').find({ ownerId: req.userId }, { sort: { at: -1 }, limit: 12 })
  ]);
  const summary = summarize(user, pantryItems, auditlogs);
  summary.accuracyHistory = reconciliations
    .map((r) => ({ at: r.at, accuracy: r.accuracy, checked: r.checked }))
    .reverse();
  res.json(summary);
}));

// GET /api/analytics/logs - recent audit trail
router.get('/logs', asyncH(async (req, res) => {
  const logs = await req.db.col('auditlogs').find({ ownerId: req.userId }, { sort: { at: -1 }, limit: 50 });
  res.json({ logs });
}));

// GET /api/analytics/activity - "who did what" feed (flatmates bonus)
router.get('/activity', asyncH(async (req, res) => {
  const logs = await req.db.col('activitylogs').find({ ownerId: req.userId }, { sort: { at: -1 }, limit: 40 });
  res.json({ activity: logs.map(shape) });
}));

module.exports = router;
