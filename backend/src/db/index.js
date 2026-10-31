/**
 * DB layer - one tiny collection API, three interchangeable drivers:
 *
 *   const db = await initDB();
 *   const users = db.col('users');
 *   await users.findOne({ email });
 *   ...
 *
 * Selection order:
 *   1. MONGO_URI set          -> mongoDriver  (MongoDB via Mongoose models) - PERSISTENT
 *   2. KS_DEMO_MEMORY=1       -> memoryDriver (zero-config demo, resets on restart)
 *   3. otherwise              -> fileDriver   (JSON store on disk)          - PERSISTENT
 *
 * All documents expose `_id` as a plain string to the routes, so all drivers behave identically.
 */

const env = require('../config/env');
const seedRunner = require('./seedRunner');

let instance = null;

async function initDB() {
  if (instance) return instance;

  if (env.MONGO_URI) {
    try {
      const mongo = require('./mongoDriver');
      await mongo.connect(env.MONGO_URI);
      instance = { kind: 'mongo', col: (name) => mongo.collection(name) };
      console.log('[db] Connected to MongoDB (Mongoose models). Data persists.');
    } catch (err) {
      console.error('[db] MongoDB connection failed:', err.message);
      console.error('[db] Falling back to the persistent file store. Fix MONGO_URI and restart to use MongoDB.');
    }
  }

  if (!instance && env.DEMO_MEMORY) {
    const memory = require('./memoryDriver');
    memory.connect();
    instance = { kind: 'memory', col: (name) => memory.collection(name) };
    console.log('[db] KS_DEMO_MEMORY=1 -> in-memory demo store (resets on restart).');
  }

  if (!instance) {
    const file = require('./fileDriver');
    file.connect();
    instance = { kind: 'file', col: (name) => file.collection(name) };
    if (!env.MONGO_URI) {
      console.log('[db] MONGO_URI not set -> persistent file store at', file.DATA_PATH);
    }
  }

  await seedRunner.seed(instance);
  return instance;
}

module.exports = { initDB };
