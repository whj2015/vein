import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api/client';
import { Server } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const { login } = useContext(AuthContext);
  const nav = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isSetup) {
        await api.post('/auth/setup', { username, password });
      }
      const { data } = await api.post('/auth/login', { username, password });
      login(data.token, data.username);
      nav('/');
    } catch (err) {
      const msg = err.response?.data?.error || '登录失败';
      if (msg.includes('已初始化')) {
        setIsSetup(false);
        setError('管理员已存在，请直接登录');
      } else {
        setError(msg);
        if (!isSetup && msg.includes('用户名或密码错误')) {
          // 可能是首次使用，提示 setup
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <Server className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Vein</h1>
          <p className="text-gray-500 text-sm mt-1">Xray Management Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="input"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <input
            className="input"
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          <button type="submit" className="btn btn-primary w-full">
            登录
          </button>
          {!isSetup && (
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => setIsSetup(true)}
            >
              首次初始化
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
