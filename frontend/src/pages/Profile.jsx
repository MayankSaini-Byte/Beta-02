import { useEffect, useMemo, useState } from 'react';
import api, { downloadInventoryCsv } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { LANGS } from '../i18n.js';
import { getAccountType } from '../utils/accountType.js';
import Icon from '../components/Icon.jsx';

const DIETS = [
  ['inherit', 'Use household default'],
  ['veg', 'Vegetarian'],
  ['egg', 'Eggetarian'],
  ['nonveg', 'Non-vegetarian'],
  ['vegan', 'Vegan'],
  ['jain', 'Jain'],
  ['custom', 'All diets']
];
const DEFAULT_DIET = 'veg';

function draftPerson(index, overrides = {}) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `person-${Date.now()}-${index}`,
    name: `Person ${index + 1}`,
    role: index === 0 ? 'admin' : 'member',
    type: 'adult',
    diet: 'inherit',
    allergies: [],
    calorieTarget: 2000,
    proteinTarget: 75,
    ...overrides
  };
}

function peopleFromUser(user) {
  if (Array.isArray(user.members) && user.members.length) {
    return user.members.map((person) => ({
      ...person,
      diet: person.diet || 'inherit',
      allergies: Array.isArray(person.allergies) ? person.allergies : []
    }));
  }
  if (user.household?.kitchenType && user.household.kitchenType !== 'household') return [];
  const storedAdults = Number(user.household?.adults);
  const adults = Number.isFinite(storedAdults) ? Math.max(0, Math.min(24, storedAdults)) : 2;
  const children = Math.max(0, Math.min(24 - adults, Number(user.household?.children) || 0));
  const people = [];
  for (let i = 0; i < adults + children; i++) {
    const isChild = i >= adults;
    people.push(draftPerson(i, {
      name: i === 0 ? (user.name || 'You') : `${isChild ? 'Child' : 'Adult'} ${isChild ? i - adults + 1 : i + 1}`,
      role: i === 0 ? 'admin' : 'member',
      type: isChild ? 'child' : 'adult',
      diet: 'inherit',
      calorieTarget: isChild ? 1500 : 2000
    }));
  }
  return people;
}

export default function Profile() {
  const { user, setUser, toast, mode, lang, setLang, theme, setTheme } = useApp();
  const [accountType, setAccountType] = useState(getAccountType(user));
  const [business, setBusiness] = useState(() => {
    const saved = user?.businessProfile || {};
    return { outletName: '', address: '', dailyServings: 50, vendorContact: '', ...saved, businessType: saved.businessType || (getAccountType(user) === 'service' ? 'tiffin' : 'restaurant') };
  });
  const [name, setName] = useState(user?.name || '');
  const [hh, setHh] = useState({
    kitchenType: 'household', residents: 2, adults: 2, children: 0, diet: DEFAULT_DIET,
    weeklyBudget: 1500, goal: 'none', cuisines: [], allergies: [], tastes: [], ...(user?.household || {})
  });
  const [members, setMembers] = useState(() => peopleFromUser(user || {}));
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      const current = data.user;
      setUser(current);
      setAccountType(getAccountType(current));
      setBusiness({ outletName: '', address: '', dailyServings: 50, vendorContact: '', ...(current.businessProfile || {}), businessType: current.businessProfile?.businessType || (getAccountType(current) === 'service' ? 'tiffin' : 'restaurant') });
      setName(current.name || '');
      setHh({
        kitchenType: 'household', residents: 2, adults: 2, children: 0, diet: DEFAULT_DIET,
        weeklyBudget: 1500, goal: 'none', cuisines: [], allergies: [], tastes: [], ...(current.household || {})
      });
      setMembers(peopleFromUser(current));
    }).catch(() => toast('Could not load your profile', 'err'));
  }, []);

  useEffect(() => {
    if (user?.household?.diet) setHh((current) => ({ ...current, diet: user.household.diet }));
  }, [user?.household?.diet]);

  const householdSize = useMemo(() => members.length, [members]);
  const updatePerson = (id, patch) => setMembers((rows) => rows.map((person) => person.id === id ? { ...person, ...patch } : person));
  const addPerson = () => {
    if (members.length >= 24) return toast('A profile can include up to 24 people', 'warn');
    setMembers((rows) => [...rows, draftPerson(rows.length)]);
  };

  const removePerson = (id) => {
    if (members.length <= 1 && accountType === 'household') return toast('Keep at least one person in a household profile', 'warn');
    setMembers((rows) => rows.filter((person) => person.id !== id));
  };

  const saveProfile = async () => {
    if (!name.trim()) return toast('Your name is required', 'warn');
    if (accountType !== 'household' && (!business.outletName.trim() || !business.address.trim() || Number(business.dailyServings) < 1)) return toast('Complete the outlet name, location, and daily serving estimate', 'warn');
    if (accountType === 'household' && hh.pincode && !/^[1-9]\d{5}$/.test(String(hh.pincode).trim())) return toast('Delivery PIN must be six digits and cannot start with 0', 'warn');
    if (members.some((person) => !person.name.trim())) return toast('Give each person a name', 'warn');
    setSaving(true);
    const adults = members.filter((person) => person.type === 'adult').length;
    const children = members.filter((person) => person.type === 'child').length;
    const household = {
      ...hh,
      kitchenType: accountType === 'household' ? 'household' : accountType === 'service' ? 'hostel' : 'commercial',
      adults,
      children,
      residents: accountType === 'household' ? Math.max(1, members.length) : Math.max(1, Number(business.dailyServings || hh.residents) || 1),
      allergies: (hh.allergies || []).map((value) => String(value).trim()).filter(Boolean),
      cuisines: [...new Set((hh.cuisines || []).map((value) => String(value).trim()).filter(Boolean))],
      tastes: [...new Set((hh.tastes || []).map((value) => String(value).trim()).filter(Boolean))]
    };
    try {
      const { data } = await api.put('/auth/me', {
        name: name.trim(),
        accountType,
        onboardingComplete: true,
        household: accountType === 'household' ? household : { ...hh, kitchenType: household.kitchenType, residents: household.residents, address: business.address },
        businessProfile: accountType === 'household' ? undefined : { ...business, dailyServings: Number(business.dailyServings) || 0 },
        members: accountType === 'household' ? (members.length ? members : [draftPerson(0, { name: name.trim(), role: 'admin' })]).map((person) => ({
          ...person,
          name: person.name.trim(),
          diet: person.diet || 'inherit',
          allergies: (person.allergies || []).map((value) => String(value).trim()).filter(Boolean)
        })) : []
      });
      setUser(data.user);
      setAccountType(getAccountType(data.user));
      setBusiness({ outletName: '', address: '', dailyServings: 50, vendorContact: '', ...(data.user.businessProfile || {}), businessType: data.user.businessProfile?.businessType || (getAccountType(data.user) === 'service' ? 'tiffin' : 'restaurant') });
      setMembers(peopleFromUser(data.user));
      setHh({ ...household, ...(data.user.household || {}) });
      if (accountType === 'household') {
        try { await api.post('/planner/generate', {}); toast('Profile saved and the meal plan updated for these preferences.', 'ok', 'Saved'); }
        catch { toast('Profile saved. Regenerate the meal plan to apply the new preferences.', 'ok', 'Saved'); }
      } else toast('Business profile saved.', 'ok', 'Saved');
    } catch (error) {
      toast(error.response?.data?.error || 'Could not save profile', 'err');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try { await downloadInventoryCsv(); toast('Inventory CSV downloaded', 'ok'); }
    catch (error) { toast(error.response?.data?.error || 'Could not export inventory', 'err'); }
    finally { setExporting(false); }
  };

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div>
          <div className="eyebrow">YOUR KITCHEN, YOUR WAY</div>
          <h2>Profile</h2>
          <p>Update your account, delivery area, and the people in your household.</p>
        </div>
        <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
          <Icon name="check" /> {saving ? 'Saving…' : 'Save profile'}
        </button>
      </section>

      <section className="profile-section">
        <div className="profile-section-heading">
          <div><div className="eyebrow">ACCOUNT</div><h3>About you</h3></div>
          <span className={`chip ${mode === 'memory' ? 'chip-warn' : 'chip-ok'}`}>{mode === 'memory' ? 'Demo data may reset' : 'Your data is saved'}</span>
        </div>
        <div className="profile-account-grid">
          <label className="field"><span className="label">Your name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span className="label">Username</span><input className="input" value={user?.username || user?.name || ''} readOnly /></label>
          <label className="field"><span className="label">Workspace type</span><select className="input" value={accountType} onChange={(event) => { const next = event.target.value; setAccountType(next); setBusiness((current) => ({ ...current, businessType: next === 'service' ? 'tiffin' : 'restaurant' })); }}><option value="household">Household</option><option value="commercial">Commercial kitchen</option><option value="service">Food service · Tiffin / PG</option></select></label>
          {accountType === 'household' && <label className="field"><span className="label">Delivery PIN code</span><input className="input" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={hh.pincode || ''} onChange={(event) => setHh({ ...hh, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="6-digit PIN for Store Offers" /><small className="tiny muted">Used automatically to find nearby store prices.</small></label>}
        </div>
      </section>

      {accountType !== 'household' && <section className="profile-section">
        <div className="profile-section-heading"><div><div className="eyebrow">KITCHEN PROFILE</div><h3>{accountType === 'commercial' ? 'Outlet details' : 'Food service details'}</h3><p>Used for storage, supplier restocking, and day to day stock planning.</p></div></div>
        <div className="profile-preference-grid">
          <label className="field"><span className="label">{accountType === 'commercial' ? 'Outlet type' : 'Service type'}</span><select className="input" value={business.businessType || (accountType === 'service' ? 'tiffin' : 'restaurant')} onChange={(event) => setBusiness({ ...business, businessType: event.target.value })}>{(accountType === 'commercial' ? [['restaurant', 'Restaurant'], ['cloud-kitchen', 'Cloud kitchen'], ['cafe', 'Café']] : [['tiffin', 'Tiffin centre'], ['pg', 'PG / hostel']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field"><span className="label">Outlet / service name</span><input className="input" value={business.outletName || ''} onChange={(event) => setBusiness({ ...business, outletName: event.target.value })} /></label>
          <label className="field"><span className="label">Location / address</span><input className="input" value={business.address || ''} onChange={(event) => setBusiness({ ...business, address: event.target.value })} /></label>
          <label className="field"><span className="label">Approximate daily servings</span><input className="input" type="number" min="1" value={business.dailyServings || 0} onChange={(event) => setBusiness({ ...business, dailyServings: Number(event.target.value) })} /></label>
          <label className="field"><span className="label">Vendor WhatsApp number</span><input className="input" type="tel" value={business.vendorContact || ''} onChange={(event) => setBusiness({ ...business, vendorContact: event.target.value })} placeholder="Add country code for WhatsApp" /></label>
        </div>
      </section>}

      {accountType === 'household' && <section className="profile-section">
        <div className="profile-section-heading">
          <div><div className="eyebrow">PERSONAL PROFILES</div><h3>People in your household · {householdSize}</h3><p>Set a separate diet, allergy, and nutrition goal for each person. Meal suggestions will respect their restrictions.</p></div>
          <button className="btn" type="button" onClick={addPerson}><Icon name="plus" /> Add person</button>
        </div>
        <div className="profile-people-list">
          {members.map((person, index) => (
            <article key={person.id} className="profile-person-card">
              <div className="profile-person-title"><span className="profile-person-number">{index + 1}</span><b>{person.name || `Person ${index + 1}`}</b><button className="btn btn-ghost btn-icon" type="button" onClick={() => removePerson(person.id)} title={`Remove ${person.name}`} aria-label={`Remove ${person.name}`}><Icon name="trash" size={14} /></button></div>
              <div className="profile-person-fields">
                <label className="field"><span className="label">Name</span><input className="input" value={person.name || ''} onChange={(event) => updatePerson(person.id, { name: event.target.value })} placeholder={`Person ${index + 1}`} /></label>
                <label className="field"><span className="label">Person type</span><select className="input" value={person.type || 'adult'} onChange={(event) => updatePerson(person.id, { type: event.target.value })}><option value="adult">Adult</option><option value="child">Child</option></select></label>
                <label className="field"><span className="label">Food preference</span><select className="input" value={person.diet || 'inherit'} onChange={(event) => updatePerson(person.id, { diet: event.target.value })}>{DIETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="field"><span className="label">Personal allergies / ingredients to avoid</span><input className="input" value={(person.allergies || []).join(', ')} onChange={(event) => updatePerson(person.id, { allergies: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="Optional, comma separated" /></label>
                <label className="field"><span className="label">Calories per day</span><input className="input" type="number" min="800" value={person.calorieTarget || 2000} onChange={(event) => updatePerson(person.id, { calorieTarget: Number(event.target.value) })} /></label>
                <label className="field"><span className="label">Protein g per day</span><input className="input" type="number" min="0" value={person.proteinTarget || 75} onChange={(event) => updatePerson(person.id, { proteinTarget: Number(event.target.value) })} /></label>
                <label className="field"><span className="label">Kitchen access</span><select className="input" value={person.role || 'member'} onChange={(event) => updatePerson(person.id, { role: event.target.value })}><option value="admin">Admin</option><option value="member">Member</option></select></label>
              </div>
            </article>
          ))}
          {!members.length && <div className="profile-empty">No personal profiles yet. Add a person to set individual preferences.</div>}
        </div>
      </section>}

      <section className="profile-section profile-account-tools">
        <div><div className="eyebrow">APP PREFERENCES</div><h3>Language and kitchen data</h3><p>Appearance can be changed from the sun/moon button in the top bar.</p></div>
        <div className="profile-tools-row">
          <div><span className="label">Language</span><div className="lang-toggle">{Object.entries(LANGS).map(([code, label]) => <button type="button" key={code} className={lang === code ? 'active' : ''} onClick={() => setLang(code)}>{label}</button>)}</div></div>
          <button className="btn" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /> Switch to {theme === 'dark' ? 'light' : 'dark'} theme</button>
          <button className="btn" type="button" onClick={exportCsv} disabled={exporting}><Icon name="upload" /> {exporting ? 'Exporting…' : 'Export inventory CSV'}</button>
        </div>
      </section>

      <div className="profile-save-footer"><span className="small muted">Your preferences shape meal suggestions, stock planning, and restocking.</span><button className="btn btn-primary" onClick={saveProfile} disabled={saving}><Icon name="check" /> {saving ? 'Saving…' : 'Save profile'}</button></div>
    </div>
  );
}
