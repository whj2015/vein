const { Router } = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db/database');
const { hashPassword, verifyPassword } = require('../utils/password');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM panel_users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
  res.json({ token, username: user.username });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username });
});

// POST /api/auth/setup — 首次初始化管理员
router.post('/setup', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM panel_users').get();
  if (existing.cnt > 0) {
    return res.status(400).json({ error: '已初始化，不可重复设置' });
  }
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  db.prepare('INSERT INTO panel_users (username, password_hash) VALUES (?, ?)').run(
    username,
    hashPassword(password)
  );
  res.json({ ok: true });
});

module.exports = router;
