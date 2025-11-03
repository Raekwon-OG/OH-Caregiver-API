#!/usr/bin/env node
/* Wait for MongoDB to accept connections. Tries the service hostname then localhost. */
const mongoose = require('mongoose');

const maxAttemptsPerHost = 30;
const delayMs = 1000;

async function tryConnectUri(uri) {
  const opts = { serverSelectionTimeoutMS: 2000 };
  try {
    await mongoose.connect(uri, opts);
    await mongoose.connection.close();
    console.log(`Connected to MongoDB via URI`);
    return true;
  } catch (err) {
    console.error(`connect error: ${err && err.message}`);
    return false;
  }
}

(async () => {
  // If a full connection string is provided via env, try it first (recommended for CI using Atlas)
  const envUri = process.env.MONGODB_URI;
  if (envUri) {
    for (let i = 1; i <= maxAttemptsPerHost; i++) {
      process.stdout.write(`Trying MONGODB_URI (attempt ${i}/${maxAttemptsPerHost})... `);
      const ok = await tryConnectUri(envUri);
      if (ok) process.exit(0);
      console.log('failed');
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // Fallback: try common hosts (service hostname and localhost)
  const hosts = ['mongodb', '127.0.0.1'];
  const port = process.env.MONGODB_PORT || '27017';
  const db = process.env.MONGODB_DB || 'oh-caregiver';
  for (const host of hosts) {
    const uri = `mongodb://${host}:${port}/${db}`;
    for (let i = 1; i <= maxAttemptsPerHost; i++) {
      process.stdout.write(`Trying ${host}:${port} (attempt ${i}/${maxAttemptsPerHost})... `);
      const ok = await tryConnectUri(uri);
      if (ok) process.exit(0);
      console.log('failed');
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.error('MongoDB did not become reachable at any expected address');
  process.exit(1);
})();
