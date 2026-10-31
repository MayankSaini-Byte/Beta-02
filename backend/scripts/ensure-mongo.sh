#!/bin/bash
# KitchenSync persistent MongoDB bootstrap (sandbox + local dev).
# Ensures a real mongod is running on 127.0.0.1:27017 with data on disk,
# so the API can use Mongoose models and data SURVIVES server restarts.
#
#   bash scripts/ensure-mongo.sh          # start if not running, wait until healthy
#
# Binary strategy: prefer the persistent copy in <project>/db/bin/mongod;
# fall back to the mongodb-memory-server cache, else download once via npx.
set -u

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"   # scripts -> backend -> kitchensync -> my-project
DB_DIR="$PROJECT_ROOT/db/mongo-data"
BIN_DIR="$PROJECT_ROOT/db/bin"
PORT="${KS_MONGO_PORT:-27017}"

mkdir -p "$DB_DIR" "$BIN_DIR"

healthy() {
  node -e "
    const http = require('http');
    const req = http.request({host:'127.0.0.1',port:$PORT,path:'/',method:'GET',timeout:700},(res)=>{res.resume();process.exit(0)});
    req.on('error',()=>process.exit(1));
    req.on('timeout',()=>{req.destroy();process.exit(1)});
    req.end();
  " 2>/dev/null
}

if healthy; then
  echo "[ensure-mongo] MongoDB already healthy on :$PORT"
  exit 0
fi

# locate a mongod binary
MONGOD=""
for cand in "$BIN_DIR/mongod" \
  "$(command -v mongod 2>/dev/null)" \
  "$(pwd)/node_modules/.cache/mongodb-memory-server/"mongod-* ; do
  if [ -n "$cand" ] && [ -x "$cand" ]; then MONGOD="$cand"; break; fi
done

if [ -z "$MONGOD" ]; then
  echo "[ensure-mongo] No mongod binary found - downloading once via mongodb-memory-server..."
  (npm ls mongodb-memory-server >/dev/null 2>&1 || npm ci --no-audit --no-fund --loglevel=error) \
    && node -e "
      const { MongoMemoryServer } = require('mongodb-memory-server');
      MongoMemoryServer.create({ instance: { port: $PORT, ip: '127.0.0.1', dbName: 'kitchensync' }, instanceOpts: { storageEngine: 'wiredTiger' } })
        .then(async (m) => { console.log('[ensure-mongo] downloaded:', m.getExePath()); await m.stop(); })
        .catch((e) => { console.error(e.message); process.exit(1); });
    "
  for cand in "$(pwd)/node_modules/.cache/mongodb-memory-server/"mongod-*; do
    if [ -x "$cand" ]; then MONGOD="$cand"; break; fi
  done
  [ -n "$MONGOD" ] && cp "$MONGOD" "$BIN_DIR/mongod" && chmod +x "$BIN_DIR/mongod" && MONGOD="$BIN_DIR/mongod"
fi

if [ -z "$MONGOD" ]; then
  echo "[ensure-mongo] FAILED to obtain mongod binary"
  exit 1
fi

echo "[ensure-mongo] Starting persistent MongoDB: $MONGOD (dbpath $DB_DIR)"
nohup "$MONGOD" \
  --dbpath "$DB_DIR" \
  --port "$PORT" \
  --bind_ip 127.0.0.1 \
  --wiredTigerCacheSizeGB 0.25 \
  --quiet > "$PROJECT_ROOT/db/mongod.log" 2>&1 &

for i in $(seq 1 30); do
  if healthy; then
    echo "[ensure-mongo] MongoDB healthy on :$PORT (pid $(pgrep -f "dbpath $DB_DIR" | head -1))"
    exit 0
  fi
  sleep 0.5
done

echo "[ensure-mongo] MongoDB did not become healthy in time"
exit 1
