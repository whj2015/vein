const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { regenerateConfig } = require('../services/xray-process');

const router = Router({ mergeParams: true });
router.use(authMiddleware);

// GET /api/inbounds/:inboundId/clients
router.get('/', (req, res) => {
  const db = getDb();
  const clients = db
    .prepare('SELECT * FROM clients WHERE inbound_id = ? ORDER BY id')
    .all(req.params.inboundId);
  res.json(clients);
});

// POST /api/inbounds/:inboundId/clients
router.post('/', (req, res) => {
  const { email, uuid, total_gb, expiry_at } = req.body;
  if (!email) return res.status(400).json({ error: '邮箱为必填' });

  // 验证入站存在
  const db = getDb();
  const inbound = db
    .prepare('SELECT id, protocol FROM inbounds WHERE id = ?')
    .get(req.params.inboundId);
  if (!inbound) return res.status(404).json({ error: '入站不存在' });

  const result = db
    .prepare(
      `INSERT INTO clients (inbound_id, email, uuid, total_gb, expiry_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(req.params.inboundId, email, uuid || uuidv4(), total_gb || 0, expiry_at || null);

  regenerateConfig();
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/inbounds/:inboundId/clients/:id
router.put('/:id', (req, res) => {
  const { email, uuid, enabled, total_gb, expiry_at } = req.body;
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM clients WHERE id=? AND inbound_id=?')
    .get(req.params.id, req.params.inboundId);
  if (!existing) return res.status(404).json({ error: '客户端不存在' });

  db.prepare(
    `UPDATE clients
     SET email=?, uuid=?, enabled=?, total_gb=?, expiry_at=?
     WHERE id=? AND inbound_id=?`
  ).run(
    email ?? existing.email,
    uuid ?? existing.uuid,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    total_gb ?? existing.total_gb,
    expiry_at !== undefined ? expiry_at : existing.expiry_at,
    req.params.id,
    req.params.inboundId
  );

  regenerateConfig();
  res.json({ ok: true });
});

// DELETE /api/inbounds/:inboundId/clients/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM clients WHERE id=? AND inbound_id=?').run(
    req.params.id,
    req.params.inboundId
  );
  regenerateConfig();
  res.json({ ok: true });
});

module.exports = router;
