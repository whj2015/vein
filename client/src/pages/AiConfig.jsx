import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Sparkles, Copy, Check, AlertTriangle } from 'lucide-react';

export default function AiConfig() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [prompt, setPrompt] = useState('');
  const [protocol, setProtocol] = useState('vmess');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请描述你的需求');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/ai-config/generate', {
        prompt: prompt.trim(),
        protocol: protocol,
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || '生成失败，请检查 AI API 配置');
    } finally {
      setLoading(false);
    }
  };

  const formatJson = (jsonStr) => {
    try {
      return JSON.stringify(JSON.parse(jsonStr), null, 2);
    } catch {
      return jsonStr;
    }
  };

  const copyConfig = () => {
    if (result?.config) {
      navigator.clipboard.writeText(result.config);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl">
      <button onClick={() => nav(-1)} className="btn btn-ghost mb-4 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-6 h-6 text-indigo-400" />
        <h1 className="text-xl font-bold">AI 配置生成</h1>
      </div>

      <div className="card mb-4">
        <p className="text-sm text-gray-400 mb-4">
          用自然语言描述你的代理需求，AI 自动生成 Xray 传输配置 JSON。支持 OpenAI / Claude / 兼容 API。
        </p>

        <div className="flex gap-3 mb-3">
          <select
            className="input w-32"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
          >
            <option value="vmess">vmess</option>
            <option value="vless">vless</option>
            <option value="trojan">trojan</option>
            <option value="shadowsocks">shadowsocks</option>
          </select>
          <input
            className="input flex-1"
            placeholder="例如: 用 WebSocket + TLS，套 Cloudflare CDN，路径用 /ray"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleGenerate()}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">&#9696;</span> 生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> 生成配置
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="card border-red-800 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">生成的配置</h2>
            <button
              onClick={copyConfig}
              className="btn btn-ghost p-1.5 text-xs flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> 已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> 复制
                </>
              )}
            </button>
          </div>

          {result.warning && (
            <div className="mb-3 p-2 bg-amber-900/30 border border-amber-800 rounded text-amber-400 text-xs flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{result.warning}</span>
            </div>
          )}

          <pre className="bg-gray-950 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-auto max-h-80 whitespace-pre-wrap">
            {formatJson(result.config)}
          </pre>

          <p className="text-xs text-gray-600 mt-3">
            检查无误后，复制到入站编辑页的「传输配置」字段即可使用。
          </p>
        </div>
      )}

      {/* 示例提示 */}
      {!result && !loading && (
        <div className="card mt-4">
          <h2 className="text-sm font-semibold mb-2 text-gray-400">试试这些描述</h2>
          <div className="space-y-1.5">
            {[
              { p: '用 WebSocket + TLS，套 CDN，路径 /v2ray' },
              { p: 'VLESS Reality，目标 www.microsoft.com:443' },
              { p: 'gRPC 协议，TLS 加密，服务名 xray' },
              { p: '纯 TCP 直连，不需要加密' },
              { p: 'KCP 协议，伪装成视频流量' },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => setPrompt(item.p)}
                className="block w-full text-left text-xs text-gray-500 hover:text-indigo-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
              >
                &ldquo;{item.p}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
