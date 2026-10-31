import { useEffect, useState } from 'react';
import api, { inr } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';
import { LANGS } from '../i18n.js';

export default function Settings() {
  const { user, setUser, toast, mode, t, lang, setLang } = useApp();
  const [hh, setHh] = useState({ ...(user?.household || {}) });
  const [members, setMembers] = useState([]);
  const [newMember, setNewMember] = useState({ name: '', role: 'member', type: 'adult' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [me, mem] = await Promise.all([api.get('/auth/me'), api.get('/members')]);
    setUser(me.data.user);
    setMembers(mem.data.members);
    setHh({ ...(me.data.user.household || {}) });
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/auth/me', { household: hh });
      setUser(data.user);
      toast('Household saved - recipes and plans will rescale', 'ok', 'Saved');
    } catch (e) { toast(e.response?.data?.error || 'Could not save', 'err'); }
    setSaving(false);
  };

  const addMember = async () => {
    if (!newMember.name.trim()) return;
    try {
      const { data } = await api.post('/members', newMember);
      setMembers(data.members);
      setNewMember({ name: '', role: 'member', type: 'adult' });
      toast(`${data.member.name} joined the kitchen`, 'ok', 'Member added');
    } catch (e) { toast(e.response?.data?.error || 'Could not add member', 'err'); }
  };

  const updateMember = async (id, patch) => {
    try {
      const { data } = await api.patch(`/members/${id}`, patch);
      setMembers(data.members);
    } catch { toast('Could not update member', 'err'); }
  };

  const removeMember = async (id) => {
    try {
      const { data } = await api.delete(`/members/${id}`);
      setMembers(data.members);
    } catch { toast('Could not remove', 'err'); }
  };

  return (
    <div>
      {/* Household profile */}
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Household & tastes</h2>
        <div className="sub small muted mb-2">Portions scale automatically: adults = 1.0, children = 0.5 serving</div>
        <div className="flex wrap" style={{ gap: 10 }}>
          <label className="small muted">Adults
            <input className="input" type="number" min="1" max="12" style={{ width: 90, display: 'block', marginTop: 4 }} value={hh.adults ?? 2} onChange={(e) => setHh({ ...hh, adults: Number(e.target.value) })} />
          </label>
          <label className="small muted">Children
            <input className="input" type="number" min="0" max="12" style={{ width: 90, display: 'block', marginTop: 4 }} value={hh.children ?? 0} onChange={(e) => setHh({ ...hh, children: Number(e.target.value) })} />
          </label>
          <label className="small muted">Diet
            <select className="input" style={{ width: 130, display: 'block', marginTop: 4 }} value={hh.diet || 'veg'} onChange={(e) => setHh({ ...hh, diet: e.target.value })}>
              {['veg', 'egg', 'nonveg', 'vegan'].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="small muted">Weekly budget (₹)
            <input className="input" type="number" min="0" style={{ width: 130, display: 'block', marginTop: 4 }} value={hh.weeklyBudget ?? 1500} onChange={(e) => setHh({ ...hh, weeklyBudget: Number(e.target.value) })} />
          </label>
          <label className="small muted">Gym goal
            <select className="input" style={{ width: 130, display: 'block', marginTop: 4 }} value={hh.goal || 'none'} onChange={(e) => setHh({ ...hh, goal: e.target.value })}>
              {['none', 'cut', 'bulk', 'maintain'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        </div>
        <button className="btn btn-primary mt-2" onClick={saveProfile} disabled={saving}><Icon name="check" /> Save household</button>
      </div>

      {/* Members */}
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Household members</h2>
        <div className="sub small muted mb-2">Admins can change everything; members can mark meals done and tick shopping items - every action is logged in the activity feed.</div>
        {members.map((m) => (
          <div key={m.id} className="member-row">
            <div className="avatar">{m.name.slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <input className="input" style={{ maxWidth: 180, padding: '5px 9px', fontSize: 13 }} value={m.name} onChange={(e) => updateMember(m.id, { name: e.target.value })} />
            </div>
            <select className="input" style={{ width: 105, padding: '5px 8px', fontSize: 12.5 }} value={m.role} onChange={(e) => updateMember(m.id, { role: e.target.value })}>
              <option value="admin">admin</option>
              <option value="member">member</option>
            </select>
            <select className="input" style={{ width: 100, padding: '5px 8px', fontSize: 12.5 }} value={m.type} onChange={(e) => updateMember(m.id, { type: e.target.value })}>
              <option value="adult">adult</option>
              <option value="child">child</option>
            </select>
            <span className={`role-pill role-${m.role}`}>{m.role}</span>
            <button className="btn btn-ghost btn-icon" onClick={() => removeMember(m.id)} title="Remove"><Icon name="trash" size={14} /></button>
          </div>
        ))}
        <div className="flex wrap mt-2" style={{ gap: 8 }}>
          <input className="input" style={{ maxWidth: 190 }} placeholder="Name" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addMember()} />
          <select className="input" style={{ width: 105 }} value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}>
            <option value="member">member</option><option value="admin">admin</option>
          </select>
          <select className="input" style={{ width: 100 }} value={newMember.type} onChange={(e) => setNewMember({ ...newMember, type: e.target.value })}>
            <option value="adult">adult</option><option value="child">child</option>
          </select>
          <button className="btn" onClick={addMember}><Icon name="plus" /> Add member</button>
        </div>
      </div>

      {/* Language + appearance */}
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Language & appearance</h2>
        <div className="flex wrap mt-2" style={{ gap: 16 }}>
          <div>
            <div className="small muted mb-1">Language / भाषा</div>
            <div className="lang-toggle">
              {Object.entries(LANGS).map(([code, label]) => (
                <button key={code} className={lang === code ? 'active' : ''} onClick={() => setLang(code)}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="small muted mb-1">Theme</div>
            <button className="btn" onClick={() => document.documentElement.dataset.theme === 'light' ? '' : ''} style={{ display: 'none' }} />
            <span className="small muted">Use the sun/moon button in the top bar - dark & cream-light both styled.</span>
          </div>
        </div>
      </div>

      {/* Data & persistence */}
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Data & persistence</h2>
        <div className="flex wrap mt-2" style={{ gap: 8 }}>
          <span className={`chip ${mode === 'mongo' ? 'chip-ok' : 'chip-warn'}`}>
            {mode === 'mongo' ? 'MongoDB connected - data persists across restarts' : 'Temporary store - set MONGO_URI to persist'}
          </span>
          <a className="btn" href="/api/pantry/export" target="_blank" rel="noreferrer"><Icon name="upload" /> Export inventory CSV</a>
        </div>
        <div className="small muted mt-2">
          Backend: Node.js + Express + MongoDB (Mongoose models in <code>backend/src/models/</code>).
          Drivers: mongo (persistent) / file (persistent, zero-config) / memory (demo). See <code>kitchensync/README.md</code>.
        </div>
      </div>
    </div>
  );
}
