#!/usr/bin/env node
/* Wait for MongoDB to accept connections. Tries the service hostname then localhost. */
const mongoose = require('mongoose');

const hosts = ['mongodb', '127.0.0.1'];
const port = process.env.MONGODB_PORT || '27017';
const db = process.env.MONGODB_DB || 'oh-caregiver';
const maxAttemptsPerHost = 30;
const delayMs = 1000;

async function tryConnect(host) {
  const uri = `mongodb://${host}:${port}/${db}?replicaSet=rs0`;
  // serverSelectionTimeoutMS to fail fast
  const opts = { serverSelectionTimeoutMS: 2000 };
  try {
    await mongoose.connect(uri, opts);
    await mongoose.connection.close();
    console.log(`Connected to MongoDB at ${host}:${port}/${db}`);
    return true;
  } catch (err) {
    // console.error(`connect error to ${host}:`, err && err.message);
    return false;
  }
}

(async () => {
  for (const host of hosts) {
    for (let i = 1; i <= maxAttemptsPerHost; i++) {
      process.stdout.write(`Trying ${host}:${port} (attempt ${i}/${maxAttemptsPerHost})... `);
      const ok = await tryConnect(host);
      if (ok) process.exit(0);
      console.log('failed');
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  console.error('MongoDB did not become reachable at any expected address');
  process.exit(1);
})();
