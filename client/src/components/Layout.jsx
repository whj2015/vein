import { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  LayoutDashboard,
  Network,
  Settings,
  LogOut,
  Server,
  Sparkles,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/inbounds', icon: Network, label: '入站管理' },
  { to: '/ai-config', icon: Sparkles, label: 'AI 配置' },
  { to: '/settings', icon: Settings, label: '设置' },
];

export default function Layout({ children }) {
  const { username, logout } = useContext(AuthContext);
  const nav = useNavigate();

  const handleLogout = () => {
    logout();
    nav('/login');
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-500" />
          <span className="font-bold text-lg">Vein</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">{username}</span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300"
              title="退出"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
