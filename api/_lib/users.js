// api/_lib/users.js
// User persistence for CROPX. Uses Vercel KV when the integration is
// configured (KV_REST_API_URL / KV_REST_API_TOKEN env vars). If KV is not
// configured, falls back to an in-memory store so the app still runs during
// local development or a quick demo deploy — note that the in-memory store
// does NOT persist across separate serverless invocations, so production
// use requires connecting Vercel KV (see README).

let kv = null;
let kvReady = false;

function getKv() {
  if (kvReady) return kv;
  kvReady = true;
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      // Lazy require so the app doesn't fail to boot when KV isn't installed/configured.
      kv = require('@vercel/kv').kv;
    } catch (err) {
      kv = null;
    }
  }
  return kv;
}

// In-memory fallback (per serverless instance only — not durable).
const memoryStore = new Map();

function key(email) {
  return `cropx:user:${email.toLowerCase().trim()}`;
}

async function getUser(email) {
  const store = getKv();
  if (store) {
    return store.get(key(email));
  }
  return memoryStore.get(key(email)) || null;
}

async function saveUser(user) {
  const store = getKv();
  if (store) {
    await store.set(key(user.email), user);
    return;
  }
  memoryStore.set(key(user.email), user);
}

function isPersistent() {
  return Boolean(getKv());
}

module.exports = { getUser, saveUser, isPersistent };
