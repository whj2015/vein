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
app.use('/api/inbounds', require('./routes/inbounds'));
app.use('/api/inbounds/:inboundId/clients', require('./routes/clients'));
app.use('/api/xray', require('./routes/xray'));
app.use('/api/system', require('./routes/system'));
app.use('/api/ai-config', require('./routes/ai-config'));

// 生产环境托管前端静态文件
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) res.status(404).json({ error: 'Not found' });
    });
  }
});

app.listen(config.port, () => {
  console.log(`Vein panel running on http://0.0.0.0:${config.port}`);
});
