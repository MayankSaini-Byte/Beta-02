const fs = require('fs');
const path = require('path');
const express = require('express');
const env = require('./config/env');
const { initDB } = require('./db');
const { createApp } = require('./app');

async function main() {
  const db = await initDB();
  if (db.kind === 'mongo') {
    console.log('[db] Connected to MongoDB (Mongoose). Data persists.');
  } else {
    console.log('[db] MONGO_URI not set -> running in DEMO MODE with an in-memory seeded store.');
    console.log('[db] Demo login: demo@kitchensync.app / demo1234. Data resets on restart.');
  }

  const app = createApp(db);

  // Serve the built React frontend (single-origin deployment)
  const dist = env.FRONTEND_DIST_PATH;
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    // SPA fallback: every non-API GET returns index.html
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
    console.log('[static] Serving frontend build from', dist);
  } else {
    console.log('[static] No frontend build found at', dist, '(API-only mode). Run: npm --prefix ../frontend run build');
  }

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[server] KitchenSync website and API listening on http://0.0.0.0:${env.PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] Port ${env.PORT} already in use - another KitchenSync instance is probably running. Exiting quietly.`);
      process.exit(0);
    }
    throw err;
  });
}

main().catch((err) => {
  console.error('[fatal] Failed to start KitchenSync:', err);
  process.exit(1);
});
