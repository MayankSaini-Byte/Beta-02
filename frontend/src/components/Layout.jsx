import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import Icon from './Icon.jsx';
import NotificationBell from './NotificationBell.jsx';
import { LANGS } from '../i18n.js';

const NAV = [
  { to: '/', labelKey: 'dashboard', icon: 'dashboard' },
  { to: '/recipes', labelKey: 'recipes', icon: 'recipes' },
  { to: '/planner', labelKey: 'planner', icon: 'planner' },
  { to: '/shopping', labelKey: 'shopping', icon: 'cart' },
  { to: '/scan', labelKey: 'scan', icon: 'scan' },
  { to: '/devices', labelKey: 'devices', icon: 'chip' },
  { to: '/analytics', labelKey: 'insights', icon: 'analytics' },
  { to: '/settings', labelKey: 'settings', icon: 'settings' }
];

const TITLES = {
  '/': ['Kitchen Stock', 'Live view of everything in your kitchen'],
  '/recipes': ['Recipe Library', 'Cook from what you have - with YouTube help'],
  '/planner': ['Meal Planner', 'Optimized around your stock, family size and budget'],
  '/shopping': ['Smart Shopping', 'Auto list, 4-store comparison (simulated) + deep-link order hand-off'],
  '/scan': ['Scan & Detect', 'Expiry date checker + receipt scanner - your phone is the scanner'],
  '/devices': ['Smart Containers', 'IoT sensors + load-cell weighing station'],
  '/analytics': ['Insights & Accuracy', 'Wastage, spend, accuracy and who did what'],
  '/settings': ['Settings', 'Household, members, language and data']
};

function Logo() {
  return (
    <div className="logo">
      <div className="logo-badge"><Icon name="flame" size={19} /></div>
      <div>
        <div className="logo-name">KitchenSync</div>
        <div className="logo-sub">PS-5 · Your kitchen, in sync</div>
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
  const [title, sub] = TITLES[loc.pathname] || ['KitchenSync', ''];

  return (
    <div className="app-shell" data-lang={lang}>
      <aside className="sidebar">
        <Logo />
        <nav className="side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={n.icon} />
              {t(n.labelKey)}
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
          <div className="flex">
            <LangToggle />
            <NotificationBell />
            <button className="btn btn-ghost btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </div>

        <div className="topbar" style={{ display: loc.pathname === '/' ? 'none' : undefined }}>
          <div>
            <h1>{title}</h1>
            <div className="crumb">{sub}</div>
          </div>
          <div className="topbar-actions">
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
        {NAV.filter((n) => !['/settings', '/devices'].includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={n.icon} size={19} />
            {t(n.labelKey).split(' ')[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
