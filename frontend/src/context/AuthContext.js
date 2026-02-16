import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('boma_token');
    const savedUser = localStorage.getItem('boma_user');
    if (token && savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        if (u.family_id) {
          const res = await API.get('/families/current');
          setFamily(res.data.family);
        }
      } catch {
        localStorage.removeItem('boma_token');
        localStorage.removeItem('boma_user');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    localStorage.setItem('boma_token', res.data.token);
    localStorage.setItem('boma_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    if (res.data.user.family_id) {
      const famRes = await API.get('/families/current');
      setFamily(famRes.data.family);
    }
    return res.data;
  };

  const register = async (name, email, password, role = 'parent') => {
    const res = await API.post('/auth/register', { name, email, password, role });
    localStorage.setItem('boma_token', res.data.token);
    localStorage.setItem('boma_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const createFamily = async (name) => {
    const res = await API.post('/families', { name });
    localStorage.setItem('boma_token', res.data.token);
    const updatedUser = { ...user, family_id: res.data.family.id };
    localStorage.setItem('boma_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    setFamily(res.data.family);
    return res.data;
  };

  const joinFamily = async (inviteCode) => {
    const res = await API.post('/families/join', { invite_code: inviteCode });
    localStorage.setItem('boma_token', res.data.token);
    const updatedUser = { ...user, family_id: res.data.family.id };
    localStorage.setItem('boma_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    setFamily(res.data.family);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('boma_token');
    localStorage.removeItem('boma_user');
    setUser(null);
    setFamily(null);
  };

  return (
    <AuthContext.Provider value={{ user, family, loading, login, register, createFamily, joinFamily, logout, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
