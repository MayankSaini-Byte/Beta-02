const jwt = require('jsonwebtoken');
const env = require('../config/env');

const USER_ID_RE = /^(?:[a-f0-9]{24}|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})$/i;

/**
 * Bearer-token auth. Attaches `req.userId` on success.
 * Accept Mongo ObjectIds and UUIDs, which are the IDs used by the Mongo,
 * file, and memory stores respectively.
 */
module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated. Please login.' });
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload.sub || !USER_ID_RE.test(String(payload.sub))) {
      return res.status(401).json({ error: 'Session format changed. Please login again.' });
    }
    req.userId = payload.sub;
    req.userEmail = payload.email;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }
};
