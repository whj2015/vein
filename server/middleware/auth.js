const jwt = require('jsonwebtoken');
const config = require('../config');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
}

module.exports = { authMiddleware };
