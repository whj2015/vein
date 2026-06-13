# Vein — Xray 代理管理面板 实施方案

> **For Hermes:** 按阶段逐个任务执行，每完成一个 Phase 暂停确认再继续。

**目标：** 从零重建一个安全、可审计的 Xray 管理面板，完全替代 x-ui/j-ui，消除后门风险。

**架构：** Node.js (Express) 后端 + React (Vite) 前端 + SQLite 数据库。面板与 Xray 进程完全解耦，仅通过配置文件 + 进程信号交互，不影响流量面性能。

**技术栈：** Express 4.x, better-sqlite3, React 18, Vite 5, Tailwind CSS, lucide-react (icons)

**安全铁律：**
- 零外部 CDN，所有资源自托管
- 零遥测/回传代码
- Xray 配置用 JSON 模板生成，不做字符串拼接
- 面板 JWT 认证 + bcrypt 密码哈希
- 最小依赖原则：每个 npm 包必须可审计

---

## 工作区

```
D:\Projects\vein\
├── README.md
├── package.json          ← monorepo root (npm workspaces)
├── server/               ← Express 后端
│   ├── package.json
│   ├── index.js          ← 入口
│   ├── config.js         ← 配置（端口、JWT密钥等）
│   ├── db/
│   │   ├── database.js   ← SQLite 连接 + 初始化
│   │   └── migrate.js    ← 建表语句
│   ├── routes/
│   │   ├── auth.js       ← POST /api/auth/login
│   │   ├── inbounds.js   ← CRUD /api/inbounds
│   │   ├── clients.js    ← CRUD /api/inbounds/:id/clients
│   │   ├── system.js     ← GET /api/system/stats
│   │   └── xray.js       ← POST /api/xray/{start,stop,restart,status}
│   ├── services/
│   │   ├── xray-config.js  ← Xray JSON 配置生成器（模板化）
│   │   ├── xray-process.js ← Xray 进程管理（spawn/kill/signal）
│   │   └── system-info.js  ← 系统监控（CPU/RAM/磁盘/网络）
│   ├── middleware/
│   │   └── auth.js       ← JWT 验证中间件
│   └── utils/
│       └── password.js   ← bcrypt 哈希
├── client/               ← React 前端
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js ← axios 实例（自动带 JWT）
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Inbounds.jsx
│       │   ├── InboundEdit.jsx
│       │   ├── Clients.jsx
│       │   └── Settings.jsx
│       └── components/
│           ├── Layout.jsx     ← 侧边栏 + 顶栏
│           ├── StatCard.jsx
│           ├── DataTable.jsx
│           └── Modal.jsx
└── .hermes/
    └── plans/
```

---

## Phase 1: 项目脚手架 + 数据库 + 认证

### Task 1.1: 创建 monorepo 根目录

**文件:**
- 创建: `D:\Projects\vein\package.json`

```json
{
  "name": "vein",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w client"
  }
}
```

```bash
cd D:\Projects\vein && npm install
```

### Task 1.2: 初始化 server 子包

**文件:**
- 创建: `D:\Projects\vein\server\package.json`

```json
{
  "name": "vein-server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "node --watch index.js",
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "better-sqlite3": "^11.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0"
  }
}
```

```bash
npm install -w server
```

### Task 1.3: 创建服务器入口 + 配置

**文件:**
- 创建: `D:\Projects\vein\server\config.js`
- 创建: `D:\Projects\vein\server\index.js`
- 创建: `D:\Projects\vein\server\.env.example`

`config.js`:
```javascript
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  port: parseInt(process.env.PORT) || 54321,
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  xrayPath: process.env.XRAY_PATH || '/usr/local/bin/xray',
  xrayConfigPath: process.env.XRAY_CONFIG_PATH || '/usr/local/etc/xray/config.json',
  dbPath: path.join(__dirname, 'db', 'vein.db'),
};
```

`.env.example`:
```
PORT=54321
JWT_SECRET=replace-with-random-string
XRAY_PATH=/usr/local/bin/xray
XRAY_CONFIG_PATH=/usr/local/etc/xray/config.json
```

### Task 1.4: 创建 SQLite 数据库层

**文件:**
- 创建: `D:\Projects\vein\server\db\database.js`
- 创建: `D:\Projects\vein\server\db\migrate.js`

`database.js`:
```javascript
const Database = require('better-sqlite3');
const config = require('../config');
const { migrate } = require('./migrate');

let db;

function getDb() {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

module.exports = { getDb };
```

`migrate.js` — 建表：
```sql
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS panel_users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inbounds (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol        TEXT NOT NULL,  -- vmess, vless, trojan, shadowsocks
  port            INTEGER NOT NULL UNIQUE,
  listen          TEXT DEFAULT '0.0.0.0',
  enabled         INTEGER DEFAULT 1,
  stream_settings TEXT,           -- JSON
  sniffing        INTEGER DEFAULT 1,
  remark          TEXT DEFAULT '',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  inbound_id INTEGER NOT NULL REFERENCES inbounds(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  uuid       TEXT NOT NULL,       -- vmess/vless UUID 或 trojan password 或 ss password
  enabled    INTEGER DEFAULT 1,
  total_gb   REAL DEFAULT 0,     -- 0 = 不限流量
  used_bytes INTEGER DEFAULT 0,   -- 已用字节
  expiry_at  TEXT,                -- 到期时间 ISO8601，NULL=永不过期
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS traffic_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id  INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  inbound_id INTEGER REFERENCES inbounds(id) ON DELETE CASCADE,
  up_bytes   INTEGER DEFAULT 0,
  down_bytes INTEGER DEFAULT 0,
  recorded_at TEXT DEFAULT (datetime('now'))
);
```

### Task 1.5: 密码工具 + 认证路由

**文件:**
- 创建: `D:\Projects\vein\server\utils\password.js`
- 创建: `D:\Projects\vein\server\middleware\auth.js`
- 创建: `D:\Projects\vein\server\routes\auth.js`

`password.js`:
```javascript
const bcrypt = require('bcryptjs');
const SALT_ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

module.exports = { hashPassword, verifyPassword };
```

`middleware/auth.js`:
```javascript
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
```

`routes/auth.js`:
```javascript
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
  const token = jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username });
});

// POST /api/auth/setup (首次初始化管理员)
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
  db.prepare('INSERT INTO panel_users (username, password_hash) VALUES (?, ?)')
    .run(username, hashPassword(password));
  res.json({ ok: true });
});

module.exports = router;
```

### Task 1.6: 整合入口文件

**文件:**
- 修改: `D:\Projects\vein\server\index.js`

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { getDb } = require('./db/database');

// 首次启动自动初始化数据库
getDb();

const app = express();
app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/auth', require('./routes/auth'));

// 生产环境托管前端静态文件
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

app.listen(config.port, () => {
  console.log(`Vein panel running on http://0.0.0.0:${config.port}`);
});
```

---

## Phase 2: Xray 配置生成器

### Task 2.1: Xray 配置生成服务

**文件:**
- 创建: `D:\Projects\vein\server\services\xray-config.js`

核心逻辑：从数据库读取 inbounds + clients，生成完整 Xray JSON 配置。**使用 JSON 对象构建再 JSON.stringify，绝不做字符串拼接。**

```javascript
const { getDb } = require('../db/database');

function buildXrayConfig() {
  const db = getDb();
  const inbounds = db.prepare('SELECT * FROM inbounds WHERE enabled = 1').all();
  const clientStmt = db.prepare('SELECT * FROM clients WHERE inbound_id = ? AND enabled = 1');

  const inboundConfigs = inbounds.map(ib => {
    const clients = clientStmt.all(ib.id);
    const base = {
      port: ib.port,
      listen: ib.listen,
      protocol: ib.protocol,
      settings: buildProtocolSettings(ib.protocol, clients),
      sniffing: ib.sniffing ? { enabled: true, destOverride: ['http', 'tls'] } : undefined,
    };

    if (ib.stream_settings) {
      try {
        base.streamSettings = JSON.parse(ib.stream_settings);
      } catch { /* ignore invalid JSON */ }
    }

    return base;
  });

  return {
    log: { loglevel: 'warning' },
    inbounds: inboundConfigs,
    outbounds: [{ protocol: 'freedom', tag: 'direct' }],
    routing: {
      domainStrategy: 'AsIs',
      rules: [],
    },
  };
}

function buildProtocolSettings(protocol, clients) {
  switch (protocol) {
    case 'vmess':
      return { clients: clients.map(c => ({ id: c.uuid, email: c.email })) };
    case 'vless':
      return {
        clients: clients.map(c => ({ id: c.uuid, email: c.email, flow: '' })),
        decryption: 'none',
      };
    case 'trojan':
      return { clients: clients.map(c => ({ password: c.uuid, email: c.email })) };
    case 'shadowsocks':
      return {
        clients: clients.map(c => ({ password: c.uuid, email: c.email })),
        method: 'aes-256-gcm',
        network: 'tcp,udp',
      };
    default:
      return { clients: [] };
  }
}

module.exports = { buildXrayConfig };
```

### Task 2.2: 配置写入 + 校验

```javascript
const fs = require('fs');
const config = require('../config');

function writeConfig(xrayConfig) {
  const json = JSON.stringify(xrayConfig, null, 2);
  fs.writeFileSync(config.xrayConfigPath, json, 'utf-8');
}

function validateConfig(xrayConfig) {
  // 基本校验：必须有 inbounds 数组
  if (!xrayConfig || !Array.isArray(xrayConfig.inbounds)) {
    throw new Error('Invalid Xray config: missing inbounds');
  }
  // 端口不能重复
  const ports = new Set();
  for (const ib of xrayConfig.inbounds) {
    if (ports.has(ib.port)) throw new Error(`Duplicate port: ${ib.port}`);
    ports.add(ib.port);
  }
  return true;
}

module.exports = { writeConfig, validateConfig };
```

---

## Phase 3: 入站 + 客户端 API

### Task 3.1: 入站 CRUD 路由

**文件:**
- 创建: `D:\Projects\vein\server\routes\inbounds.js`

```javascript
const { Router } = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { regenerateConfig } = require('../services/xray-process');

const router = Router();
router.use(authMiddleware);

// GET /api/inbounds
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT i.*, COUNT(c.id) as client_count
    FROM inbounds i LEFT JOIN clients c ON c.inbound_id = i.id
    GROUP BY i.id ORDER BY i.port
  `).all();
  res.json(rows);
});

// GET /api/inbounds/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const inbound = db.prepare('SELECT * FROM inbounds WHERE id = ?').get(req.params.id);
  if (!inbound) return res.status(404).json({ error: '入站不存在' });
  res.json(inbound);
});

// POST /api/inbounds
router.post('/', (req, res) => {
  const { protocol, port, listen, stream_settings, sniffing, remark } = req.body;
  if (!protocol || !port) {
    return res.status(400).json({ error: '协议和端口为必填' });
  }
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO inbounds (protocol, port, listen, stream_settings, sniffing, remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(protocol, port, listen || '0.0.0.0', stream_settings ? JSON.stringify(stream_settings) : null, sniffing !== false ? 1 : 0, remark || '');
    regenerateConfig();
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '端口已被占用' });
    }
    throw e;
  }
});

// PUT /api/inbounds/:id
router.put('/:id', (req, res) => {
  const { protocol, port, listen, stream_settings, sniffing, remark, enabled } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE inbounds SET protocol=?, port=?, listen=?, stream_settings=?, sniffing=?, remark=?, enabled=?, updated_at=datetime('now')
    WHERE id=?
  `).run(protocol, port, listen, stream_settings ? JSON.stringify(stream_settings) : null, sniffing !== false ? 1 : 0, remark, enabled !== false ? 1 : 0, req.params.id);
  regenerateConfig();
  res.json({ ok: true });
});

// DELETE /api/inbounds/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM inbounds WHERE id = ?').run(req.params.id);
  regenerateConfig();
  res.json({ ok: true });
});

module.exports = router;
```

### Task 3.2: 客户端 CRUD 路由

**文件:**
- 创建: `D:\Projects\vein\server\routes\clients.js`

```javascript
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
  const clients = db.prepare('SELECT * FROM clients WHERE inbound_id = ? ORDER BY id').all(req.params.inboundId);
  res.json(clients);
});

// POST /api/inbounds/:inboundId/clients
router.post('/', (req, res) => {
  const { email, uuid, total_gb, expiry_at } = req.body;
  if (!email) return res.status(400).json({ error: '邮箱为必填' });
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO clients (inbound_id, email, uuid, total_gb, expiry_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.inboundId, email, uuid || uuidv4(), total_gb || 0, expiry_at || null);
  regenerateConfig();
  res.json({ id: result.lastInsertRowid });
});

// PUT /api/inbounds/:inboundId/clients/:id
router.put('/:id', (req, res) => {
  const { email, uuid, enabled, total_gb, expiry_at } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE clients SET email=?, uuid=?, enabled=?, total_gb=?, expiry_at=? WHERE id=? AND inbound_id=?
  `).run(email, uuid, enabled !== false ? 1 : 0, total_gb, expiry_at, req.params.id, req.params.inboundId);
  regenerateConfig();
  res.json({ ok: true });
});

// DELETE /api/inbounds/:inboundId/clients/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM clients WHERE id=? AND inbound_id=?').run(req.params.id, req.params.inboundId);
  regenerateConfig();
  res.json({ ok: true });
});

module.exports = router;
```

### Task 3.3: 注册路由到 server/index.js

在 `server/index.js` 中添加：
```javascript
app.use('/api/inbounds', require('./routes/inbounds'));
app.use('/api/inbounds/:inboundId/clients', require('./routes/clients'));
```

---

## Phase 4: Xray 进程管理

### Task 4.1: 进程管理服务

**文件:**
- 创建: `D:\Projects\vein\server\services\xray-process.js`

```javascript
const { spawn } = require('child_process');
const config = require('../config');
const { buildXrayConfig } = require('./xray-config');
const { writeConfig, validateConfig } = require('./xray-config-io');

let xrayProcess = null;

function startXray() {
  if (xrayProcess) return { status: 'already_running' };
  try {
    const cfg = buildXrayConfig();
    validateConfig(cfg);
    writeConfig(cfg);
    xrayProcess = spawn(config.xrayPath, ['run', '-config', config.xrayConfigPath], {
      stdio: 'ignore',
      detached: false,
    });
    xrayProcess.on('exit', (code) => {
      console.log(`Xray exited with code ${code}`);
      xrayProcess = null;
    });
    return { status: 'started' };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

function stopXray() {
  if (!xrayProcess) return { status: 'not_running' };
  xrayProcess.kill('SIGTERM');
  xrayProcess = null;
  return { status: 'stopped' };
}

function restartXray() {
  stopXray();
  return startXray();
}

function getXrayStatus() {
  return {
    running: xrayProcess !== null,
    pid: xrayProcess ? xrayProcess.pid : null,
  };
}

// 配置变更后重新生成配置并重载
function regenerateConfig() {
  try {
    const cfg = buildXrayConfig();
    validateConfig(cfg);
    writeConfig(cfg);
    if (xrayProcess) {
      // 发送 SIGHUP 触发 Xray 重载（Xray 不支持 SIGHUP 重载，用 restart）
      restartXray();
    }
  } catch (e) {
    console.error('Config regeneration failed:', e.message);
  }
}

module.exports = { startXray, stopXray, restartXray, getXrayStatus, regenerateConfig };
```

### Task 4.2: Xray 控制路由

**文件:**
- 创建: `D:\Projects\vein\server\routes\xray.js`

```javascript
const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { startXray, stopXray, restartXray, getXrayStatus } = require('../services/xray-process');

const router = Router();
router.use(authMiddleware);

router.get('/status', (req, res) => res.json(getXrayStatus()));
router.post('/start', (req, res) => res.json(startXray()));
router.post('/stop', (req, res) => res.json(stopXray()));
router.post('/restart', (req, res) => res.json(restartXray()));

module.exports = router;
```

注册到 `server/index.js`:
```javascript
app.use('/api/xray', require('./routes/xray'));
```

---

## Phase 5: 系统监控

### Task 5.1: 系统信息采集

**文件:**
- 创建: `D:\Projects\vein\server\services\system-info.js`

```javascript
const os = require('os');

function getSystemStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // 计算 CPU 使用率
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + (1 - idle / total);
  }, 0) / cpus.length;

  return {
    cpu: {
      percent: Math.round(cpuUsage * 100),
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
    },
    memory: {
      total: totalMem,
      used: totalMem - freeMem,
      percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    },
    uptime: os.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    load: loadAvg,
    network: getNetworkStats(),
  };
}

function getNetworkStats() {
  const nets = os.networkInterfaces();
  const result = {};
  for (const [name, addrs] of Object.entries(nets)) {
    result[name] = addrs.filter(a => a.family === 'IPv4').map(a => a.address);
  }
  return result;
}

module.exports = { getSystemStats };
```

### Task 5.2: 系统监控路由

**文件:**
- 创建: `D:\Projects\vein\server\routes\system.js`

```javascript
const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getSystemStats } = require('../services/system-info');

const router = Router();
router.use(authMiddleware);

router.get('/stats', (req, res) => {
  res.json(getSystemStats());
});

module.exports = router;
```

注册到 `server/index.js`:
```javascript
app.use('/api/system', require('./routes/system'));
```

---

## Phase 6: React 前端

### Task 6.1: 初始化 client 子包

**文件:**
- 创建: `D:\Projects\vein\client\package.json`

```json
{
  "name": "vein-client",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

```bash
npm install -w client
```

### Task 6.2: Vite + Tailwind 配置

**文件:**
- 创建: `D:\Projects\vein\client\vite.config.js`
- 创建: `D:\Projects\vein\client\tailwind.config.js`
- 创建: `D:\Projects\vein\client\postcss.config.js`
- 创建: `D:\Projects\vein\client\index.html`

`vite.config.js`:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:54321',
    },
  },
});
```

`index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vein - Xray Panel</title>
</head>
<body class="bg-gray-950 text-gray-100">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

### Task 6.3: 前端核心框架

**文件:**
- 创建: `D:\Projects\vein\client\src\main.jsx`
- 创建: `D:\Projects\vein\client\src\App.jsx`
- 创建: `D:\Projects\vein\client\src\index.css`
- 创建: `D:\Projects\vein\client\src\api\client.js`
- 创建: `D:\Projects\vein\client\src\context\AuthContext.jsx`

`api/client.js`:
```javascript
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('vein_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('vein_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
```

### Task 6.4: 登录页面

**文件:**
- 创建: `D:\Projects\vein\client\src\pages\Login.jsx`

暗色主题登录页，一个卡片居中，包含 logo + 用户名 + 密码 + 登录按钮。首次使用有 setup 模式。

### Task 6.5: 布局组件

**文件:**
- 创建: `D:\Projects\vein\client\src\components\Layout.jsx`

左侧深色侧边栏（Dashboard / 入站管理 / 设置），顶部栏显示用户名 + 退出按钮。右侧内容区。

### Task 6.6: Dashboard 页面

**文件:**
- 创建: `D:\Projects\vein\client\src\pages\Dashboard.jsx`

4 个 StatCard（CPU / 内存 / 运行状态 / 入站数量），下方入站列表表格。

### Task 6.7: 入站管理页面

**文件:**
- 创建: `D:\Projects\vein\client\src\pages\Inbounds.jsx`
- 创建: `D:\Projects\vein\client\src\pages\InboundEdit.jsx`

DataTable 展示所有入站（协议、端口、客户端数、状态、操作按钮）。
Modal 表单新增/编辑入站（协议下拉、端口、传输配置）。

### Task 6.8: 客户端管理页面

**文件:**
- 创建: `D:\Projects\vein\client\src\pages\Clients.jsx`

点击入站行进入，展示该入站下所有客户端。可添加/编辑/删除/启用禁用。

### Task 6.9: 设置页面 + Xray 控制

**文件:**
- 创建: `D:\Projects\vein\client\src\pages\Settings.jsx`

Xray 启动/停止/重启按钮 + 状态显示。面板端口、JWT 密钥等基础配置。

---

## Phase 7: 生产打包 + 部署

### Task 7.1: 安装脚本

**文件:**
- 创建: `D:\Projects\vein\install.sh` (Linux VPS 一键安装)

```bash
#!/bin/bash
# Vein 一键安装脚本
set -e

echo "[Vein] 开始安装..."

# 检查 Node.js
if ! command -v node &>/dev/null; then
  echo "安装 Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 安装 Xray
if ! command -v xray &>/dev/null; then
  echo "安装 Xray..."
  bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
fi

# 部署 Vein
mkdir -p /opt/vein
cp -r . /opt/vein/
cd /opt/vein
npm install --production
npm run build -w client

# systemd 服务
cat > /etc/systemd/system/vein.service << EOF
[Unit]
Description=Vein Xray Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vein
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable vein
systemctl start vein

echo "[Vein] 安装完成！访问 http://<服务器IP>:54321"
```

---

## 验证清单

- [ ] `npm run dev` 启动前后端无报错
- [ ] 首次访问 → 初始化管理员 → 登录成功
- [ ] 创建 vmess 入站 → 添加客户端 → Xray 配置正确生成
- [ ] Xray 启动 → 客户端能连接代理
- [ ] 修改入站/客户端 → 配置自动重载
- [ ] 系统监控数据正确显示
- [ ] `npm run build -w client` → 生产打包成功
- [ ] 所有前端资源自托管，无外部 CDN 请求
- [ ] `grep -r "fetch\|axios\|XMLHttpRequest" server/` 无外部网络请求
- [ ] node_modules 可审计，无混淆代码

---

## 风险 & 说明

| 风险 | 应对 |
|------|------|
| `better-sqlite3` 需编译 | VPS 上 `apt install build-essential python3` 即可 |
| Xray 配置重载非热更新 | 目前用 restart，未来可用 Xray API gRPC 实现热重载 |
| 流量统计精确性 | Xray API 提供实时流量，二期集成 |
| 多协议 streamSettings 复杂 | 前端预留 JSON 编辑器，高级用户手动配置 |

---

**总计 7 个 Phase，约 30 个 Task。MVP 覆盖：认证 + 入站 CRUD + 客户端管理 + Xray 控制 + 系统监控 + Web UI。**
