// api/auth/login.js
const { getUser } = require('../_lib/users');
const { comparePassword, signSession, setSessionCookie } = require('../_lib/auth');
const { rateLimit, clientIdentifier } = require('../_lib/rateLimit');

// A single, clearly-documented demo account so a class presentation never
// depends on live internet registration or KV being connected. Real
// accounts created via /api/auth/register work exactly the same way.
const DEMO_EMAIL = 'demo@cropx.app';
const DEMO_PASSWORD = 'CropXDemo123';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const limit = rateLimit(`login:${clientIdentifier(req)}`, { windowMs: 60_000, max: 10 });
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Too many login attempts. Please wait a moment and try again.' });
  }

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (normalizedEmail === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const demoUser = { id: 'usr_demo', name: 'Demo Farmer', email: DEMO_EMAIL };
      const token = signSession(demoUser);
      setSessionCookie(res, token);
      return res.status(200).json({ user: demoUser, demo: true, token });
    }

    const user = await getUser(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const token = signSession(user);
    setSessionCookie(res, token);
    return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'CROPX could not sign you in right now. Please try again shortly.' });
  }
};
