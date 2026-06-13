import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Plus, Trash2, Copy } from 'lucide-react';

export default function Clients() {
  const { id } = useParams();
  const nav = useNavigate();
  const [inbound, setInbound] = useState(null);
  const [clients, setClients] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [uuid, setUuid] = useState('');
  const [totalGb, setTotalGb] = useState('0');
  const [expiry, setExpiry] = useState('');

  const load = () => {
    api.get('/inbounds/' + id).then((r) => setInbound(r.data));
    api.get('/inbounds/' + id + '/clients').then((r) => setClients(r.data));
  };
  useEffect(() => { load(); }, [id]);

  const addClient = async (e) => {
    e.preventDefault();
    await api.post('/inbounds/' + id + '/clients', {
      email: email || 'user-' + Date.now(),
      uuid: uuid || undefined,
      total_gb: parseFloat(totalGb) || 0,
      expiry_at: expiry || null,
    });
    setShowAdd(false);
    setEmail('');
    setUuid('');
    setTotalGb('0');
    setExpiry('');
    load();
  };

  const remove = async (cid) => {
    if (!confirm('确定删除此客户端？')) return;
    await api.delete('/inbounds/' + id + '/clients/' + cid);
    load();
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div>
      <button onClick={() => nav('/inbounds')} className="btn btn-ghost mb-4 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> 返回入站列表
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">
          客户端管理
          {inbound && (
            <span className="text-gray-500 text-base ml-2">
              端口 {inbound.port} · {inbound.protocol}
            </span>
          )}
        </h1>
        <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary flex items-center gap-1">
          <Plus className="w-4 h-4" /> 添加
        </button>
      </div>

      {showAdd && (
        <div className="card mb-4">
          <form onSubmit={addClient} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="input" placeholder="UUID/密码 (留空自动生成)" value={uuid} onChange={(e) => setUuid(e.target.value)} />
              <input className="input" type="number" placeholder="流量限制 GB (0=不限)" value={totalGb} onChange={(e) => setTotalGb(e.target.value)} />
              <input className="input" type="date" placeholder="到期时间" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">确认添加</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-800">
              <th className="pb-2 font-medium">邮箱</th>
              <th className="pb-2 font-medium">UUID / 密码</th>
              <th className="pb-2 font-medium">流量</th>
              <th className="pb-2 font-medium">到期</th>
              <th className="pb-2 font-medium">状态</th>
              <th className="pb-2 font-medium w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2.5">{c.email}</td>
                <td className="py-2.5">
                  <span className="font-mono text-xs text-gray-400">{c.uuid?.slice(0, 16)}...</span>
                  <button
                    onClick={() => copyText(c.uuid)}
                    className="ml-1.5 text-gray-600 hover:text-gray-400 inline"
                    title="复制"
                  >
                    <Copy className="w-3 h-3 inline" />
                  </button>
                </td>
                <td className="py-2.5 text-gray-400">
                  {c.total_gb > 0 ? c.total_gb + ' GB' : '不限'}
                </td>
                <td className="py-2.5 text-gray-400">
                  {c.expiry_at ? c.expiry_at.slice(0, 10) : '永久'}
                </td>
                <td className="py-2.5">
                  <span className={`badge ${c.enabled ? 'badge-green' : 'badge-red'}`}>
                    {c.enabled ? '启用' : '停用'}
                  </span>
                </td>
                <td className="py-2.5">
                  <button
                    onClick={() => remove(c.id)}
                    className="btn btn-ghost p-1.5 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan="6" className="py-8 text-center text-gray-600">暂无客户端</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
