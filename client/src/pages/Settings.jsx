import { useState, useEffect } from 'react';
import api from '../api/client';
import { Play, Square, RefreshCw, Sparkles, Eye, EyeOff } from 'lucide-react';

export default function Settings() {
  const [xray, setXray] = useState({ running: false, pid: null });
  const [msg, setMsg] = useState('');

  // AI 配置
  const [aiSettings, setAiSettings] = useState({ apiKey: '', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' });
  const [showKey, setShowKey] = useState(false);
  const [aiMsg, setAiMsg] = useState('');

  const checkStatus = async () => {
    const { data } = await api.get('/xray/status');
    setXray(data);
  };

  const loadAiSettings = async () => {
    try {
      const { data } = await api.get('/ai-config/settings');
      setAiSettings(data);
    } catch { /* 路由可能未加载 */ }
  };

  useEffect(() => {
    checkStatus();
    loadAiSettings();
  }, []);

  const doAction = async (action) => {
    setMsg('');
    const { data } = await api.post('/xray/' + action);
    setMsg(JSON.stringify(data));
    await checkStatus();
  };

  const saveAiSettings = async (e) => {
    e.preventDefault();
    setAiMsg('');
    try {
      await api.put('/ai-config/settings', aiSettings);
      setAiMsg('保存成功');
      setTimeout(() => setAiMsg(''), 2000);
    } catch (err) {
      setAiMsg('保存失败: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-bold">设置</h1>

      {/* AI 配置 */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="font-semibold">AI 配置助手</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          配置 OpenAI 兼容 API，即可用自然语言生成 Xray 配置。支持 OpenAI / Claude / 本地 LLM / 任何兼容接口。
        </p>

        <form onSubmit={saveAiSettings} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">API 地址</label>
            <input
              className="input"
              placeholder="https://api.openai.com/v1"
              value={aiSettings.endpoint}
              onChange={(e) => setAiSettings({ ...aiSettings, endpoint: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">API Key</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={aiSettings.apiKey}
                onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">模型</label>
            <select
              className="input"
              value={aiSettings.model}
              onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
            >
              <option value="gpt-4o-mini">gpt-4o-mini (便宜)</option>
              <option value="gpt-4o">gpt-4o (强)</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              <option value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet</option>
              <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
              <option value="deepseek-chat">DeepSeek Chat</option>
              <option value="qwen-turbo">Qwen Turbo</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button type="submit" className="btn btn-primary">保存 AI 配置</button>
            {aiMsg && (
              <span className={`text-xs ${aiMsg.includes('失败') ? 'text-red-400' : 'text-emerald-400'}`}>
                {aiMsg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Xray 控制 */}
      <div className="card">
        <h2 className="font-semibold mb-3">Xray 控制</h2>
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2.5 h-2.5 rounded-full ${xray.running ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400">
            {xray.running ? `运行中 (PID: ${xray.pid})` : '已停止'}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => doAction('start')} className="btn btn-primary flex items-center gap-1">
            <Play className="w-4 h-4" /> 启动
          </button>
          <button onClick={() => doAction('stop')} className="btn btn-danger flex items-center gap-1">
            <Square className="w-4 h-4" /> 停止
          </button>
          <button onClick={() => doAction('restart')} className="btn btn-ghost flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> 重启
          </button>
        </div>
        {msg && <p className="text-xs text-gray-500 mt-2 font-mono">{msg}</p>}
      </div>

      {/* 关于 */}
      <div className="card">
        <h2 className="font-semibold mb-3">关于 Vein</h2>
        <p className="text-sm text-gray-500">
          从零重建的 Xray 管理面板。零外部依赖、零遥测、零后门。
        </p>
        <p className="text-xs text-gray-600 mt-2">v1.0.0 · Node.js + React + SQLite</p>
      </div>
    </div>
  );
}
