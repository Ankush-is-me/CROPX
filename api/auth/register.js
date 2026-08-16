// api/auth/register.js
const { getUser, saveUser, isPersistent } = require('../_lib/users');
const { hashPassword, signSession, setSessionCookie } = require('../_lib/auth');
const { rateLimit, clientIdentifier } = require('../_lib/rateLimit');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const limit = rateLimit(`register:${clientIdentifier(req)}`, { windowMs: 60_000, max: 6 });
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Too many attempts. Please wait a moment and try again.' });
  }

  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await getUser(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const user = {
      id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString()
    };

    await saveUser(user);

    const token = signSession(user);
    setSessionCookie(res, token);

    return res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email },
      persistent: isPersistent(),
      token
    });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ error: 'CROPX could not create your account right now. Please try again shortly.' });
  }
};
