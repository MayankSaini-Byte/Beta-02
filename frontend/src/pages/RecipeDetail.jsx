import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg, inr } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';
import CoverageRing from '../components/CoverageRing.jsx';
import Modal from '../components/Modal.jsx';

const statusStyle = {
  have: { bg: 'rgba(52,211,153,0.14)', color: 'var(--accent)', icon: 'check' },
  partial: { bg: 'rgba(251,191,36,0.14)', color: 'var(--amber)', icon: 'minus' },
  missing: { bg: 'rgba(248,113,113,0.14)', color: 'var(--red)', icon: 'plus' }
};

export default function RecipeDetail() {
  const { key } = useParams();
  const { toast, user } = useApp();
  const [data, setData] = useState(null);
  const [scale, setScale] = useState(1); // multiplier relative to household default
  const [favBusy, setFavBusy] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/recipes/${key}`);
      setData(data);
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  };

  useEffect(() => { load(); }, [key]);

  if (!data) return <div className="skeleton" style={{ height: 320 }} />;

  const { recipe, ingredients, availability, servings } = data;
  const factor = servings.factor * scale;
  const missing = availability.missingKeys;

  const toggleFav = async () => {
    setFavBusy(true);
    try {
      const { data: d } = await api.post(`/recipes/${key}/favorite`, { on: !recipe.favorite });
      setData((old) => ({ ...old, recipe: { ...old.recipe, favorite: d.favorite } }));
    } catch (e) { toast(errMsg(e), 'err'); }
    setFavBusy(false);
  };

  const addMissingToList = async () => {
    if (!missing.length) return;
    try {
      for (const m of missing) {
        await api.post('/shopping/items', { key: m.key, name: m.name, qty: m.need - m.have, unit: m.unit, source: 'recipe' });
      }
      toast(`${missing.length} missing ingredient(s) added to your shopping list`, 'ok', 'Shopping list updated');
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  const orderMissingNow = async () => {
    if (!missing.length) return;
    setOrdering(true);
    try {
      const items = missing.map((m) => ({ key: m.key, name: m.name, qty: Math.max(m.need - m.have, 1), unit: m.unit }));
      const { data: cmp } = await api.post('/shopping/compare', { items });
      if (!cmp.bestProvider) {
        toast('Stores have nothing available right now', 'warn');
        setOrdering(false);
        return;
      }
      await api.post('/shopping/cart', { providerId: cmp.bestProvider.id, items });
      toast(`Cart ready on ${cmp.bestProvider.name} for ${inr(cmp.bestProvider.total)} - checkout from Shopping page`, 'ok', 'Best price picked');
      setSwapOpen(false);
    } catch (e) { toast(errMsg(e), 'err'); }
    setOrdering(false);
  };

  return (
    <div>
      <Link to="/recipes" className="btn btn-ghost btn-sm mb-2"><Icon name="chevL" /> All recipes</Link>

      <div className="card" style={{ background: 'linear-gradient(120deg, rgba(16,185,129,0.12), transparent 55%), var(--card)' }}>
        <div className="flex-between wrap">
          <div style={{ maxWidth: 560 }}>
            <h1 style={{ fontSize: 24 }}>{recipe.name}</h1>
            <div className="flex wrap mt-1" style={{ gap: 7 }}>
              <span className="chip">{recipe.cuisine}</span>
              <span className="chip chip-ok">{recipe.diet}</span>
              <span className="chip"><Icon name="clock" /> {recipe.timeMin} min</span>
              <span className="chip"><Icon name="flame" /> {recipe.kcal} kcal</span>
              <span className="chip chip-ok">★ {recipe.rating} <span style={{ opacity: 0.7, fontWeight: 400 }}>(editorial)</span></span>
              {(recipe.tags || []).map((t) => <span key={t} className={`chip ${t === 'gym' ? 'chip-gym' : ''}`}>{t}</span>)}
              {recipe.source === 'custom' && <span className="chip chip-gym">yours</span>}
            </div>
            {recipe.nutrition && (
              <div className="macros">
                <span className="macro"><b style={{ color: 'var(--terra)', fontSize: 15 }}>{recipe.nutrition.protein}g</b> protein</span>
                <span className="macro"><b style={{ fontSize: 15 }}>{recipe.nutrition.carbs}g</b> carbs</span>
                <span className="macro"><b style={{ fontSize: 15 }}>{recipe.nutrition.fat}g</b> fat</span>
                <span className="macro"><b style={{ fontSize: 15 }}>{recipe.nutrition.fiber}g</b> fiber</span>
                <span className="small faint">per serving</span>
              </div>
            )}
          </div>
          <div className="flex" style={{ gap: 9 }}>
            <button className={`btn btn-icon ${recipe.favorite ? 'fav-btn on' : ''}`} onClick={toggleFav} disabled={favBusy} aria-label="Favourite">
              <Icon name="heart" />
            </button>
            <a className="btn btn-primary" href={recipe.youtubeUrl} target="_blank" rel="noreferrer">
              <Icon name="play" /> Watch on YouTube
            </a>
          </div>
        </div>
      </div>

      <div className="grid-31 mt-2">
        <div>
          <div className="card">
            <div className="flex-between mb-1">
              <h3 style={{ fontSize: 15 }}>Ingredients checklist</h3>
              <CoverageRing value={availability.coverage} />
            </div>
            <p className="tiny muted mb-2">
              Scaled for your household: {servings.household.adults} adult(s) + {servings.household.children} child(ren) = {servings.forHousehold} servings
              {scale !== 1 && <> · adjusted ×{scale}</>}
            </p>
            {ingredients.map((ing) => {
              const st = statusStyle[ing.status];
              return (
                <div className="ing-row" key={ing.key}>
                  <span className="ing-status" style={{ background: st.bg, color: st.color }}>
                    <Icon name={st.icon} />
                  </span>
                  <div className="grow">
                    <div className="flex-between">
                      <span className="ing-name">{ing.name}</span>
                      <span className="ing-qty inr">need {ing.needDisplay} · have {ing.haveDisplay}</span>
                    </div>
                    {ing.status !== 'have' && ing.alternate && (
                      <div className="ing-alt">
                        <Icon name="sparkles" size={11} /> Alternate: use {ing.alternate.name}
                        {ing.alternate.inStock ? ' (already in your kitchen)' : ` - or order ${ing.name}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card mt-2">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Method</h3>
            <ol className="steps-list">
              {recipe.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        </div>

        <div>
          <div className="card" style={{ position: 'sticky', top: 16 }}>
            <h3 style={{ fontSize: 15 }}>Personalize & cook</h3>
            <div className="field mt-2">
              <label className="label">Servings multiplier</label>
              <div className="flex" style={{ gap: 8 }}>
                <button className="qty-btn" style={{ width: 34, height: 34 }} onClick={() => setScale((s) => Math.max(0.5, +(s - 0.5).toFixed(1)))}><Icon name="minus" /></button>
                <div className="input tc bold" style={{ flex: 1 }}>×{scale.toFixed(1)}</div>
                <button className="qty-btn" style={{ width: 34, height: 34 }} onClick={() => setScale((s) => Math.min(4, +(s + 0.5).toFixed(1)))}><Icon name="plus" /></button>
              </div>
              <p className="tiny faint mt-1">Guests coming? Scale up - quantities and shopping needs update instantly.</p>
            </div>

            <div className="small mb-2" style={{ lineHeight: 1.6 }}>
              {availability.missingCount === 0 ? (
                <span style={{ color: 'var(--accent)' }}><b>Everything is in your kitchen.</b> Time to cook!</span>
              ) : (
                <span className="muted"><b style={{ color: 'var(--amber)' }}>{availability.missingCount} ingredient(s) missing</b> - alternatives are suggested above.</span>
              )}
            </div>

            <button className="btn btn-block mb-1" onClick={addMissingToList} disabled={!missing.length}>
              <Icon name="cart" /> Add missing to shopping list
            </button>
            <button className="btn btn-primary btn-block" onClick={() => setSwapOpen(true)} disabled={!missing.length || ordering}>
              <Icon name="sparkles" /> Order missing - best price
            </button>
            <p className="tiny faint mt-1 tc">Compares Instamart, Blinkit, Zepto & BigBasket and picks the cheapest basket.</p>
          </div>
        </div>
      </div>

      <Modal open={swapOpen} onClose={() => setSwapOpen(false)} title="Order missing ingredients">
        <p className="small muted mb-2">
          {missing.length} item(s) will be compared across 4 stores. The cheapest in-stock basket is added to your cart automatically.
        </p>
        {missing.map((m) => (
          <div key={m.key} className="quote-row">
            <Icon name="box" size={13} /> <b>{m.name}</b>
            <span className="muted small" style={{ marginLeft: 'auto' }}>{Math.max(0, Math.round((m.need - m.have) / (m.unit === 'g' || m.unit === 'ml' ? 1000 : 1) * 100) / 100) || 1} {m.unit === 'g' || m.unit === 'ml' ? (m.unit === 'g' ? 'kg' : 'L') : 'pc'}</span>
          </div>
        ))}
        <button className="btn btn-primary btn-block mt-2" onClick={orderMissingNow} disabled={ordering}>
          {ordering ? 'Comparing stores...' : 'Compare & build best cart'}
        </button>
      </Modal>
    </div>
  );
}
