import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { getAccountType } from '../utils/accountType.js';
import Icon from '../components/Icon.jsx';

const MEMBER_DIETS = [
  ['inherit', 'Shared'], ['veg', 'Vegetarian'], ['vegan', 'Vegan'],
  ['egg', 'Eggetarian'], ['nonveg', 'Non-vegetarian'], ['jain', 'Jain'], ['custom', 'All diets']
];
const SHARED_DIETS = [
  { value: 'veg', label: 'Vegetarian', note: 'No meat or eggs' },
  { value: 'vegan', label: 'Vegan', note: 'Plant-based meals' },
  { value: 'egg', label: 'Eggetarian', note: 'Vegetarian + eggs' },
  { value: 'nonveg', label: 'Non-vegetarian', note: 'All food types' },
  { value: 'custom', label: 'Flexible', note: 'No shared diet filter' }
];
const FOOD_PRACTICES = [
  { value: 'none', label: 'No extra rules' }, { value: 'jain', label: 'Jain preparation' },
  { value: 'satvik', label: 'Satvik' }, { value: 'halal', label: 'Halal' }
];
const REGIONS = ['North Indian', 'South Indian', 'Gujarati', 'Rajasthani', 'Maharashtrian', 'Bengali', 'Punjabi', 'Kashmiri', 'Northeast Indian', 'Coastal'];
const COMMON_AVOIDS = ['Peanuts', 'Tree nuts', 'Dairy', 'Gluten', 'Soy', 'Sesame', 'Shellfish'];
const BUSINESS_TYPES = {
  commercial: [['restaurant', 'Restaurant'], ['cloud-kitchen', 'Cloud kitchen'], ['cafe', 'Café']],
  service: [['tiffin', 'Tiffin centre'], ['pg', 'PG / hostel']]
};

function makeMember(index, type, name = '') {
  const id = globalThis.crypto?.randomUUID?.() || `member-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, name: name || (index === 0 ? 'You' : `${type === 'child' ? 'Child' : 'Adult'} ${index + 1}`), type, role: index === 0 ? 'admin' : 'member', diet: 'inherit', allergies: '', calorieTarget: type === 'child' ? 1500 : 2000, proteinTarget: 75 };
}

function listFrom(value) {
  return (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(item).trim()).filter(Boolean);
}

function CountControl({ label, value, min, max, onChange }) {
  return (
    <div className="onboarding-count-control">
      <span className="label">{label}</span>
      <div className="onboarding-stepper">
        <button type="button" aria-label={`Remove one ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
        <output aria-live="polite">{value}</output>
        <button type="button" aria-label={`Add one ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
      </div>
    </div>
  );
}

function ChoiceChips({ options, value, onChange, className = '' }) {
  return (
    <div className={`onboarding-choice-list ${className}`}>
      {options.map((option) => {
        const item = Array.isArray(option) ? { value: option[0], label: option[1] } : option;
        const selected = Array.isArray(value) ? value.some((entry) => String(entry).toLowerCase() === String(item.value).toLowerCase()) : value === item.value;
        return (
          <button type="button" key={item.value} className={`onboarding-choice ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => onChange(item.value)}>
            <span>{item.label}</span>{item.note && <small>{item.note}</small>}
          </button>
        );
      })}
    </div>
  );
}

export default function Onboarding() {
  const { user, setUser, toast } = useApp();
  const nav = useNavigate();
  const accountType = getAccountType(user);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [household, setHousehold] = useState(() => {
    const saved = user?.household || {};
    return {
      adults: Math.max(1, Number(saved.adults ?? 2)), children: Math.max(0, Number(saved.children ?? 0)),
      residents: Number(saved.residents ?? 2), diet: saved.diet || 'veg', foodPractice: saved.foodPractice || 'none',
      address: saved.address || '', pincode: saved.pincode || '', cuisines: Array.isArray(saved.cuisines) ? saved.cuisines : [],
      allergies: listFrom(saved.allergies).join(', '), weeklyBudget: saved.weeklyBudget ?? 1500,
      calorieTarget: saved.calorieTarget ?? 2000, proteinTarget: saved.proteinTarget ?? 75
    };
  });
  const [members, setMembers] = useState(() => {
    if (user?.members?.length) return user.members.map((person) => ({
      ...person, type: person.type === 'child' ? 'child' : 'adult',
      allergies: listFrom(person.allergies).join(', ')
    }));
    const adults = Math.max(1, Number(user?.household?.adults ?? 2));
    const children = Math.max(0, Number(user?.household?.children ?? 0));
    return Array.from({ length: Math.min(24, adults + children) }, (_, index) => makeMember(index, index >= adults ? 'child' : 'adult', index === 0 ? user?.name : ''));
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

  const setCount = (type, value) => setMembers((current) => {
    const keep = current.filter((person) => person.type !== type);
    const existing = current.filter((person) => person.type === type);
    const min = type === 'adult' ? 1 : 0;
    const max = Math.max(min, 24 - keep.length);
    const count = Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
    const added = Array.from({ length: Math.max(0, count - existing.length) }, (_, index) => makeMember(current.length + index, type));
    return [...keep, ...existing.slice(0, count), ...added].sort((a, b) => (a.type === 'adult' ? 0 : 1) - (b.type === 'adult' ? 0 : 1));
  });
  const updateMember = (id, patch) => setMembers((current) => current.map((person) => person.id === id ? { ...person, ...patch } : person));
  const updateHousehold = (patch) => setHousehold((current) => ({ ...current, ...patch }));
  const toggleCuisine = (region) => updateHousehold({ cuisines: household.cuisines.includes(region) ? household.cuisines.filter((item) => item !== region) : [...household.cuisines, region] });
  const toggleAllergy = (allergy) => {
    const current = listFrom(household.allergies);
    const found = current.some((item) => item.toLowerCase() === allergy.toLowerCase());
    updateHousehold({ allergies: (found ? current.filter((item) => item.toLowerCase() !== allergy.toLowerCase()) : [...current, allergy]).join(', ') });
  };
  const setFoodPractice = (value) => updateHousehold({
    foodPractice: value,
    ...(value === 'jain' ? { diet: 'jain' } : household.diet === 'jain' ? { diet: 'veg' } : {})
  });

  const save = async () => {
    setBusy(true);
    try {
      const body = accountType === 'household'
        ? {
          accountType, onboardingComplete: true,
          household: {
            ...household, adults: memberCounts.adults, children: memberCounts.children,
            residents: members.length, allergies: listFrom(household.allergies), cuisines: household.cuisines
          },
          members: members.map((person) => ({ ...person, allergies: listFrom(person.allergies) }))
        }
        : {
          accountType, onboardingComplete: true,
          household: { ...(user.household || {}), kitchenType: accountType === 'service' ? 'hostel' : 'commercial', residents: Number(business.dailyServings), address: business.address },
          businessProfile: { ...business, dailyServings: Number(business.dailyServings) }, members: []
        };
      const { data } = await api.put('/auth/me', body);
      setUser(data.user);
      if (accountType === 'household') {
        try { await api.post('/planner/generate', {}); } catch { /* The first plan can be generated from Meal Planner later. */ }
      }
      toast('Your KitchenSync workspace is ready.', 'ok', 'Profile saved');
      nav('/', { replace: true });
    } catch (error) {
      toast(error.response?.data?.error || 'Could not save your profile', 'err');
    } finally { setBusy(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (accountType === 'household') {
      if (household.pincode && !/^[1-9]\d{5}$/.test(String(household.pincode).trim())) return toast('Delivery PIN must be six digits and cannot start with 0', 'warn');
      if (step === 1) return setStep(2);
      if (members.some((person) => !person.name.trim())) return toast('Every household member needs a name', 'warn');
    } else {
      if (!business.outletName.trim() || !business.address.trim()) return toast('Add the outlet name and location', 'warn');
      if (!Number(business.dailyServings) || Number(business.dailyServings) < 1) return toast('Enter the approximate daily servings', 'warn');
    }
    await save();
  };

  const householdAccount = accountType === 'household';
  const stepCount = householdAccount ? 2 : 1;
  const progress = householdAccount ? (step === 1 ? 50 : 100) : 100;
  const workspaceLabel = householdAccount ? 'Household' : accountType === 'commercial' ? 'Commercial kitchen' : 'Food service';
  const businessTypes = BUSINESS_TYPES[accountType] || [];

  return (
    <main className="onboarding-page">
      <section className="onboarding-shell">
        <header className="onboarding-topbar">
          <div className="onboarding-brand">
            <span className="logo-badge"><Icon name="leaf" size={19} /></span>
            <span><b>KitchenSync</b><small>A little more in rhythm</small></span>
          </div>
          <div className="onboarding-step-meta">
            <b>{String(step).padStart(2, '0')} <span>/</span> {String(stepCount).padStart(2, '0')}</b>
            <div className="onboarding-progress" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>
          </div>
        </header>

        <div className="onboarding-intro">
          <span className="onboarding-workspace-tag">{workspaceLabel} setup</span>
          <h1>{step === 1 ? (accountType === 'service' ? 'Let’s set up your service.' : 'Let’s set up your kitchen.') : 'Make it fit everyone.'}</h1>
          <p>{step === 1 ? 'A few details will help us make your kitchen smarter.' : 'Set the food and nutrition preferences for each person.'}</p>
        </div>

        <form className="onboarding-form" onSubmit={submit}>
          {householdAccount && step === 1 && <div className="onboarding-setup-grid">
            <section className="onboarding-panel">
              <div className="onboarding-panel-heading"><span className="onboarding-panel-number">01</span><div><h2>Household essentials</h2><p>Who lives here and where should we search?</p></div></div>
              <div className="onboarding-counter-grid">
                <CountControl label="Adults" value={memberCounts.adults} min={1} max={Math.max(1, 24 - memberCounts.children)} onChange={(value) => setCount('adult', value)} />
                <CountControl label="Children" value={memberCounts.children} min={0} max={24 - memberCounts.adults} onChange={(value) => setCount('child', value)} />
              </div>
              <label className="field"><span className="label">Home address <em>Optional</em></span><input className="input" autoComplete="street-address" value={household.address} onChange={(event) => updateHousehold({ address: event.target.value })} placeholder="Area and city" /></label>
              <label className="field"><span className="label">Delivery PIN <em>Optional · store search</em></span><input className="input" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={household.pincode} onChange={(event) => updateHousehold({ pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="6-digit PIN" /></label>
            </section>

            <section className="onboarding-panel">
              <div className="onboarding-panel-heading"><span className="onboarding-panel-number">02</span><div><h2>Food preferences</h2><p>Choose the shared default. You can personalize each person next.</p></div></div>
              <div className="onboarding-form-group"><span className="label">Shared food preference</span>
                <ChoiceChips options={SHARED_DIETS} value={household.diet === 'jain' ? 'veg' : household.diet} onChange={(value) => updateHousehold({ diet: value })} className="onboarding-diet-choices" />
              </div>
              <div className="onboarding-form-group"><span className="label">Food practices</span>
                <ChoiceChips options={FOOD_PRACTICES} value={household.foodPractice === 'none' && household.diet === 'jain' ? 'jain' : household.foodPractice} onChange={setFoodPractice} className="onboarding-practice-choices" />
              </div>
              <div className="onboarding-form-group"><span className="label">Regional cuisines</span>
                <div className="onboarding-cuisine-chips">{REGIONS.map((region) => <button type="button" key={region} className={`onboarding-small-chip ${household.cuisines.includes(region) ? 'selected' : ''}`} aria-pressed={household.cuisines.includes(region)} onClick={() => toggleCuisine(region)}>{region}</button>)}</div>
              </div>
              <div className="onboarding-form-group"><span className="label">Allergies and ingredients to avoid</span>
                <div className="onboarding-cuisine-chips onboarding-allergy-chips">{COMMON_AVOIDS.map((allergy) => {
                  const selected = listFrom(household.allergies).some((item) => item.toLowerCase() === allergy.toLowerCase());
                  return <button type="button" key={allergy} className={`onboarding-small-chip ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => toggleAllergy(allergy)}>{allergy}</button>;
                })}</div>
                <input className="input" value={household.allergies} onChange={(event) => updateHousehold({ allergies: event.target.value })} placeholder="Add another restriction, e.g. mustard" aria-label="Other allergies or ingredients to avoid" />
              </div>
            </section>
          </div>}

          {householdAccount && step === 2 && <div className="onboarding-members-section">
            <div className="onboarding-section-lead"><div><h2>Personal food preferences</h2><p>These settings shape recipe and nutrition suggestions for each person.</p></div><span>{members.length} {members.length === 1 ? 'person' : 'people'}</span></div>
            <div className="onboarding-members-grid">{members.map((person, index) => (
              <article className="onboarding-member-card" key={person.id}>
                <div className="onboarding-member-title"><span>{person.type === 'child' ? 'Child' : 'Adult'} {person.type === 'child' ? index - memberCounts.adults + 1 : index + 1}</span><small>PERSON {String(index + 1).padStart(2, '0')}</small></div>
                <label className="field"><span className="label">Name</span><input className="input" autoComplete="name" value={person.name} onChange={(event) => updateMember(person.id, { name: event.target.value })} placeholder="Person’s name" /></label>
                <div className="field"><span className="label">Food preference</span><div className="onboarding-member-diets">{MEMBER_DIETS.map(([value, label]) => <button type="button" key={value} className={`onboarding-small-chip ${person.diet === value ? 'selected' : ''}`} aria-pressed={person.diet === value} onClick={() => updateMember(person.id, { diet: value })}>{label}</button>)}</div></div>
                <label className="field"><span className="label">Allergies or restrictions</span><input className="input" value={person.allergies || ''} onChange={(event) => updateMember(person.id, { allergies: event.target.value })} placeholder="Optional, comma separated" /></label>
                <div className="onboarding-member-nutrition">
                  <label className="field"><span className="label">Calories / day</span><input className="input" type="number" min="800" value={person.calorieTarget || 2000} onChange={(event) => updateMember(person.id, { calorieTarget: Number(event.target.value) })} /></label>
                  <label className="field"><span className="label">Protein g / day</span><input className="input" type="number" min="0" value={person.proteinTarget ?? 75} onChange={(event) => updateMember(person.id, { proteinTarget: Number(event.target.value) })} /></label>
                </div>
              </article>
            ))}</div>
          </div>}

          {!householdAccount && <div className="onboarding-setup-grid onboarding-business-grid">
            <section className="onboarding-panel">
              <div className="onboarding-panel-heading"><span className="onboarding-panel-number">01</span><div><h2>Workspace details</h2><p>Tell us what kind of kitchen you run.</p></div></div>
              <div className="onboarding-form-group"><span className="label">{accountType === 'commercial' ? 'Outlet type' : 'Service type'}</span><div className="onboarding-type-choices">{businessTypes.map(([value, label]) => <button type="button" key={value} className={`onboarding-type-choice ${business.businessType === value ? 'selected' : ''}`} aria-pressed={business.businessType === value} onClick={() => setBusiness((current) => ({ ...current, businessType: value }))}><span>{label}</span><small>{value === 'restaurant' ? 'Dine-in and takeaway' : value === 'cloud-kitchen' ? 'Delivery-first kitchen' : value === 'cafe' ? 'Coffee and light meals' : value === 'tiffin' ? 'Prepared meals and delivery' : 'Shared accommodation'}</small></button>)}</div></div>
              <label className="field"><span className="label">{accountType === 'commercial' ? 'Outlet name' : 'Service name'}</span><input className="input" value={business.outletName} onChange={(event) => setBusiness({ ...business, outletName: event.target.value })} placeholder={accountType === 'commercial' ? 'Your restaurant or café' : 'Your tiffin service or PG'} /></label>
              <label className="field"><span className="label">Location / address</span><input className="input" autoComplete="street-address" value={business.address} onChange={(event) => setBusiness({ ...business, address: event.target.value })} placeholder="Area and city" /></label>
            </section>
            <section className="onboarding-panel">
              <div className="onboarding-panel-heading"><span className="onboarding-panel-number">02</span><div><h2>Daily operations</h2><p>Set a starting point for stock and restocking.</p></div></div>
              <label className="field"><span className="label">Approximate people served daily</span><input className="input" type="number" min="1" max="50000" value={business.dailyServings} onChange={(event) => setBusiness({ ...business, dailyServings: event.target.value })} /></label>
              <label className="field"><span className="label">Main vendor phone <em>Optional</em></span><input className="input" type="tel" autoComplete="tel" value={business.vendorContact} onChange={(event) => setBusiness({ ...business, vendorContact: event.target.value })} placeholder="Add vendors later if needed" /></label>
              <div className="onboarding-note"><Icon name="info" size={15} />You can update these details from Profile at any time.</div>
            </section>
          </div>}

          <footer className="onboarding-actions">
            <div className="onboarding-action-copy"><b>STEP {String(step).padStart(2, '0')} OF {String(stepCount).padStart(2, '0')}</b><span>{householdAccount && step === 1 ? 'You can fine-tune individual settings next.' : 'Your details stay in your KitchenSync account.'}</span></div>
            <div className="onboarding-action-buttons">
              {householdAccount && step === 2 && <button className="btn onboarding-back" type="button" onClick={() => setStep(1)}>← <span>Back</span></button>}
              <button className="btn btn-primary onboarding-continue" type="submit" disabled={busy}><span>{busy ? 'Saving…' : householdAccount && step === 1 ? 'Continue' : 'Finish setup'}</span><Icon name={busy ? 'clock' : householdAccount && step === 1 ? 'chevR' : 'check'} /></button>
            </div>
          </footer>
        </form>
      </section>
    </main>
  );
}
