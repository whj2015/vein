import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Sparkles } from 'lucide-react';

const PROTOCOLS = ['vmess', 'vless', 'trojan', 'shadowsocks'];

// 传输预设模板
const STREAM_PRESETS = [
  { label: '无 (直连 TCP)', json: '' },
  {
    label: 'WebSocket',
    json: { network: 'ws', wsSettings: { path: '/' } },
  },
  {
    label: 'WebSocket + TLS',
    json: {
      network: 'ws',
      security: 'tls',
      tlsSettings: { serverName: '', certificates: [{ certificateFile: '/etc/ssl/cert.crt', keyFile: '/etc/ssl/cert.key' }] },
      wsSettings: { path: '/ws' },
    },
  },
  {
    label: 'gRPC',
    json: { network: 'grpc', grpcSettings: { serviceName: '' } },
  },
  {
    label: 'gRPC + TLS',
    json: {
      network: 'grpc',
      security: 'tls',
      tlsSettings: { serverName: '', certificates: [{ certificateFile: '/etc/ssl/cert.crt', keyFile: '/etc/ssl/cert.key' }] },
      grpcSettings: { serviceName: 'xray' },
    },
  },
  {
    label: 'HTTP/2 (h2)',
    json: { network: 'h2', h2Settings: { path: '/' } },
  },
  {
    label: 'HTTP/2 + TLS',
    json: {
      network: 'h2',
      security: 'tls',
      tlsSettings: { serverName: '' },
      h2Settings: { path: '/h2' },
    },
  },
  {
    label: 'Reality (仅 VLESS)',
    forProtocol: 'vless',
    json: {
      network: 'tcp',
      security: 'reality',
      realitySettings: {
        show: false,
        dest: 'www.microsoft.com:443',
        serverNames: ['www.microsoft.com', 'www.apple.com'],
        privateKey: '',
        shortIds: [''],
      },
    },
  },
  {
    label: 'KCP',
    json: { network: 'kcp', kcpSettings: { mtu: 1350, tti: 50, uplinkCapacity: 12, downlinkCapacity: 100, congestion: false, readBufferSize: 2, writeBufferSize: 2 } },
  },
  {
    label: 'QUIC',
    json: { network: 'quic', quicSettings: { security: 'none', key: '', header: { type: 'none' } } },
  },
  {
    label: 'HTTP',
    json: { network: 'http', httpSettings: { path: '/' } },
  },
  {
    label: 'TCP + HTTP 伪装',
    json: { network: 'tcp', tcpSettings: { header: { type: 'http', request: { version: '1.1', method: 'GET', path: ['/'], headers: { Host: ['www.microsoft.com'], 'User-Agent': ['Mozilla/5.0'] } } } } },
  },
];

export default function InboundEdit() {
  const { id } = useParams();
  const isEdit = !!id;
  const nav = useNavigate();

  const [form, setForm] = useState({
    protocol: 'vmess',
    port: '',
    listen: '0.0.0.0',
    remark: '',
    sniffing: true,
    stream_settings: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      api.get('/inbounds/' + id).then(({ data }) => {
        setForm({
          protocol: data.protocol,
          port: String(data.port),
          listen: data.listen,
          remark: data.remark || '',
          sniffing: !!data.sniffing,
          stream_settings: data.stream_settings || '',
        });
      });
    }
  }, [id, isEdit]);

  const applyPreset = (presetJson) => {
    if (!presetJson) {
      setForm({ ...form, stream_settings: '' });
      return;
    }
    setForm({ ...form, stream_settings: JSON.stringify(presetJson, null, 2) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      protocol: form.protocol,
      port: parseInt(form.port),
      listen: form.listen,
      remark: form.remark,
      sniffing: form.sniffing,
    };
    if (form.stream_settings.trim()) {
      try {
        payload.stream_settings = JSON.parse(form.stream_settings);
      } catch {
        setError('传输配置 JSON 格式错误');
        return;
      }
    }
    try {
      if (isEdit) {
        await api.put('/inbounds/' + id, payload);
      } else {
        await api.post('/inbounds', payload);
      }
      nav('/inbounds');
    } catch (err) {
      setError(err.response?.data?.error || '保存失败');
    }
  };

  const filteredPresets = STREAM_PRESETS.filter(
    (p) => !p.forProtocol || p.forProtocol === form.protocol
  );

  return (
    <div className="max-w-xl">
      <button onClick={() => nav(-1)} className="btn btn-ghost mb-4 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>
      <h1 className="text-xl font-bold mb-6">{isEdit ? '编辑入站' : '新建入站'}</h1>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">协议</label>
          <select
            className="input"
            value={form.protocol}
            onChange={(e) => setForm({ ...form, protocol: e.target.value })}
          >
            {PROTOCOLS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">端口</label>
          <input
            className="input"
            type="number"
            placeholder="例如 443"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">监听地址</label>
          <input
            className="input"
            value={form.listen}
            onChange={(e) => setForm({ ...form, listen: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">备注</label>
          <input
            className="input"
            placeholder="节点名称"
            value={form.remark}
            onChange={(e) => setForm({ ...form, remark: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.sniffing}
            onChange={(e) => setForm({ ...form, sniffing: e.target.checked })}
            className="w-4 h-4"
          />
          <label className="text-sm text-gray-400">启用流量探测 (sniffing)</label>
        </div>

        {/* 传输预设 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            传输预设 (一键填充)
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {filteredPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.json)}
                className="px-2.5 py-1 text-xs rounded border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200 hover:border-indigo-600 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-400">传输配置 (JSON)</label>
            <button
              type="button"
              onClick={() => nav('/ai-config?from=inbound')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> AI 生成
            </button>
          </div>
          <textarea
            className="input h-32 font-mono text-xs"
            placeholder='{"network":"ws","security":"tls",...}'
            value={form.stream_settings}
            onChange={(e) => setForm({ ...form, stream_settings: e.target.value })}
            spellCheck={false}
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button type="submit" className="btn btn-primary w-full">
          {isEdit ? '保存修改' : '创建入站'}
        </button>
      </form>
    </div>
  );
}
