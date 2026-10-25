import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession } from '../types.js';
import { api } from '../lib/api.js';

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  loading: boolean;
  loginWithGoogle: (
    email: string,
    turnstileToken?: string,
    turnstileTicket?: string,
    name?: string
  ) => Promise<{ success: boolean; error?: string }>;
  login: (
    usernameOrEmail: string,
    password?: string,
    roleFallback?: string,
    turnstileToken?: string,
    turnstileTicket?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchRoleQuick: (role: 'admin' | 'owner') => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isAdmin: false,
  isOwner: false,
  loading: false,
  loginWithGoogle: async () => ({ success: false }),
  login: async () => ({ success: false }),
  logout: async () => {},
  switchRoleQuick: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('kms_token');
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('kms_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Normalize role strictly
        const role = (parsed.role || '').toLowerCase().includes('admin') ? 'admin' : 'owner';
        return { ...parsed, role };
      }
    } catch {}
    return null;
  });

  const [loading, setLoading] = useState<boolean>(false);

  // Sync token and user in localStorage and cookies for seamless img/download auth
  useEffect(() => {
    if (user) {
      localStorage.setItem('kms_user', JSON.stringify(user));
      try {
        document.cookie = `kms_role=${user.role}; path=/; max-age=604800; SameSite=Lax`;
      } catch {}
    } else {
      localStorage.removeItem('kms_user');
      try {
        document.cookie = 'kms_role=; path=/; max-age=0; SameSite=Lax';
      } catch {}
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('kms_token', token);
      try {
        document.cookie = `kms_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
      } catch {}
    } else {
      localStorage.removeItem('kms_token');
      try {
        document.cookie = 'kms_token=; path=/; max-age=0; SameSite=Lax';
      } catch {}
    }
  }, [token]);

  // Validate session on initial load if token exists
  useEffect(() => {
    let isCancelled = false;
    async function verifySession() {
      if (!token) return;
      try {
        const res = await api.getMe();
        if (!isCancelled && res.user) {
          const role = (res.user.role || '').toLowerCase().includes('admin') ? 'admin' : 'owner';
          setUser({ ...res.user, role });
        }
      } catch (err) {
        console.warn('Session verification failed, prompting re-login:', err);
        // Token expired or invalid on server
        if (!isCancelled) {
          logout();
        }
      }
    }

    if (token && user) {
      verifySession();
    }

    return () => {
      isCancelled = true;
    };
  }, []);

  const loginWithGoogle = async (
    email: string,
    turnstileToken?: string,
    turnstileTicket?: string,
    name?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const res = await api.loginWithGoogle({
        email,
        name,
        turnstileToken,
        turnstileTicket,
      });
      setToken(res.token);
      setUser(res.user);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Gagal masuk dengan akun Google. Periksa izin akun Anda.',
      };
    } finally {
      setLoading(false);
    }
  };

  const login = async (
    usernameOrEmail: string,
    password?: string,
    roleFallback?: string,
    turnstileToken?: string,
    turnstileTicket?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const res = await api.login(usernameOrEmail, password, roleFallback, turnstileToken, turnstileTicket);
      setToken(res.token);
      setUser(res.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal masuk. Periksa username dan kata sandi Anda.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    setToken(null);
    setUser(null);
    localStorage.removeItem('kms_token');
    localStorage.removeItem('kms_user');
    sessionStorage.removeItem('kms_turnstile_ticket');
  };

  const switchRoleQuick = async (role: 'admin' | 'owner') => {
    const password = role === 'admin' ? 'admin123' : 'owner123';
    const username = role;
    await login(username, password, role);
  };

  const normalizedRole = ((user?.role || '') as string).toLowerCase();
  const isAdmin = normalizedRole.includes('admin');
  const isOwner = normalizedRole.includes('owner') || normalizedRole.includes('petugas');
  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        isOwner,
        loading,
        loginWithGoogle,
        login,
        logout,
        switchRoleQuick,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
