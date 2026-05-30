import { useState, useEffect, createContext, useContext } from 'react';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      setUser(JSON.parse(stored));
      connectSocket();
    }
    setLoading(false);
  }, []);

  async function login(email, password) {
    const { token, user } = await api.login({ email, password });
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    connectSocket();
  }

  async function register(email, password, display_name) {
    const { token, user } = await api.register({ email, password, display_name });
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    connectSocket();
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    disconnectSocket();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
