const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const pantryRoutes = require('./routes/pantry.routes');
const freshnessRoutes = require('./routes/freshness.routes');
const recipeRoutes = require('./routes/recipes.routes');
const plannerRoutes = require('./routes/planner.routes');
const shoppingRoutes = require('./routes/shopping.routes');
const receiptRoutes = require('./routes/receipts.routes');
const scaleRoutes = require('./routes/scale.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationRoutes = require('./routes/notifications.routes');
const deviceRoutes = require('./routes/devices.routes');
const memberRoutes = require('./routes/members.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const dietRoutes = require('./routes/diet.routes');
const vendorRoutes = require('./routes/vendors.routes');
const messRoutes = require('./routes/mess.routes');
const { apiNotFound, errorHandler } = require('./middleware/errors');

function createApp(db) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));
  app.use((req, res, next) => {
    req.db = db;
    next();
  });

  // Simple health probe (no auth)
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, app: 'KitchenSync API', version: '1.1.0', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/pantry', pantryRoutes);
  app.use('/api/freshness', freshnessRoutes);
  app.use('/api/recipes', recipeRoutes);
  app.use('/api/planner', plannerRoutes);
  app.use('/api/shopping', shoppingRoutes);
  app.use('/api/receipts', receiptRoutes);
  app.use('/api/scale', scaleRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/members', memberRoutes);
  app.use('/api/diet', dietRoutes);
  app.use('/api/vendors', vendorRoutes);
  app.use('/api/mess-menu', messRoutes);

  app.use('/api', apiNotFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
