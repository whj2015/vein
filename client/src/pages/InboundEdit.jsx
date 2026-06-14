import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Sparkles, Copy, Check, Zap, Settings2, Globe } from 'lucide-react';
import { buildLink } from '../share-link';

const PROTOCOLS = ['vmess', 'vless', 'trojan', 'shadowsocks'];

const STREAM_PRESETS = [
  { label: '直连 TCP', json: '' },
  { label: 'WebSocket + TLS (套 CDN)', json: { network: 'ws', security: 'tls', tlsSettings: { serverName: '', certificates: [{ certificateFile: '/etc/ssl/cert.crt', keyFile: '/etc/ssl/cert.key' }] }, wsSettings: { path: '/ws' } } },
  { label: 'WebSocket (无加密)', json: { network: 'ws', wsSettings: { path: '/' } } },
  { label: 'gRPC + TLS', json: { network: 'grpc', security: 'tls', tlsSettings: { serverName: '' }, grpcSettings: { serviceName: 'xray' } } },
  { label: 'HTTP/2 + TLS', json: { network: 'h2', security: 'tls', tlsSettings: { serverName: '' }, h2Settings: { path: '/h2' } } },
  { label: 'Reality (仅 VLESS)', forProtocol: 'vless', json: { network: 'tcp', security: 'reality', realitySettings: { show: false, dest: 'www.microsoft.com:443', serverNames: ['www.microsoft.com'], privateKey: '', shortIds: [''] } } },
  { label: 'KCP', json: { network: 'kcp', kcpSettings: { mtu: 1350, tti: 50, uplinkCapacity: 12, downlinkCapacity: 100, congestion: false, readBufferSize: 2, writeBufferSize: 2 } } },
  { label: 'TCP + HTTP 伪装', json: { network: 'tcp', tcpSettings: { header: { type: 'http', request: { version: '1.1', method: 'GET', path: ['/'], headers: { Host: ['www.microsoft.com'], 'User-Agent': ['Mozilla/5.0'] } } } } } },
];

export default function InboundEdit() {
  const { id } = useParams();
  const isEdit = !!id;
  const nav = useNavigate();

  const [mode, setMode] = useState(isEdit ? 'manual' : 'quick'); // quick | manual
  const [form, setForm] = useState({ protocol: 'vmess', port: '', listen: '0.0.0.0', remark: '', sniffing: true, stream_settings: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null); // { link, inboundId, clientId }

  // AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Share link state
  const [copied, setCopied] = useState(false);
  const [serverIp, setServerIp] = useState('');

  useEffect(() => {
    // 获取服务器 IP
    api.get('/system/stats').then(r => setServerIp(r.data.hostname || '')).catch(() => {});
    if (isEdit) {
      api.get('/inbounds/' + id).then(({ data }) => {
        setForm({
          protocol: data.protocol, port: String(data.port), listen: data.listen,
          remark: data.remark || '', sniffing: !!data.sniffing,
          stream_settings: data.stream_settings || '',
        });
      });
    }
  }, [id, isEdit]);

  const aiGenerate = async () => {
    if (!aiPrompt.trim()) return setError('请描述你的需求');
    setError('');
    setAiLoading(true);
    try {
      const { data } = await api.post('/ai-config/generate', { prompt: aiPrompt.trim(), protocol: form.protocol });
      if (data.config) {
        let cfg = data.config;
        try { cfg = JSON.stringify(JSON.parse(cfg), null, 2); } catch {}
        setForm(f => ({ ...f, stream_settings: cfg }));
      }
      if (data.warning) setError(data.warning);
    } catch (err) {
      setError(err.response?.data?.error || 'AI 生成失败，请检查 AI API 配置');
    } finally {
      setAiLoading(false);
    }
  };

  const applyPreset = (presetJson) => {
    setForm(f => ({ ...f, stream_settings: presetJson ? JSON.stringify(presetJson, null, 2) : '' }));
  };

  // 一键创建：创入站 + 第一条客户端 → 返回分享链接
  const quickCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.port) return setError('请输入端口');
    const payload = { protocol: form.protocol, port: parseInt(form.port), listen: form.listen, remark: form.remark, sniffing: form.sniffing };
    if (form.stream_settings.trim()) {
      try { payload.stream_settings = JSON.parse(form.stream_settings); }
      catch { return setError('传输配置 JSON 格式错误'); }
    }
    try {
      // 1. 创建入站
      const { data: ib } = await api.post('/inbounds', payload);
      // 2. 自动创建第一个客户端
      const { data: cl } = await api.post('/inbounds/' + ib.id + '/clients', { email: 'user-' + Date.now() });
      // 3. 生成分享链接
      const link = buildLink(form.protocol, cl.uuid, form.port, form.stream_settings, serverIp);
      setSuccess({ link, inboundId: ib.id, clientId: cl.id });
    } catch (err) {
      setError(err.response?.data?.error || '创建失败');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { protocol: form.protocol, port: parseInt(form.port), listen: form.listen, remark: form.remark, sniffing: form.sniffing };
    if (form.stream_settings.trim()) {
      try { payload.stream_settings = JSON.parse(form.stream_settings); }
      catch { return setError('传输配置 JSON 格式错误'); }
    }
    try {
      if (isEdit) await api.put('/inbounds/' + id, payload);
      else await api.post('/inbounds', payload);
      nav('/inbounds');
    } catch (err) { setError(err.response?.data?.error || '保存失败'); }
  };

  const copyLink = () => {
    if (success?.link) {
      navigator.clipboard.writeText(success.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-xl">
      <button onClick={() => nav(-1)} className="btn btn-ghost mb-4 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">{isEdit ? '编辑入站' : '创建入站'}</h1>
        {!isEdit && (
          <div className="flex bg-gray-900 rounded-lg p-0.5">
            <button onClick={() => setMode('quick')} className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 ${mode === 'quick' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>
              <Zap className="w-3 h-3" /> 快速
            </button>
            <button onClick={() => setMode('manual')} className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 ${mode === 'manual' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>
              <Settings2 className="w-3 h-3" /> 手动
            </button>
          </div>
        )}
      </div>

      {/* ===== 快速创建模式 ===== */}
      {mode === 'quick' && !success && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2 text-sm text-indigo-400">
            <Sparkles className="w-4 h-4" />
            用自然语言描述需求，AI 自动生成配置
          </div>

          {/* 协议 + 端口 */}
          <div className="flex gap-2">
            <select className="input w-28" value={form.protocol} onChange={e => setForm(f => ({ ...f, protocol: e.target.value }))}>
              {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input className="input w-28" type="number" placeholder="端口" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} />
            <input className="input flex-1" placeholder="例如: 用 WebSocket + TLS 套 Cloudflare，路径 /ray" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && aiGenerate()} />
          </div>

          {/* AI 生成按钮 + 预设 */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={aiGenerate} disabled={aiLoading} className="btn btn-primary text-xs flex items-center gap-1">
              {aiLoading ? <span className="animate-spin">&#9696;</span> : <Sparkles className="w-3 h-3" />}
              {aiLoading ? '生成中...' : 'AI 生成配置'}
            </button>
            {STREAM_PRESETS.filter(p => !p.forProtocol || p.forProtocol === form.protocol).map(p => (
              <button key={p.label} type="button" onClick={() => applyPreset(p.json)} className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600">
                {p.label}
              </button>
            ))}
          </div>

          {/* 生成的配置预览 */}
          {form.stream_settings && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">生成的传输配置</label>
              <pre className="bg-gray-950 rounded-lg p-3 text-xs font-mono text-gray-400 max-h-32 overflow-auto">{form.stream_settings}</pre>
            </div>
          )}

          {/* 备注 */}
          <input className="input" placeholder="备注（可选）" value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={quickCreate} disabled={!form.port} className="btn btn-primary w-full flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" /> 一键创建并生成分享链接
          </button>
        </div>
      )}

      {/* ===== 创建成功 → 显示分享链接 ===== */}
      {success && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Globe className="w-5 h-5" />
            <span className="font-semibold">创建成功！</span>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">客户端连接链接</label>
            <div className="flex gap-2">
              <input className="input flex-1 font-mono text-xs" readOnly value={success.link} onClick={e => e.target.select()} />
              <button onClick={copyLink} className="btn btn-primary flex items-center gap-1 whitespace-nowrap">
                {copied ? <><Check className="w-4 h-4" /> 已复制</> : <><Copy className="w-4 h-4" /> 复制</>}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500">客户端导入此链接即可连接代理。下次可到「入站管理 → 客户端管理」添加更多用户。</p>

          <div className="flex gap-2">
            <button onClick={() => nav('/inbounds/' + success.inboundId + '/clients')} className="btn btn-ghost flex-1">管理客户端</button>
            <button onClick={() => { setSuccess(null); setMode('quick'); setForm({ protocol: 'vmess', port: '', listen: '0.0.0.0', remark: '', sniffing: true, stream_settings: '' }); setAiPrompt(''); }} className="btn btn-ghost">再建一个</button>
          </div>
        </div>
      )}

      {/* ===== 手动模式 ===== */}
      {mode === 'manual' && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">协议</label>
            <select className="input" value={form.protocol} onChange={e => setForm(f => ({ ...f, protocol: e.target.value }))}>
              {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">端口</label>
            <input className="input" type="number" placeholder="例如 443" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">监听地址</label>
            <input className="input" value={form.listen} onChange={e => setForm(f => ({ ...f, listen: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">备注</label>
            <input className="input" placeholder="节点名称" value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.sniffing} onChange={e => setForm(f => ({ ...f, sniffing: e.target.checked }))} className="w-4 h-4" />
            <label className="text-sm text-gray-400">流量探测</label>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-400">传输预设 / AI 生成</label>
              <div className="flex gap-1">
                <input className="input w-48 text-xs py-1" placeholder="描述需求 → AI 生成" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && aiGenerate()} />
                <button type="button" onClick={aiGenerate} disabled={aiLoading} className="btn btn-primary text-xs px-2 py-1">
                  {aiLoading ? '...' : '生成'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {STREAM_PRESETS.filter(p => !p.forProtocol || p.forProtocol === form.protocol).map(p => (
                <button key={p.label} type="button" onClick={() => applyPreset(p.json)} className="px-2 py-0.5 text-xs rounded border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200">{p.label}</button>
              ))}
            </div>
            <textarea className="input h-24 font-mono text-xs" placeholder='{"network":"ws","security":"tls",...}' value={form.stream_settings} onChange={e => setForm(f => ({ ...f, stream_settings: e.target.value }))} spellCheck={false} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn btn-primary w-full">{isEdit ? '保存修改' : '创建入站'}</button>
        </form>
      )}
    </div>
  );
}
