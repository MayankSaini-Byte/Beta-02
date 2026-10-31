import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';

export default function Recipes() {
  const { toast, t } = useApp();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [diet, setDiet] = useState('');
  const [meal, setMeal] = useState('');
  const [cookable, setCookable] = useState(false);
  const [gym, setGym] = useState(false);
  const [sort, setSort] = useState('smart');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (diet) params.diet = diet;
    if (meal) params.meal = meal;
    if (cookable) params.cookable = '1';
    if (gym) params.gym = '1';
    if (sort === 'protein') params.sort = 'protein';
    const { data } = await api.get('/recipes', { params });
    setData(data);
  };
  useEffect(() => { load().catch(() => toast('Could not load recipes', 'err')); }, [q, diet, meal, cookable, gym, sort]);

  const diets = ['', 'veg', 'egg', 'nonveg'];
  const meals = ['', 'breakfast', 'lunch', 'dinner', 'snack'];

  return (
    <div>
      {/* Gym corner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gym-hero">
        <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div>
            <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
              <Icon name="dumbbell" size={18} style={{ color: 'var(--terra)' }} />
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>Gym-friendly cooking</b>
            </div>
            <div className="small muted mt-1" style={{ maxWidth: 560 }}>
              Every recipe now counts <b>protein / carbs / fat / fiber</b>. Turn on Gym mode to sort by protein and build your day:
              cut = protein density, bulk = protein + calories.
            </div>
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <button className={`btn ${gym ? 'btn-primary' : ''}`} onClick={() => setGym(!gym)}>
              <Icon name="dumbbell" /> Gym mode {gym ? 'ON' : 'OFF'}
            </button>
            <select className="input" style={{ width: 150 }} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="smart">Smart sort</option>
              <option value="protein">Sort: protein ↓</option>
            </select>
          </div>
        </div>
        {data && data.gym && (
          <div className="flex wrap mt-2" style={{ gap: 10 }}>
            <span className="macro"><b>{data.gym.proteinMedian || 0}g</b> median protein</span>
            <span className="small muted">{data.count} recipes match · {data.recipes.filter((r) => r.protein >= 25).length} above 25g protein</span>
          </div>
        )}
      </motion.div>

      <div className="flex wrap mb-2" style={{ gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <input className="input" placeholder="Search recipe or cuisine..." value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 34 }} />
          <Icon name="search" size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--faint)' }} />
        </div>
        <select className="input" style={{ width: 130 }} value={diet} onChange={(e) => setDiet(e.target.value)}>
          {diets.map((d) => <option key={d} value={d}>{d === '' ? 'All diets' : d}</option>)}
        </select>
        <select className="input" style={{ width: 140 }} value={meal} onChange={(e) => setMeal(e.target.value)}>
          {meals.map((m) => <option key={m} value={m}>{m === '' ? 'All meals' : m}</option>)}
        </select>
        <button className={`btn ${cookable ? 'btn-primary' : ''}`} onClick={() => setCookable(!cookable)}>Can cook now</button>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" /> Add recipe</button>
      </div>

      {!data && <div className="skeleton" style={{ height: 260 }} />}

      {data && data.count === 0 && (
        <div className="small muted" style={{ padding: 30, textAlign: 'center' }}>No recipes match those filters.</div>
      )}

      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: 13 }}>
        {data && data.recipes.map((r) => (
          <Link key={r.key} to={`/recipes/${r.key}`} className="card" style={{ padding: 15, textDecoration: 'none', color: 'inherit', position: 'relative' }}>
            <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{r.name}</b>
              <span className={`chip ${r.availability.coverage >= 95 ? 'chip-ok' : r.availability.coverage >= 60 ? 'chip-warn' : 'chip-danger'}`}>{r.availability.coverage}%</span>
            </div>
            <div className="small muted mt-1">{r.cuisine} · {r.diet} · {r.timeMin} min · {r.kcal} kcal</div>
            <div className="macros">
              <span className="macro"><b style={{ color: 'var(--terra)' }}>{r.nutrition.protein}g</b> P</span>
              <span className="macro"><b>{r.nutrition.carbs}g</b> C</span>
              <span className="macro"><b>{r.nutrition.fat}g</b> F</span>
              <span className="macro"><b>{r.nutrition.fiber}g</b> fib</span>
            </div>
            <div className="flex wrap mt-2" style={{ gap: 6 }}>
              {(r.tags || []).slice(0, 3).map((tg) => <span key={tg} className={`chip ${tg === 'gym' ? 'chip-gym' : ''}`} style={{ fontSize: 10.5 }}>{tg}</span>)}
              {r.source === 'custom' && <span className="chip" style={{ fontSize: 10.5 }}>yours</span>}
            </div>
            <div className="small mt-2" style={{ color: r.availability.missingCount === 0 ? 'var(--accent)' : 'var(--amber)' }}>
              {r.availability.coverage >= 95 ? 'Everything available - cook today!' : `${r.availability.totalCount - r.availability.missingCount}/${r.availability.totalCount} ingredients in kitchen`}
            </div>
            <div className="small faint mt-1">★ {r.rating} <span style={{ opacity: 0.7 }}>(editorial)</span></div>
          </Link>
        ))}
      </div>

      <AddRecipeModal open={adding} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); }} />
    </div>
  );
}

/* ---------------- Add recipe flow with AI quantity estimation ---------------- */
function AddRecipeModal({ open, onClose, onAdded }) {
  const { toast } = useApp();
  const [form, setForm] = useState({ name: '', cuisine: 'Home Kitchen', diet: 'veg', meal: ['lunch'], timeMin: 30, servings: 2, kcal: 300, steps: [''] });
  const [ings, setIngs] = useState([{ name: '' }]);
  const [estimating, setEstimating] = useState(false);
  const [estimated, setEstimated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: '', cuisine: 'Home Kitchen', diet: 'veg', meal: ['lunch'], timeMin: 30, servings: 2, kcal: 300, steps: [''] });
      setIngs([{ name: '' }]);
      setEstimated(false);
    }
  }, [open]);

  const estimate = async () => {
    if (!form.name.trim()) return toast('Give the dish a name first', 'warn');
    setEstimating(true);
    try {
      const { data } = await api.post('/recipes/estimate', {
        name: form.name, servings: form.servings, diet: form.diet,
        ingredients: ings.filter((i) => i.name.trim()).map((i) => ({ name: i.name }))
      });
      setIngs(data.ingredients.map((i) => ({ ...i })));
      setEstimated(true);
      toast(data.engine === 'ai' ? 'AI estimated the quantities' : 'Estimated from standard portions (AI offline)', 'ok', data.engine === 'ai' ? 'AI done' : 'Heuristic');
    } catch (e) { toast(e.response?.data?.error || 'Estimate failed', 'err'); }
    setEstimating(false);
  };

  const save = async () => {
    if (!form.name.trim()) return toast('Name is required', 'warn');
    const clean = ings.filter((i) => i.name.trim() && (i.qty || estimated));
    if (!clean.length) return toast('Add at least one ingredient', 'warn');
    setSaving(true);
    try {
      const { data } = await api.post('/recipes', {
        ...form,
        baseServings: form.servings,
        ingredients: clean.map((i) => ({ name: i.name, qty: i.qty || 1, unit: i.unit || 'g', estimated: !!i.estimated })),
        steps: form.steps.filter(Boolean),
        tags: ['custom']
      });
      toast(`${data.recipe.name} added to the library`, 'ok', 'Recipe created');
      onAdded(data.recipe);
    } catch (e) { toast(e.response?.data?.error || 'Could not save recipe', 'err'); }
    setSaving(false);
  };

  const setIng = (idx, patch) => setIngs((arr) => arr.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  return (
    <Modal open={open} onClose={onClose} title="Add a recipe">
      <div className="flex wrap" style={{ gap: 8 }}>
        <input className="input" style={{ flex: 1, minWidth: 170 }} placeholder="Dish name (e.g. Maa ki Dal)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" type="number" min="1" style={{ width: 90 }} title="Servings" value={form.servings} onChange={(e) => setForm({ ...form, servings: Number(e.target.value) })} />
        <select className="input" style={{ width: 105 }} value={form.diet} onChange={(e) => setForm({ ...form, diet: e.target.value })}>
          {['veg', 'egg', 'nonveg'].map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="input" style={{ width: 118 }} value={form.meal[0]} onChange={(e) => setForm({ ...form, meal: [e.target.value] })}>
          {['breakfast', 'lunch', 'dinner', 'snack'].map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="meal-slot mt-2">ingredients</div>
      {ings.map((ing, i) => (
        <div key={i} className="flex mt-1" style={{ gap: 7 }}>
          <input className="input" style={{ flex: 1 }} placeholder={i.name !== undefined && ing.estimated ? undefined : 'e.g. paneer, rice, jeera'} value={ing.name || ''} onChange={(e) => setIng(i, { name: e.target.value })} />
          {estimated && (
            <>
              <input className="input" style={{ width: 84 }} type="number" value={ing.qty ?? ''} onChange={(e) => setIng(i, { qty: Number(e.target.value), estimated: false })} title="estimated, editable" />
              <select className="input" style={{ width: 72 }} value={ing.unit || 'g'} onChange={(e) => setIng(i, { unit: e.target.value })}>
                {['g', 'ml', 'pc'].map((u) => <option key={u}>{u}</option>)}
              </select>
              {ing.estimated && <span className="chip chip-gym" title="AI-estimated, editable" style={{ fontSize: 10 }}>est</span>}
            </>
          )}
          <button className="btn btn-ghost btn-icon" onClick={() => setIngs((a) => a.filter((_, j) => j !== i))}><Icon name="x" size={13} /></button>
        </div>
      ))}
      <div className="flex mt-2" style={{ gap: 8 }}>
        <button className="btn" onClick={() => setIngs((a) => [...a, { name: '' }])}><Icon name="plus" /> Ingredient</button>
        <button className="btn btn-primary" onClick={estimate} disabled={estimating}>
          <Icon name="sparkles" /> {estimating ? 'Estimating…' : estimated ? 'Re-estimate (AI)' : 'AI estimate quantities'}
        </button>
      </div>
      {estimated && <div className="small muted mt-1">Quantities are <b>AI-estimated, editable</b> - adjust anything before saving.</div>}

      <div className="meal-slot mt-2">steps</div>
      {form.steps.map((s, i) => (
        <textarea key={i} className="input mt-1" rows={2} placeholder={`Step ${i + 1}`} value={s} onChange={(e) => setForm({ ...form, steps: form.steps.map((x, j) => (j === i ? e.target.value : x)) })} />
      ))}
      <button className="btn mt-1" onClick={() => setForm({ ...form, steps: [...form.steps, ''] })}><Icon name="plus" /> Step</button>

      <div className="flex mt-3" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}><Icon name="check" /> {saving ? 'Saving…' : 'Save recipe'}</button>
      </div>
    </Modal>
  );
}
