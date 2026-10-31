import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from './Icon.jsx';

export default function NutritionPlanner() {
  const { user, toast } = useApp();
  const members = useMemo(() => user?.members?.length ? user.members : [{
    id: 'household', name: user?.name || 'Household', diet: user?.household?.diet || 'veg',
    calorieTarget: user?.household?.calorieTarget || 2000, proteinTarget: user?.household?.proteinTarget || 75
  }], [user]);
  const [memberId, setMemberId] = useState(members[0]?.id || 'household');
  const [today, setToday] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimateNote, setEstimateNote] = useState('');
  const [isEstimated, setIsEstimated] = useState(false);
  const [form, setForm] = useState({ name: '', calories: '', protein: '', mealType: 'dinner', source: 'outside' });

  useEffect(() => {
    if (!members.some((person) => person.id === memberId)) setMemberId(members[0]?.id || 'household');
  }, [members, memberId]);

  const load = async () => {
    const [daily, suggestions] = await Promise.all([
      api.get(`/diet/today?memberId=${encodeURIComponent(memberId)}`),
      api.get(`/recipes?compatible=1&sort=protein&memberId=${encodeURIComponent(memberId)}`)
    ]);
    setToday(daily.data);
    setRecipes(suggestions.data.recipes || []);
  };
  useEffect(() => {
    const refresh = () => load().catch(() => toast('Could not load today’s nutrition', 'err'));
    refresh();
    window.addEventListener('ks:household-diet-changed', refresh);
    return () => window.removeEventListener('ks:household-diet-changed', refresh);
  }, [memberId]);

  const addFood = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || form.calories === '') return toast('Add the food name and its calories in kcal', 'warn');
    setBusy(true);
    try {
      await api.post('/diet/log', {
        memberId,
        name: form.name.trim(),
        calories: Number(form.calories),
        protein: Number(form.protein || 0),
        mealType: form.mealType,
        source: form.source,
        isEstimated
      });
      setForm({ name: '', calories: '', protein: '', mealType: 'dinner', source: 'outside' });
      setIsEstimated(false);
      setEstimateNote('');
      await load();
      toast('Food added. Remaining targets and recipe ideas are updated.', 'ok');
    } catch (error) { toast(error.response?.data?.error || 'Could not add food', 'err'); }
    finally { setBusy(false); }
  };

  const estimateFood = async () => {
    if (!form.name.trim()) return toast('Enter the dish and portion first, for example “2 slices of pizza”', 'warn');
    setEstimating(true);
    setEstimateNote('');
    try {
      const { data } = await api.post('/diet/estimate', { name: form.name.trim(), mealType: form.mealType });
      if (!data.available) {
        setEstimateNote(data.message || 'Could not estimate this food. Enter kcal from a menu or your own estimate.');
        setIsEstimated(false);
        return;
      }
      setForm((current) => ({ ...current, calories: String(data.calories), protein: String(data.protein) }));
      setIsEstimated(true);
      setEstimateNote(`${data.note} (${data.serving}; ${data.confidence} confidence)`);
    } catch (error) {
      setEstimateNote(error.response?.data?.error || 'Could not estimate this food. Enter kcal from a menu or your own estimate.');
      setIsEstimated(false);
    } finally { setEstimating(false); }
  };

  const removeEntry = async (entry) => {
    try { await api.delete(`/diet/log/${entry._id}`); await load(); toast('Food removed from today’s log', 'ok'); }
    catch (error) { toast(error.response?.data?.error || 'Could not remove food', 'err'); }
  };

  if (!today) return <div className="card nutrition-card"><div className="skeleton" style={{ height: 120 }} /></div>;
  const remainingCalories = today.remaining.calories;
  const remainingProtein = today.remaining.protein;
  const nutritionFit = (recipe) => {
    const protein = Number(recipe.protein || 0);
    if (remainingProtein <= 0) return protein / Math.max(1, Number(recipe.kcal) || 1);
    return Math.min(protein, remainingProtein) / Math.max(1, Math.max(protein, remainingProtein));
  };
  const suggestions = recipes
    .filter((recipe) => Number(recipe.kcal) > 0 && Number(recipe.kcal) <= remainingCalories)
    .sort((a, b) => nutritionFit(b) - nutritionFit(a) || (b.protein || 0) - (a.protein || 0))
    .slice(0, 4);
  const caloriePercent = Math.min(100, Math.round(today.consumed.calories / Math.max(1, today.targets.calories) * 100));
  const proteinPercent = Math.min(100, Math.round(today.consumed.protein / Math.max(1, today.targets.protein) * 100));

  return (
    <section className="card nutrition-card">
      <div className="section-head">
        <div><div className="eyebrow">HOUSEHOLD · {today.member.name}</div><h2>Today’s nutrition</h2><div className="sub">Type any food or restaurant meal. Use Estimate for a rough kcal and protein value, or enter menu/package values; totals and meal ideas update for this person.</div></div>
        <label className="field nutrition-member"><span className="label">For</span><select className="input" value={memberId} onChange={(event) => setMemberId(event.target.value)}>{members.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      </div>

      <div className="nutrition-target-grid">
        <div className="nutrition-target"><div className="flex-between"><b>Total calories</b><span>{today.consumed.calories} / {today.targets.calories} kcal</span></div><div className="nutrition-meter"><i style={{ width: `${caloriePercent}%` }} /></div><small>{today.remaining.calories > 0 ? `${today.remaining.calories} kcal remaining` : `${Math.max(0, today.consumed.calories - today.targets.calories)} kcal over today’s target`}</small></div>
        <div className="nutrition-target protein"><div className="flex-between"><b>Protein</b><span>{today.consumed.protein} / {today.targets.protein} g</span></div><div className="nutrition-meter"><i style={{ width: `${proteinPercent}%` }} /></div><small>{today.remaining.protein} g remaining</small></div>
      </div>

      <form className="nutrition-log-form" onSubmit={addFood}>
        <label className="field"><span className="label">What did {today.member.name} eat?</span><input className="input" required maxLength="120" value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value, calories: '', protein: '' }); setIsEstimated(false); setEstimateNote(''); }} placeholder="e.g. 2 slices pizza, 1 plate poha" /></label>
        <label className="field"><span className="label">Meal</span><select className="input" value={form.mealType} onChange={(event) => setForm({ ...form, mealType: event.target.value })}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></label>
        <label className="field"><span className="label">Calories (kcal)</span><div className="nutrition-calorie-input"><input className="input" required type="number" min="0" max="10000" value={form.calories} onChange={(event) => { setForm({ ...form, calories: event.target.value }); setIsEstimated(false); setEstimateNote('Using your kcal value. The daily total recalculates when you log this food.'); }} placeholder="Estimate or enter" /><button type="button" className="btn btn-compact" onClick={estimateFood} disabled={estimating}>{estimating ? '…' : 'Estimate'}</button></div></label>
        <label className="field"><span className="label">Protein (g)</span><input className="input" type="number" min="0" max="500" value={form.protein} onChange={(event) => { setForm({ ...form, protein: event.target.value }); setIsEstimated(false); setEstimateNote('Using your nutrition values. The daily total recalculates when you log this food.'); }} placeholder="Optional" /></label>
        <label className="field"><span className="label">Eaten</span><select className="input" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}><option value="outside">Outside</option><option value="home">At home</option></select></label>
        <button className="btn btn-primary" disabled={busy}><Icon name="plus" /> {busy ? 'Adding…' : 'Add to today'}</button>
      </form>
      {estimateNote && <p className={`nutrition-estimate-note ${isEstimated ? 'estimated' : ''}`}>{estimateNote}</p>}

      {!!today.entries.length && <div className="nutrition-log-list">{today.entries.map((entry) => <div className="nutrition-log-row" key={entry._id}><span><b>{entry.name}</b><small>{entry.mealType ? `${entry.mealType} · ` : ''}{entry.source === 'home' ? 'At home' : 'Outside'} · {entry.calories} kcal · {entry.protein} g protein{entry.isEstimated ? ' · estimate' : ''}</small></span><button className="btn btn-ghost btn-icon" title="Remove entry" onClick={() => removeEntry(entry)}><Icon name="trash" size={14} /></button></div>)}</div>}

      <div className="nutrition-suggestions">
        <div><b>Meal ideas for {today.member.name}</b><span className="small muted">Diet and allergies are checked for this person. Suggestions fit within {remainingCalories} kcal left and prioritize the remaining protein goal ({remainingProtein} g).</span></div>
        {suggestions.length ? <div className="nutrition-recipe-list">{suggestions.map((recipe) => <Link className="nutrition-recipe" to={`/recipes/${recipe.key}`} key={recipe.key}><span><b>{recipe.name}</b><small>{recipe.kcal} kcal · {recipe.protein || 0} g protein · {recipe.cuisine}</small></span><Icon name="chevR" size={15} /></Link>)}</div> : <p className="small muted">No recipe in the library fits the remaining calorie target. Adjust today’s target or log your next meal first.</p>}
      </div>
    </section>
  );
}
