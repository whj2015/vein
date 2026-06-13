import { Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inbounds from './pages/Inbounds';
import InboundEdit from './pages/InboundEdit';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import AiConfig from './pages/AiConfig';

function PrivateRoute({ children }) {
  const { token } = useContext(AuthContext);
  return token ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/inbounds" element={<Inbounds />} />
                <Route path="/inbounds/new" element={<InboundEdit />} />
                <Route path="/inbounds/:id/edit" element={<InboundEdit />} />
                <Route path="/inbounds/:id/clients" element={<Clients />} />
                <Route path="/ai-config" element={<AiConfig />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
