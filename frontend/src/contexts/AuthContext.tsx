import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api';
import api from '../api/client';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authEnabled: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if auth is enabled
      const status = await authApi.getStatus();
      setAuthEnabled(status.auth_enabled);

      // If auth is disabled, auto-login
      if (!status.auth_enabled) {
        try {
          const token = await authApi.login('default', 'default');
          localStorage.setItem('token', token);
        } catch {
          // Try direct API call for disabled auth
          const { data } = await api.post('/auth/login', 
            new URLSearchParams({ username: 'default', password: 'default' }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
          );
          localStorage.setItem('token', data.access_token);
        }
      }

      // Check if we have a valid token
      const token = localStorage.getItem('token');
      if (token) {
        const me = await authApi.getMe();
        setUser(me);
      }
    } catch {
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const token = await authApi.login(username, password);
    localStorage.setItem('token', token);
    const me = await authApi.getMe();
    setUser(me);
  };

  const register = async (username: string, password: string) => {
    await authApi.register(username, password);
    await login(username, password);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authEnabled,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
