import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import api from '../api/client.js';
import Icon from './Icon.jsx';
import NotificationBell from './NotificationBell.jsx';
import { LANGS } from '../i18n.js';
import { getAccountType } from '../utils/accountType.js';

const TITLES = {
  '/': ['Kitchen Stock', 'Live view of everything in your kitchen'],
  '/recipes': ['Recipe Library', 'Cook from what you have - with YouTube help'],
  '/planner': ['Meal Planner', 'Optimized around your stock, family size and budget'],
  '/nutrition': ['Nutrition Planner', 'Daily food log and nutrition goals for each household member'],
  '/shopping': ['Smart Shopping', 'Manage your list, mark purchases, and hand off orders'],
  '/price-compare': ['Store Offers', 'Compare live store listings for your delivery area'],
  '/scan': ['Scan & Detect', 'Expiry date checker + receipt scanner - your phone is the scanner'],
  '/devices': ['Storage', 'Track weighed stock and storage points'],
  '/analytics': ['Insights & Accuracy', 'Wastage, spend, accuracy and who did what'],
  '/vendors': ['Vendor Restocking', 'Prepare a restock message for your suppliers'],
  '/profile': ['Profile', 'Your kitchen, people and food preferences']
};

function navigation(accountType) {
  const household = [
    { to: '/', labelKey: 'dashboard', icon: 'dashboard' },
    { to: '/recipes', labelKey: 'recipes', icon: 'recipes' },
    { to: '/planner', labelKey: 'planner', icon: 'planner' },
    { to: '/nutrition', labelKey: 'nutrition', icon: 'flame' },
    { to: '/shopping', labelKey: 'shopping', icon: 'cart' },
    { to: '/price-compare', label: 'Store Offers', icon: 'search' },
    { to: '/scan', label: 'Scan & Detect', icon: 'scan', premium: true },
    { to: '/profile', labelKey: 'profile', icon: 'user' }
  ];
  const business = [
    { to: '/', labelKey: 'dashboard', icon: 'dashboard' },
    { to: '/recipes', labelKey: 'recipes', icon: 'recipes' },
    { to: '/shopping', labelKey: 'shopping', icon: 'cart' },
    { to: '/scan', label: 'Scan & Detect', icon: 'scan' },
    { to: '/devices', label: 'Storage', icon: 'chip' },
    { to: '/analytics', label: 'Insights & Accuracy', icon: 'analytics' },
    { to: '/vendors', label: 'Vendor Restocking', icon: 'truck' },
    { to: '/profile', labelKey: 'profile', icon: 'user' }
  ];
  return accountType === 'household' ? household : business;
}

const DIET_OPTIONS = [
  ['veg', 'Vegetarian'], ['egg', 'Eggetarian'], ['nonveg', 'Non-vegetarian'],
  ['vegan', 'Vegan'], ['jain', 'Jain'], ['custom', 'All diets']
];

function DietPreferenceControl({ compact = false }) {
  const { user, setUser, toast } = useApp();
  const [saving, setSaving] = useState(false);
  const selected = DIET_OPTIONS.some(([value]) => value === user?.household?.diet) ? user.household.diet : 'veg';

  const changeDiet = async (event) => {
    const diet = event.target.value;
    if (diet === selected || saving) return;
    setSaving(true);
    try {
      const { data } = await api.put('/auth/me', { household: { ...(user?.household || {}), diet } });
      setUser(data.user);
      let planUpdated = true;
      try { await api.post('/planner/generate', {}); }
      catch { planUpdated = false; }
      window.dispatchEvent(new Event('ks:household-diet-changed'));
      toast(
        planUpdated ? 'Household default updated. Individual diet overrides stay in place.' : 'Preference saved. Re-optimize the meal plan to apply it.',
        planUpdated ? 'ok' : 'warn',
        'Food preference'
      );
    } catch (error) {
      toast(error.response?.data?.error || 'Could not update food preference', 'err');
    } finally { setSaving(false); }
  };

  return (
    <label className={`diet-pref-control ${compact ? 'compact diet-pref-mobile' : 'diet-pref-desktop'}`} title="Household default food preference">
      <Icon name="leaf" size={15} />
      {!compact && <span>Food</span>}
      <select aria-label="Household default food preference" value={selected} onChange={changeDiet} disabled={saving}>
        {DIET_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}

function Logo() {
  return (
    <div className="logo">
      <div className="logo-badge"><Icon name="leaf" size={19} /></div>
      <div>
        <div className="logo-name">KitchenSync</div>
        <div className="logo-sub">A little more in rhythm</div>
      </div>
    </div>
  );
}

function LangToggle() {
  const { lang, setLang } = useApp();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {Object.entries(LANGS).map(([code, label]) => (
        <button key={code} className={lang === code ? 'active' : ''} onClick={() => setLang(code)}>
          {code === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  );
}

export default function Layout() {
  const { user, mode, theme, setTheme, logout, notifs, t, lang } = useApp();
  const loc = useLocation();
  const accountType = getAccountType(user);
  const navItems = navigation(accountType);
  const [baseTitle, sub] = TITLES[loc.pathname] || ['KitchenSync', ''];
  const title = loc.pathname === '/devices' ? 'Storage' : baseTitle;

  return (
    <div className="app-shell" data-lang={lang}>
      <aside className="sidebar">
        <Logo />
        <nav className="side-nav">
          {navItems.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={n.icon} />
              <span>{n.label || t(n.labelKey)}</span>
              {n.premium && <span className="premium-nav-tag">Premium</span>}
              {n.to === '/analytics' && notifs.unread > 0 && <span className="nav-count">{notifs.unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <span className={`mode-pill ${mode === 'mongo' ? 'live' : ''}`} title={mode === 'mongo' ? 'Connected to MongoDB - data persists' : 'Temporary store - set MONGO_URI to persist'}>
            {mode === 'mongo' ? 'MONGODB LIVE' : 'DEMO MODE'}
          </span>
          <div className="user-chip">
            <div className="avatar">{(user && user.name || 'U').slice(0, 1).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name">{user && user.name}</div>
              <div className="user-mail">{user && user.email}</div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={logout} title="Logout" style={{ marginLeft: 'auto' }}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="mobile-top">
          <Logo />
          <div className="flex mobile-top-actions">
            {accountType === 'household' && <DietPreferenceControl compact />}
            <LangToggle />
            <NotificationBell />
            <button className="btn btn-ghost btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </div>

        <div className="topbar">
          {loc.pathname !== '/' ? <div>
            <h1>{title}</h1>
            <div className="crumb">{sub}</div>
          </div> : <div />}
          <div className="topbar-actions">
            {accountType === 'household' && <DietPreferenceControl />}
            <LangToggle />
            <NotificationBell />
            <button className="btn btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </div>

        <main className="content">
          <AnimatePresence mode="wait">
            <motion.div
              key={loc.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <nav className="bottom-nav">
        {navItems.filter((n) => accountType === 'household' ? ['/', '/planner', '/nutrition', '/shopping', '/price-compare', '/scan'].includes(n.to) : ['/', '/shopping', '/devices', '/vendors'].includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={n.icon} size={19} />
            {(n.label || t(n.labelKey)).split(' ')[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
