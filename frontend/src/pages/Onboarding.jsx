import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { getAccountType } from '../utils/accountType.js';
import Icon from '../components/Icon.jsx';

const DIETS = [
  ['inherit', 'Use shared preference'], ['veg', 'Vegetarian'], ['nonveg', 'Non-vegetarian'],
  ['egg', 'Eggetarian'], ['vegan', 'Vegan'], ['jain', 'Jain'], ['custom', 'All diets']
];
const REGIONS = ['North Indian', 'South Indian', 'Gujarati', 'Rajasthani', 'Maharashtrian', 'Bengali', 'Punjabi', 'Kashmiri', 'Northeast Indian', 'Coastal'];

function makeMember(index, type, name = '') {
  return { id: `member-${Date.now()}-${index}`, name: name || (index === 0 ? 'You' : `${type === 'child' ? 'Child' : 'Adult'} ${index + 1}`), type, role: index === 0 ? 'admin' : 'member', diet: 'inherit', allergies: '', calorieTarget: type === 'child' ? 1500 : 2000, proteinTarget: 75 };
}

export default function Onboarding() {
  const { user, setUser, toast } = useApp();
  const nav = useNavigate();
  const accountType = getAccountType(user);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [household, setHousehold] = useState({
    adults: 2, children: 0, residents: 2, diet: 'veg', foodPractice: 'none', address: '', pincode: '', cuisines: [], allergies: [],
    weeklyBudget: 1500, calorieTarget: 2000, proteinTarget: 75, ...(user?.household || {})
  });
  const [members, setMembers] = useState(() => {
    if (user?.members?.length) return user.members.map((person) => ({ ...person, allergies: (person.allergies || []).join(', ') }));
    const count = Math.max(1, Number(user?.household?.adults || 2) + Number(user?.household?.children || 0));
    return Array.from({ length: count }, (_, index) => makeMember(index, index >= Number(user?.household?.adults || 2) ? 'child' : 'adult', index === 0 ? user?.name : ''));
  });
  const [business, setBusiness] = useState(() => {
    const saved = user?.businessProfile || {};
    return { outletName: '', address: '', dailyServings: 50, vendorContact: '', ...saved, businessType: saved.businessType || (accountType === 'service' ? 'tiffin' : 'restaurant') };
  });
  const memberCounts = useMemo(() => ({
    adults: members.filter((person) => person.type === 'adult').length,
    children: members.filter((person) => person.type === 'child').length
  }), [members]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.onboardingComplete !== false) return <Navigate to="/" replace />;

  const setCount = (type, value) => {
    setMembers((current) => {
      const keep = current.filter((person) => person.type !== type);
      const existing = current.filter((person) => person.type === type);
      const maxCount = Math.max(type === 'adult' ? 1 : 0, 24 - keep.length);
      const count = Math.max(type === 'adult' ? 1 : 0, Math.min(maxCount, Number(value) || 0));
      const added = Array.from({ length: Math.max(0, count - existing.length) }, (_, index) => makeMember(current.length + index, type));
      return [...keep, ...existing.slice(0, count), ...added];
    });
  };
  const updateMember = (id, patch) => setMembers((current) => current.map((person) => person.id === id ? { ...person, ...patch } : person));
  const toggleCuisine = (region) => setHousehold((current) => ({ ...current, cuisines: current.cuisines.includes(region) ? current.cuisines.filter((item) => item !== region) : [...current.cuisines, region] }));

  const save = async () => {
    if (accountType === 'household') {
      if (!household.address.trim()) return toast('Add your household address', 'warn');
      if (household.pincode && !/^[1-9]\d{5}$/.test(String(household.pincode).trim())) return toast('Delivery PIN must be six digits and cannot start with 0', 'warn');
      if (members.some((person) => !person.name.trim())) return toast('Every household member needs a name', 'warn');
    } else {
      if (!business.outletName.trim() || !business.address.trim()) return toast('Add the outlet name and location', 'warn');
      if (!Number(business.dailyServings) || Number(business.dailyServings) < 1) return toast('Enter the approximate daily servings', 'warn');
    }
    setBusy(true);
    try {
      const body = accountType === 'household'
        ? {
          accountType, onboardingComplete: true,
          household: { ...household, adults: memberCounts.adults, children: memberCounts.children, residents: members.length, allergies: String(household.allergies || '').split(',').map((item) => item.trim()).filter(Boolean), cuisines: household.cuisines },
          members: members.map((person) => ({ ...person, allergies: String(person.allergies || '').split(',').map((item) => item.trim()).filter(Boolean) }))
        }
        : {
          accountType, onboardingComplete: true,
          household: { ...(user.household || {}), kitchenType: accountType === 'service' ? 'hostel' : 'commercial', residents: Number(business.dailyServings), address: business.address },
          businessProfile: { ...business, dailyServings: Number(business.dailyServings) }, members: []
        };
      const { data } = await api.put('/auth/me', body);
      setUser(data.user);
      if (accountType === 'household') {
        try { await api.post('/planner/generate', {}); } catch { /* A first plan can be generated from the planner later. */ }
      }
      toast('Your KitchenSync workspace is ready.', 'ok', 'Profile saved');
      nav('/', { replace: true });
    } catch (error) {
      toast(error.response?.data?.error || 'Could not save your profile', 'err');
    } finally { setBusy(false); }
  };

  const title = accountType === 'household' ? 'Set up your household' : accountType === 'commercial' ? 'Set up your kitchen' : 'Set up your food service';
  return (
    <main className="onboarding-page">
      <motion.section className="onboarding-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="onboarding-brand"><span className="logo-badge"><Icon name="leaf" /></span><b>KitchenSync</b><span className="chip">{accountType === 'household' ? 'Household' : accountType === 'commercial' ? 'Commercial kitchen' : 'Food service'}</span></div>
        <div className="onboarding-progress"><span style={{ width: `${accountType !== 'household' || step === 2 ? 100 : 48}%` }} /></div>
        <div className="eyebrow">BEFORE WE GET STARTED · STEP {step} OF {accountType === 'household' ? 2 : 1}</div>
        <h1>{title}</h1>
        <p className="muted">We’ll use these details to tailor inventory, meals, and restocking to the way you work.</p>

        {accountType === 'household' && step === 1 && <div className="onboarding-fields">
          <div className="onboarding-counts">
            <label className="field"><span className="label">Adults</span><input className="input" type="number" min="1" max="24" value={memberCounts.adults} onChange={(event) => setCount('adult', event.target.value)} /></label>
            <label className="field"><span className="label">Children</span><input className="input" type="number" min="0" max="24" value={memberCounts.children} onChange={(event) => setCount('child', event.target.value)} /></label>
          </div>
          <label className="field"><span className="label">Home address</span><input className="input" value={household.address} onChange={(event) => setHousehold({ ...household, address: event.target.value })} placeholder="Area and city" /></label>
          <label className="field"><span className="label">Delivery PIN code · used for store searches</span><input className="input" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={household.pincode || ''} onChange={(event) => setHousehold({ ...household, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="Optional 6-digit PIN" /></label>
          <div className="field"><span className="label">Shared food preference</span><select className="input" value={household.diet} onChange={(event) => setHousehold({ ...household, diet: event.target.value })}>{DIETS.filter(([value]) => value !== 'inherit').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="field"><span className="label">Religion / food practice</span><select className="input" value={household.foodPractice} onChange={(event) => setHousehold({ ...household, foodPractice: event.target.value })}><option value="none">No additional practice</option><option value="jain">Jain preparation (no root vegetables)</option><option value="satvik">Satvik</option><option value="halal">Halal (avoid pork and alcohol)</option></select></div>
          <div className="field"><span className="label">Regional cuisines you enjoy</span><div className="preference-chips">{REGIONS.map((region) => <button type="button" key={region} className={`preference-chip ${household.cuisines.includes(region) ? 'selected' : ''}`} onClick={() => toggleCuisine(region)}>{region}</button>)}</div></div>
          <label className="field"><span className="label">Household allergies or ingredients to avoid</span><input className="input" value={household.allergies || ''} onChange={(event) => setHousehold({ ...household, allergies: event.target.value })} placeholder="Comma separated, e.g. peanuts" /></label>
          <p className="small muted">On the next step, set a separate diet, allergy list, calorie goal, and protein goal for each person.</p>
        </div>}

        {accountType === 'household' && step === 2 && <div className="onboarding-members"><div className="small muted">Each person has their own food preference and nutrition targets. Meal suggestions use the selected person’s settings.</div>{members.map((person, index) => <article className="profile-person-card" key={person.id}><b>{person.type === 'child' ? 'Child' : 'Adult'} {index + 1}</b><div className="profile-person-fields"><label className="field"><span className="label">Name</span><input className="input" value={person.name} onChange={(event) => updateMember(person.id, { name: event.target.value })} /></label><label className="field"><span className="label">Food preference</span><select className="input" value={person.diet} onChange={(event) => updateMember(person.id, { diet: event.target.value })}>{DIETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span className="label">Allergies / ingredients to avoid</span><input className="input" value={person.allergies || ''} onChange={(event) => updateMember(person.id, { allergies: event.target.value })} placeholder="Optional" /></label><label className="field"><span className="label">Calories / day</span><input className="input" type="number" min="800" value={person.calorieTarget || 2000} onChange={(event) => updateMember(person.id, { calorieTarget: Number(event.target.value) })} /></label><label className="field"><span className="label">Protein g / day</span><input className="input" type="number" min="0" value={person.proteinTarget || 75} onChange={(event) => updateMember(person.id, { proteinTarget: Number(event.target.value) })} /></label></div></article>)}</div>}

        {accountType !== 'household' && <div className="onboarding-fields">
          <label className="field"><span className="label">{accountType === 'commercial' ? 'Outlet type' : 'Service type'}</span><select className="input" value={business.businessType || (accountType === 'service' ? 'tiffin' : 'restaurant')} onChange={(event) => setBusiness({ ...business, businessType: event.target.value })}>{(accountType === 'commercial' ? [['restaurant', 'Restaurant'], ['cloud-kitchen', 'Cloud kitchen'], ['cafe', 'Café']] : [['tiffin', 'Tiffin centre'], ['pg', 'PG / hostel']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field"><span className="label">{accountType === 'commercial' ? 'Outlet name' : 'Service name'}</span><input className="input" value={business.outletName} onChange={(event) => setBusiness({ ...business, outletName: event.target.value })} placeholder={accountType === 'commercial' ? 'Your restaurant or café' : 'Your tiffin service or PG'} /></label>
          <label className="field"><span className="label">Location / address</span><input className="input" value={business.address} onChange={(event) => setBusiness({ ...business, address: event.target.value })} placeholder="Area, city, PIN code" /></label>
          <label className="field"><span className="label">Approximate people served daily</span><input className="input" type="number" min="1" max="50000" value={business.dailyServings} onChange={(event) => setBusiness({ ...business, dailyServings: event.target.value })} /></label>
          <label className="field"><span className="label">Main vendor phone (optional)</span><input className="input" type="tel" value={business.vendorContact} onChange={(event) => setBusiness({ ...business, vendorContact: event.target.value })} placeholder="Add vendors later in Vendor Restocking" /></label>
        </div>}

        <div className="onboarding-actions">
          {accountType === 'household' && step === 2 && <button className="btn" onClick={() => setStep(1)}>Back</button>}
          {accountType === 'household' && step === 1 ? <button className="btn btn-primary" onClick={() => { if (!household.address.trim()) return toast('Add your household address', 'warn'); setStep(2); }}>Continue <Icon name="chevR" /></button> : <button className="btn btn-primary" onClick={save} disabled={busy}><Icon name="check" /> {busy ? 'Saving…' : 'Finish setup'}</button>}
        </div>
      </motion.section>
    </main>
  );
}
