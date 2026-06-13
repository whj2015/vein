import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Cpu, MemoryStick, Network, Activity } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [inbounds, setInbounds] = useState([]);

  useEffect(() => {
    api.get('/system/stats').then((r) => setStats(r.data));
    api.get('/inbounds').then((r) => setInbounds(r.data));
  }, []);

  if (!stats) return <div className="text-gray-500">加载中...</div>;

  const statCards = [
    { label: 'CPU', value: stats.cpu.percent + '%', sub: stats.cpu.model?.split('@')[0], icon: Cpu, color: 'text-blue-400' },
    { label: '内存', value: stats.memory.percent + '%', sub: formatBytes(stats.memory.used) + ' / ' + formatBytes(stats.memory.total), icon: MemoryStick, color: 'text-emerald-400' },
    { label: '入站', value: inbounds.length, sub: inbounds.filter(i => i.enabled).length + ' 个运行中', icon: Network, color: 'text-indigo-400' },
    { label: '运行时间', value: formatUptime(stats.uptime), sub: stats.hostname, icon: Activity, color: 'text-amber-400' },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">仪表盘</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-gray-500 mt-1 truncate">{sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">入站列表</h2>
          <Link to="/inbounds/new" className="btn btn-primary text-xs">新建入站</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-800">
              <th className="pb-2 font-medium">端口</th>
              <th className="pb-2 font-medium">协议</th>
              <th className="pb-2 font-medium">备注</th>
              <th className="pb-2 font-medium">客户端</th>
              <th className="pb-2 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {inbounds.map((ib) => (
              <tr key={ib.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2.5">{ib.port}</td>
                <td className="py-2.5">
                  <span className="badge badge-green">{ib.protocol}</span>
                </td>
                <td className="py-2.5 text-gray-400">{ib.remark || '-'}</td>
                <td className="py-2.5">{ib.client_count}</td>
                <td className="py-2.5">
                  <span className={`badge ${ib.enabled ? 'badge-green' : 'badge-red'}`}>
                    {ib.enabled ? '运行' : '停用'}
                  </span>
                </td>
              </tr>
            ))}
            {inbounds.length === 0 && (
              <tr><td colSpan="5" className="py-6 text-center text-gray-600">暂无入站配置</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBytes(b) {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
}

function formatUptime(s) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
