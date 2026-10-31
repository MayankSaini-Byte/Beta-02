import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import api from '../api/client.js';
import { makeT } from '../i18n.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ks_token') || '');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ks_user') || 'null'); } catch { return null; }
  });
  const [mode, setMode] = useState(() => localStorage.getItem('ks_mode') || 'memory');
  const [theme, setTheme] = useState(() => localStorage.getItem('ks_theme') || 'dark');
  const [toasts, setToasts] = useState([]);
  const [notifs, setNotifs] = useState({ notifications: [], unread: 0 });
  const toastId = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ks_theme', theme);
  }, [theme]);

  const persist = (t, u, m) => {
    localStorage.setItem('ks_token', t);
    localStorage.setItem('ks_user', JSON.stringify(u));
    if (m) localStorage.setItem('ks_mode', m);
    setToken(t);
    setUser(u);
    if (m) setMode(m);
  };

  const logout = () => {
    localStorage.removeItem('ks_token');
    localStorage.removeItem('ks_user');
    setToken('');
    setUser(null);
  };

  // Re-sync persistence mode on boot (token survives reloads)
  useEffect(() => {
    if (!token) return;
    api.get('/auth/me').then(({ data }) => {
      if (data.mode) { localStorage.setItem('ks_mode', data.mode); setMode(data.mode); }
      if (data.user) {
        localStorage.setItem('ks_user', JSON.stringify(data.user));
        setUser(data.user);
      }
    }).catch(() => {});
  }, []);

  const toast = useCallback((msg, type = 'ok', title = null) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts, { id, msg, type, title }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200);
  }, []);

  const refreshNotifs = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get('/notifications');
      setNotifs(data);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refreshNotifs();
    const iv = setInterval(refreshNotifs, 45000);
    return () => clearInterval(iv);
  }, [token, refreshNotifs]);

  const login = async (name, password) => {
    const { data } = await api.post('/auth/login', { name, password });
    persist(data.token, data.user, data.mode);
    return data;
  };

  const register = async (name, password, kitchen = {}) => {
    const { data } = await api.post('/auth/register', { name, password, ...kitchen });
    persist(data.token, data.user, data.mode);
    return data;
  };

  const demo = async () => {
    const { data } = await api.post('/auth/demo');
    persist(data.token, data.user, data.mode);
    return data;
  };

  const updateUser = (u) => {
    setUser(u);
    localStorage.setItem('ks_user', JSON.stringify(u));
  };

  const value = useMemo(() => ({
    token, user, mode, setUser: updateUser,
    login, register, demo, logout,
    theme, setTheme,
    lang: (user && user.prefs && user.prefs.lang) || localStorage.getItem('ks_lang') || 'en',
    t: makeT((user && user.prefs && user.prefs.lang) || localStorage.getItem('ks_lang') || 'en'),
    setLang: async (lang) => {
      localStorage.setItem('ks_lang', lang);
      if (token) {
        try { const { data } = await api.put('/auth/me', { prefs: { lang } }); updateUser(data.user); }
        catch { updateUser({ ...user, prefs: { ...(user.prefs || {}), lang } }); }
      } else if (user) updateUser({ ...user, prefs: { ...(user.prefs || {}), lang } });
    },
    toasts, toast,
    notifs, refreshNotifs
  }), [token, user, mode, theme, toasts, notifs, refreshNotifs, toast]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
