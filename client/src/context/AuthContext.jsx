import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('vein_token'));
  const [username, setUsername] = useState(localStorage.getItem('vein_username'));

  const login = (tok, user) => {
    localStorage.setItem('vein_token', tok);
    localStorage.setItem('vein_username', user);
    setToken(tok);
    setUsername(user);
  };

  const logout = () => {
    localStorage.removeItem('vein_token');
    localStorage.removeItem('vein_username');
    setToken(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider value={{ token, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
