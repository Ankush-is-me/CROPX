// api/auth/me.js
const { getAuthedUser } = require('../_lib/auth');

module.exports = async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }
  return res.status(200).json({
    authenticated: true,
    user: { id: session.sub, email: session.email, name: session.name }
  });
};
