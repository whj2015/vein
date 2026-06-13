const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getDb } = require('../db/database');

const router = Router();
router.use(authMiddleware);

// GET /api/ai-config/settings
router.get('/settings', (req, res) => {
  const db = getDb();
  const apiKey = db.prepare("SELECT value FROM settings WHERE key='ai_api_key'").get();
  const endpoint = db.prepare("SELECT value FROM settings WHERE key='ai_api_endpoint'").get();
  const model = db.prepare("SELECT value FROM settings WHERE key='ai_model'").get();
  res.json({
    apiKey: apiKey ? apiKey.value : '',
    endpoint: endpoint ? endpoint.value : 'https://api.openai.com/v1',
    model: model ? model.value : 'gpt-4o-mini',
  });
});

// PUT /api/ai-config/settings
router.put('/settings', (req, res) => {
  const db = getDb();
  const { apiKey, endpoint, model } = req.body;
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  );
  if (apiKey !== undefined) upsert.run('ai_api_key', apiKey);
  if (endpoint !== undefined) upsert.run('ai_api_endpoint', endpoint);
  if (model !== undefined) upsert.run('ai_model', model);
  res.json({ ok: true });
});

// POST /api/ai-config/generate
router.post('/generate', async (req, res) => {
  const { prompt, protocol } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: '请输入需求描述' });
  }

  const db = getDb();
  const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key='ai_api_key'").get();
  const endpointRow = db.prepare("SELECT value FROM settings WHERE key='ai_api_endpoint'").get();
  const modelRow = db.prepare("SELECT value FROM settings WHERE key='ai_model'").get();

  const apiKey = apiKeyRow ? apiKeyRow.value : '';
  if (!apiKey) {
    return res.status(400).json({ error: '请先在设置页配置 AI API Key' });
  }

  const baseUrl = (endpointRow ? endpointRow.value : 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = modelRow ? modelRow.value : 'gpt-4o-mini';

  const systemPrompt = [
    '你是一个 Xray 代理配置专家。根据用户的需求描述，生成 Xray 的 streamSettings JSON 配置。',
    '',
    '协议: ' + (protocol || 'vmess'),
    '',
    'Xray streamSettings 支持的字段:',
    '- network: "tcp" | "ws" | "grpc" | "h2" | "kcp" | "quic" | "http"',
    '- security: "none" | "tls" | "reality"',
    '- tlsSettings: { serverName, certificates: [{certificateFile, keyFile}] }',
    '- realitySettings: { show, dest, serverNames: [], privateKey, shortIds: [], fingerprint: "chrome" }',
    '- wsSettings: { path, headers: {} }',
    '- grpcSettings: { serviceName, multiMode: false }',
    '- h2Settings: { path, host }',
    '- kcpSettings: { mtu, tti, uplinkCapacity, downlinkCapacity, congestion, readBufferSize, writeBufferSize }',
    '- quicSettings: { security: "none", key, header: {type: "none"} }',
    '- httpSettings: { path, host: [] }',
    '- tcpSettings: { header: {type: "none"|"http"} }',
    '',
    '规则:',
    '1. 只输出 JSON，不要有任何解释文字，不要 markdown 代码块标记',
    '2. 如果用户没提到加密/TLS，默认不开启 security',
    '3. 如果用户提到 CDN，推荐 ws + 路径伪装',
    '4. 如果用户提到 Reality，protocol 必须是 vless',
    '5. 证书路径默认用 /etc/ssl/cert.crt 和 /etc/ssl/cert.key',
    '6. 生成的 JSON 必须是合法可解析的',
  ].join('\n');

  try {
    const authHeader = 'Bearer ' + apiKey;
    const body = JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const response = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: body,
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({
        error: 'AI API error ' + String(response.status) + ': ' + errText.slice(0, 200),
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 清理可能的 markdown 代码块
    let json = content.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();

    // 验证 JSON
    try {
      JSON.parse(json);
      res.json({ config: json });
    } catch {
      res.json({
        config: json,
        warning: 'JSON 可能不完整，请检查后使用。原始输出:\n' + content,
      });
    }
  } catch (e) {
    res.status(500).json({ error: 'AI request failed: ' + e.message });
  }
});

module.exports = router;
