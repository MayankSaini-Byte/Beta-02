/**
 * Spins up an EPHEMERAL in-memory MongoDB on port 27017 (no installation needed).
 * Useful for local development without installing MongoDB.
 *   npm run dev:mongo   ->  prints MONGO_URI, keep this terminal open
 * Then in another terminal:  MONGO_URI=mongodb://127.0.0.1:27017/kitchensync npm start
 * First run downloads the MongoDB binary (~100 MB) automatically.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  console.log('Starting in-memory MongoDB (first run downloads a ~100MB binary)...');
  const mongod = await MongoMemoryServer.create({
    instance: { port: 27017, ip: '127.0.0.1', dbName: 'kitchensync' }
  });
  console.log('----------------------------------------------------------------');
  console.log('MongoDB (ephemeral) is running!');
  console.log('Use this MONGO_URI in backend/.env :');
  console.log('  ' + mongod.getUri('kitchensync'));
  console.log('----------------------------------------------------------------');
  console.log('Keep this process running. Press Ctrl+C to stop.');
  setInterval(() => {}, 1 << 30);
})().catch((err) => {
  console.error('Failed to start in-memory MongoDB:', err.message);
  process.exit(1);
});
