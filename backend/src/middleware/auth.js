const jwt = require('jsonwebtoken');
const env = require('../config/env');

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/**
 * Bearer-token auth. Attaches `req.userId` on success.
 * Rejects tokens whose subject is not a valid Mongo ObjectId (e.g. tokens
 * minted by an older store) so the client re-authenticates cleanly.
 */
module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated. Please login.' });
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload.sub || !OBJECT_ID_RE.test(String(payload.sub))) {
      return res.status(401).json({ error: 'Session format changed. Please login again.' });
    }
    req.userId = payload.sub;
    req.userEmail = payload.email;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }
};
