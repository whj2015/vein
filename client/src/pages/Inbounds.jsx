import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Plus, Edit3, Trash2, Users, Power, PowerOff } from 'lucide-react';

export default function Inbounds() {
  const [inbounds, setInbounds] = useState([]);
  const nav = useNavigate();

  const load = () => api.get('/inbounds').then((r) => setInbounds(r.data));
  useEffect(() => { load(); }, []);

  const toggle = async (ib) => {
    await api.put('/inbounds/' + ib.id, { enabled: !ib.enabled });
    load();
  };

  const remove = async (ib) => {
    if (!confirm('确定删除端口 ' + ib.port + ' 的入站？关联的客户端也会被删除。')) return;
    await api.delete('/inbounds/' + ib.id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">入站管理</h1>
        <Link to="/inbounds/new" className="btn btn-primary flex items-center gap-1">
          <Plus className="w-4 h-4" /> 新建
        </Link>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-800">
              <th className="pb-2 font-medium">端口</th>
              <th className="pb-2 font-medium">协议</th>
              <th className="pb-2 font-medium">监听</th>
              <th className="pb-2 font-medium">备注</th>
              <th className="pb-2 font-medium">客户端</th>
              <th className="pb-2 font-medium">状态</th>
              <th className="pb-2 font-medium w-40">操作</th>
            </tr>
          </thead>
          <tbody>
            {inbounds.map((ib) => (
              <tr key={ib.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2.5 font-mono">{ib.port}</td>
                <td className="py-2.5">
                  <span className="badge badge-green">{ib.protocol}</span>
                </td>
                <td className="py-2.5 text-gray-400 font-mono text-xs">{ib.listen}</td>
                <td className="py-2.5 text-gray-400">{ib.remark || '-'}</td>
                <td className="py-2.5">{ib.client_count}</td>
                <td className="py-2.5">
                  <span className={`badge ${ib.enabled ? 'badge-green' : 'badge-red'}`}>
                    {ib.enabled ? '运行' : '停用'}
                  </span>
                </td>
                <td className="py-2.5">
                  <div className="flex gap-1">
                    <button
                      onClick={() => nav('/inbounds/' + ib.id + '/clients')}
                      className="btn btn-ghost p-1.5"
                      title="客户端"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => nav('/inbounds/' + ib.id + '/edit')}
                      className="btn btn-ghost p-1.5"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggle(ib)}
                      className="btn btn-ghost p-1.5"
                      title={ib.enabled ? '停用' : '启用'}
                    >
                      {ib.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => remove(ib)}
                      className="btn btn-ghost p-1.5 text-red-400 hover:text-red-300"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {inbounds.length === 0 && (
              <tr><td colSpan="7" className="py-8 text-center text-gray-600">暂无入站配置，点击右上角新建</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
