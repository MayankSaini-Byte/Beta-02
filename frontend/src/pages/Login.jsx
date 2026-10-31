import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import { errMsg } from '../api/client.js';
import Icon from '../components/Icon.jsx';

export default function Login() {
  const { login, register, demo, toast } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', accountType: 'household' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === 'login') {
        const result = await login(form.email, form.password);
        nav(result.user?.onboardingComplete === false ? '/onboarding' : '/');
      } else {
        await register(form.name, form.email, form.password, { accountType: form.accountType });
        nav('/onboarding');
      }
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
    <div className="auth-page">
      <section className="auth-story">
        <div className="auth-story-kicker"><span className="auth-status-dot" /> A LITTLE MORE IN RHYTHM</div>
        <motion.div className="auth-story-body" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
          <div className="auth-story-copy">
            <div className="auth-story-overline">YOUR KITCHEN, IN SYNC</div>
            <h1>Make room<br />for <em>good things.</em></h1>
            <p>Know what’s on your shelves. Make a plan that fits your people. Waste a little less.</p>
          </div>
          <div className="pantry-preview" aria-label="A preview of kitchen stock and the week's meals">
            <div className="pantry-preview-head"><span><Icon name="box" size={14} /> KITCHENSYNC AT A GLANCE</span><span className="preview-live"><i /> SAMPLE</span></div>
            <div className="pantry-preview-stats"><div><b>24</b><span>ingredients</span></div><div><b>03</b><span>meals planned</span></div><div><b>02</b><span>use soon</span></div></div>
            <div className="preview-stock-row"><span className="preview-food-dot green" /> <span>Fresh produce</span><span className="preview-stock-bar"><i style={{ width: '76%' }} /></span><b>76%</b></div>
            <div className="preview-stock-row"><span className="preview-food-dot gold" /> <span>Pantry staples</span><span className="preview-stock-bar"><i style={{ width: '58%' }} /></span><b>58%</b></div>
            <div className="preview-meal"><span className="preview-meal-icon"><Icon name="planner" size={15} /></span><span><b>Tonight, sorted</b><small>Dal tadka · 4 servings</small></span><Icon name="chevR" size={15} /></div>
          </div>
          <div className="auth-story-foot">INVENTORY <span>·</span> MEALS <span>·</span> LESS WASTE</div>
        </motion.div>
      </section>

      <section className="auth-panel">
        <header className="auth-header">
          <div className="auth-brand"><span className="auth-brand-mark"><Icon name="flame" size={20} /></span><span>KitchenSync</span></div>
          <div className="auth-switch">{tab === 'login' ? 'New to KitchenSync?' : 'Already have an account?'} <button type="button" onClick={() => setTab(tab === 'login' ? 'register' : 'login')}>{tab === 'login' ? 'Sign Up' : 'Sign In'}</button></div>
        </header>

        <motion.div className="auth-main" key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="auth-form-heading">
            <div className="auth-form-eyebrow">{tab === 'login' ? 'WELCOME BACK' : 'A FRESH START'}</div>
            <h2>{tab === 'login' ? 'Sign in' : 'Create your kitchen'}</h2>
            <p>{tab === 'login' ? 'Pick up where your kitchen left off.' : 'A few details to make your kitchen yours.'}</p>
          </div>

          <form onSubmit={submit} className="auth-form">
            {tab === 'register' && (
              <div className="field auth-field">
                <label className="label">Your name or kitchen name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sharma Kitchen" required />
              </div>
            )}
            {tab === 'register' && <div className="field">
              <label className="label">How will you use KitchenSync?</label>
              <div className="kitchen-type-grid">
                {[
                  ['household', 'Household', 'Plan meals and groceries for your family'],
                  ['commercial', 'Commercial kitchen', 'Restaurant, cloud kitchen or café'],
                  ['service', 'Food service', 'Tiffin centre or PG']
                ].map(([value, label, description]) => <button type="button" key={value} className={`kitchen-type-option ${form.accountType === value ? 'active' : ''}`} onClick={() => setForm({ ...form, accountType: value })}><b>{label}</b><small>{description}</small></button>)}
              </div>
            </div>}
            {tab === 'register' && <p className="small muted">Next, we’ll ask a few details for your {form.accountType === 'household' ? 'household' : form.accountType === 'commercial' ? 'business' : 'food service'} profile.</p>}
            <div className="field auth-field">
              <label className="label">Email</label>
              <input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
            </div>
            <div className="field auth-field">
              <label className="label">Password</label>
              <input className="input" type="password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={tab === 'login' ? 'Enter your password' : 'At least 6 characters'} required minLength={tab === 'register' ? 6 : undefined} />
            </div>
            <button className="btn btn-primary btn-block auth-submit" disabled={busy}>
              <Icon name={tab === 'login' ? 'unlock' : 'plus'} /> {busy ? 'One moment…' : tab === 'login' ? 'Sign In' : 'Create my kitchen'}
            </button>
          </form>

          <div className="auth-divider"><span>OR</span></div>
          <button className="btn btn-block auth-demo" onClick={demoLogin} disabled={busy}>
            <Icon name="sparkles" /> Explore the demo kitchen
          </button>
          <p className="auth-demo-note">Take a look around with a ready-to-use sample kitchen.</p>
          <div className="auth-secure"><Icon name="lock" size={13} /> Your kitchen data stays in your local KitchenSync account.</div>
        </motion.div>
      </section>
    </div>
  );
}
