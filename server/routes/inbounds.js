const { Router } = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { regenerateConfig } = require('../services/xray-process');

const router = Router();
router.use(authMiddleware);

// GET /api/inbounds — 列出所有入站（含客户端数）
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT i.*, COUNT(c.id) as client_count
       FROM inbounds i
       LEFT JOIN clients c ON c.inbound_id = i.id
       GROUP BY i.id
       ORDER BY i.port`
    )
    .all();
  res.json(rows);
});

// GET /api/inbounds/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const inbound = db.prepare('SELECT * FROM inbounds WHERE id = ?').get(req.params.id);
  if (!inbound) return res.status(404).json({ error: '入站不存在' });
  res.json(inbound);
});

// POST /api/inbounds — 新建入站
router.post('/', (req, res) => {
  const { protocol, port, listen, stream_settings, sniffing, remark } = req.body;
  if (!protocol || !port) {
    return res.status(400).json({ error: '协议和端口为必填' });
  }
  const db = getDb();
  try {
    const result = db
      .prepare(
        `INSERT INTO inbounds (protocol, port, listen, stream_settings, sniffing, remark)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        protocol,
        port,
        listen || '0.0.0.0',
        stream_settings ? JSON.stringify(stream_settings) : null,
        sniffing !== false ? 1 : 0,
        remark || ''
      );
    regenerateConfig();
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '端口已被占用' });
    }
    console.error(e);
    res.status(500).json({ error: '创建失败' });
  }
});

// PUT /api/inbounds/:id — 编辑入站
router.put('/:id', (req, res) => {
  const { protocol, port, listen, stream_settings, sniffing, remark, enabled } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM inbounds WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '入站不存在' });

  try {
    db.prepare(
      `UPDATE inbounds
       SET protocol=?, port=?, listen=?, stream_settings=?, sniffing=?,
           remark=?, enabled=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(
      protocol ?? existing.protocol,
      port ?? existing.port,
      listen ?? existing.listen,
      stream_settings ? JSON.stringify(stream_settings) : existing.stream_settings,
      sniffing !== undefined ? (sniffing ? 1 : 0) : existing.sniffing,
      remark ?? existing.remark,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      req.params.id
    );
    regenerateConfig();
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '端口已被占用' });
    }
    console.error(e);
    res.status(500).json({ error: '更新失败' });
  }
});

// DELETE /api/inbounds/:id — 删除入站（级联删除客户端）
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM inbounds WHERE id = ?').run(req.params.id);
  regenerateConfig();
  res.json({ ok: true });
});

module.exports = router;
