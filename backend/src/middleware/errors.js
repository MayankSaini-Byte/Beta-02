/** 404 for unknown /api routes */
exports.apiNotFound = (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
};

/** Central error handler - keeps JSON error shape consistent */
// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  console.error('[error]', err.message);
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate record already exists.' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid id format.' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
};

/** Wraps async route handlers so rejected promises hit errorHandler */
exports.asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Throws 4xx errors */
exports.httpError = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};
