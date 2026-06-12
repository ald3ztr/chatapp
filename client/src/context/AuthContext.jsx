// Kimlik durumu (FAZ 1)
// Acilisifta token varsa otomatik oturum acar; kayit/cikis/profil guncelleme saglar.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { clearToken, getToken, setToken } from '../lib/session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // ilk otomatik-oturum kontrolu

  // Acilista: token varsa kullaniciyi getir (giris bilgisi SORULMADAN)
  useEffect(() => {
    let active = true;
    (async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await api.me();
        if (active) setUser(user);
      } catch {
        // Token gecersizse temizle
        clearToken();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const register = useCallback(async (formData) => {
    const { token, user } = await api.register(formData);
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const updateProfile = useCallback(async (formData) => {
    const { user } = await api.updateProfile(formData);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = { user, loading, register, updateProfile, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth bir AuthProvider icinde kullanilmali');
  return ctx;
}
