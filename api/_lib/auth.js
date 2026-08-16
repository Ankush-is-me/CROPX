// api/_lib/auth.js
// Shared authentication helpers for CROPX serverless functions.
// Never import this file from frontend code — it is server-only.

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const TOKEN_COOKIE = 'cropx_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured on the server.');
  }
  return secret;
}

function signSession(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL_SECONDS }
  );
}

function verifySession(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (err) {
    return null;
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parts = header.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(name + '=')) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}

function setSessionCookie(res, token) {
  const isProd = process.env.VERCEL_ENV === 'production';
  const cookie = [
    `${TOKEN_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TOKEN_TTL_SECONDS}`,
    isProd ? 'Secure' : ''
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${TOKEN_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
}

function getAuthedUser(req) {
  // Accept either the httpOnly cookie (normal browser flow) or a Bearer
  // token (useful for the demo/local flow and API testing).
  const cookieToken = readCookie(req, TOKEN_COOKIE);
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = cookieToken || bearerToken;
  if (!token) return null;
  return verifySession(token);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  TOKEN_COOKIE,
  signSession,
  verifySession,
  setSessionCookie,
  clearSessionCookie,
  getAuthedUser,
  hashPassword,
  comparePassword
};
