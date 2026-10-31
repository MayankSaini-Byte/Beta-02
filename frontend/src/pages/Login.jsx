import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { errMsg } from '../api/client.js';
import Icon from '../components/Icon.jsx';

const FEATURES = [
  ['box', 'Out of stock? KitchenSync auto-builds your shopping list and finds the best price across Swiggy Instamart, Blinkit, Zepto and BigBasket.'],
  ['planner', 'A weekly meal planner optimized around what you already have - adults and children portions handled automatically.'],
  ['scan', 'Scan barcodes or snap a photo of vegetables - items land in your stock with expiry reminders set automatically.']
];

export default function Login() {
  const { login, register, demo, toast } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
      }
      nav('/');
    } catch (err) {
      toast(errMsg(err), 'err', tab === 'login' ? 'Login failed' : 'Signup failed');
    }
    setBusy(false);
  };

  const demoLogin = async () => {
    setBusy(true);
    try {
      await demo();
      toast('Welcome to the KitchenSync demo kitchen!', 'ok', 'Demo loaded');
      nav('/');
    } catch (err) {
      toast(errMsg(err), 'err');
    }
    setBusy(false);
  };

  return (
    <div className="login-split">
      <div className="brand-panel">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="logo">
            <div className="logo-badge"><Icon name="flame" size={19} /></div>
            <div>
              <div className="logo-name" style={{ fontSize: 19 }}>KitchenSync</div>
              <div className="logo-sub">PS-5 Smart Kitchen Platform</div>
            </div>
          </div>
          <h1 className="brand-title">
            Your kitchen, <span className="grad">perfectly in sync.</span>
          </h1>
          <p className="brand-sub">
            Track every ingredient, cook smart with what you have, and never overpay for groceries again.
          </p>
          <div className="feature-list">
            {FEATURES.map(([icon, text], i) => (
              <motion.div
                key={icon} className="feature-item"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.15, duration: 0.4 }}
              >
                <span className="fi"><Icon name={icon} /></span>
                <span>{text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="auth-side">
        <motion.div className="auth-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.45 }}>
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Login</button>
            <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Create account</button>
          </div>

          <form onSubmit={submit}>
            {tab === 'register' && (
              <div className="field">
                <label className="label">Family / your name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sharma Family" required />
              </div>
            )}
            <div className="field">
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 characters" required minLength={6} />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {tab === 'login' ? 'Login to kitchen' : 'Create my kitchen'}
            </button>
          </form>

          <div className="flex mt-2" style={{ gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span className="tiny faint">or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button className="btn btn-block mt-2" onClick={demoLogin} disabled={busy}>
            <Icon name="sparkles" /> Explore the demo kitchen
          </button>
          <p className="tiny faint tc mt-1">
            Loads a seeded pantry (41 items, 23 recipes) so you can see every feature instantly.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
