// api/_lib/rateLimit.js
// Lightweight best-effort rate limiting for a single serverless instance.
// This is not a substitute for a shared store (e.g. Redis) under real load,
// but it stops obvious abuse/looping during a school demo and keeps the
// Gemini quota safe. For production-grade protection, back this with
// Vercel KV/Upstash instead.

const buckets = new Map();

function rateLimit(identifier, { windowMs = 60_000, max = 12 } = {}) {
  const now = Date.now();
  const entry = buckets.get(identifier) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count += 1;
  buckets.set(identifier, entry);
  return {
    allowed: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    resetInSeconds: Math.ceil((entry.reset - now) / 1000)
  };
}

function clientIdentifier(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

module.exports = { rateLimit, clientIdentifier };
