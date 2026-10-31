import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api, { inr, downloadInventoryCsv } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';
import StatCard from '../components/StatCard.jsx';
import StockCard from '../components/StockCard.jsx';
import AddItemModal from '../components/AddItemModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { getAccountType } from '../utils/accountType.js';

const sevColor = { danger: 'var(--red)', warning: 'var(--amber)', info: 'var(--blue)' };
const chipClass = { full: 'chip-ok', partial: 'chip-warn', missing: 'chip-danger' };
const chipLabel = { full: 'Ready to cook', partial: 'Partially stocked', missing: 'Need to buy' };

export default function Dashboard() {
  const { user, toast, t } = useApp();
  const [dash, setDash] = useState(null);
  const [data, setData] = useState(null);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [busySlot, setBusySlot] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    const [d1, d2] = await Promise.all([api.get('/dashboard'), api.get('/pantry')]);
    setDash(d1.data);
    setData(d2.data);
  };

  useEffect(() => {
    const refresh = () => load().catch(() => toast('Could not load kitchen stock', 'err'));
    refresh();
    window.addEventListener('ks:household-diet-changed', refresh);
    return () => window.removeEventListener('ks:household-diet-changed', refresh);
  }, []);

  const exportCsv = async () => {
    setExporting(true);
    try { await downloadInventoryCsv(); toast('Inventory CSV downloaded', 'ok'); }
    catch (e) { toast(e.response?.data?.error || 'Could not export inventory', 'err'); }
    setExporting(false);
  };

  const markDone = async (slot) => {
    if (!dash?.planKey) return;
    setBusySlot(slot);
    try {
      const { data: res } = await api.post('/planner/mark-done', { date: dash.today, slot });
      toast(res.message, 'ok', 'Meal done');
      if (res.shortfall && res.shortfall.length) {
        toast(`Short: ${res.shortfall.map((s) => s.name).join(', ')} - deducted what was available`, 'warn');
      }
      await load();
    } catch (e) {
      toast(e.response?.data?.error || 'Could not mark done', 'err');
    }
    setBusySlot(null);
  };

  const undoMeal = async (slot) => {
    setBusySlot(slot);
    try {
      const { data: res } = await api.post('/planner/unmark', { date: dash.today, slot });
      toast(`Undo complete - ${res.restored} ingredient(s) restored`, 'ok');
      await load();
    } catch (e) {
      toast(e.response?.data?.error || 'Could not undo', 'err');
    }
    setBusySlot(null);
  };

  const categories = useMemo(() => (data ? [...new Set(data.items.map((i) => i.category))] : []), [data]);
  const filtered = useMemo(
    () => (data ? data.items.filter((i) => (cat === 'all' || i.category === cat) && i.name.toLowerCase().includes(q.toLowerCase())) : []),
    [data, cat, q]
  );

  const hh = (user && user.household) || {};
  const accountType = getAccountType(user);
  const household = accountType === 'household';
  const outletKind = ({ 'cloud-kitchen': 'Cloud kitchen', restaurant: 'Restaurant', cafe: 'Café', tiffin: 'Tiffin centre', pg: 'PG / hostel' })[user?.businessProfile?.businessType] || 'Kitchen';
  const freshness = useMemo(() => {
    const produce = (data?.items || []).filter((item) => /fruit|vegetable|produce/i.test(`${item.category || ''} ${item.name || ''}`));
    if (!produce.length) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const scores = produce.map((item) => {
      if (!item.expiryDate) return 80;
      const expiry = new Date(item.expiryDate);
      if (Number.isNaN(expiry.getTime())) return 80;
      expiry.setHours(0, 0, 0, 0);
      const days = Math.ceil((expiry - today) / 86400000);
      return days < 0 ? 0 : days === 0 ? 15 : days <= 2 ? 35 : days <= 5 ? 60 : days <= 7 ? 75 : 95;
    });
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }, [data]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');

  return (
    <div>
      <motion.div
        className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(120deg, rgba(74,222,128,0.13), rgba(224,114,74,0.07) 65%, transparent), var(--card)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 18
        }}
      >
        <div>
          <h1 style={{ fontSize: 24 }}>{greet}, {(user && user.name || 'Chef').split(' ')[0]}</h1>
          <div className="flex wrap mt-1" style={{ gap: 7 }}>
            <span className="chip chip-ok"><Icon name={household ? 'user' : 'users'} /> {household ? `${hh.adults ?? 2} adults${hh.children ? ` · ${hh.children} children` : ''}` : `${user?.businessProfile?.dailyServings || hh.residents || 2} people served daily`}</span>
            <span className="chip"><Icon name="home" /> {accountType === 'commercial' ? `${user?.businessProfile?.outletName || 'Commercial kitchen'} · ${outletKind}` : accountType === 'service' ? `${user?.businessProfile?.outletName || 'Food service'} · ${outletKind}` : 'Household'}</span>
            {household && <span className="chip"><Icon name="leaf" /> {hh.foodPractice === 'jain' ? 'Jain kitchen' : hh.foodPractice === 'satvik' ? 'Satvik kitchen' : hh.foodPractice === 'halal' ? 'Halal kitchen' : hh.diet === 'jain' ? 'Jain' : hh.diet === 'nonveg' ? 'Non-vegetarian' : hh.diet === 'vegan' ? 'Vegan' : hh.diet === 'egg' ? 'Eggetarian' : hh.diet === 'custom' ? 'All diets' : 'Vegetarian'}</span>}
            <span className="chip"><Icon name="clock" /> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </div>
        <div className="flex">
          {household && <Link to="/planner" className="btn"><Icon name="planner" /> {t('planWeek')}</Link>}
          <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" /> {t('addItems')}</button>
        </div>
      </motion.div>

      {household && dash && dash.preMealAlert && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="pre-alert">
          <span className="pulse-dot" />
          <div style={{ flex: 1 }}>
            <b style={{ fontFamily: 'var(--font-display)' }}>{dash.preMealAlert.message}</b>
            <div className="small muted mt-1">Sync the plan to your shopping list or order the missing items before cooking.</div>
          </div>
          <Link to="/shopping" className="btn btn-sm"><Icon name="cart" /> Fix it</Link>
        </motion.div>
      )}

      {dash && (
        <div className="stats-row">
          <StatCard icon="box" tone="green" label={t('itemsInStock')} value={dash.stats.total - dash.stats.out} />
          <StatCard icon="alert" tone="amber" label={t('runningLow')} value={dash.stats.low} />
          <StatCard icon="clock" tone="blue" label={t('expiring')} value={dash.stats.expiringSoon} />
          <StatCard icon="x" tone="red" label={t('expiredOut')} value={dash.stats.expired + dash.stats.out} />
          {!household && <StatCard icon="budget" tone="violet" label={t('kitchenValue')} value={dash.stats.estValue} prefix="₹" />}
          {freshness !== null && <StatCard icon="leaf" tone="green" label="Freshness index" value={`${freshness}%`} title="Estimate based on saved expiry dates for fruit and vegetable items." />}
        </div>
      )}

      {household && <section className="premium-feature-row">
        <div className="premium-feature-teaser"><span className="premium-pill">PREMIUM</span><b>Insights & Accuracy</b><small>See how stock accuracy and kitchen habits change over time.</small></div>
        <div className="premium-feature-teaser"><span className="premium-pill">PREMIUM</span><b>Wastage Watch</b><small>Track expired items and spot what your household can use sooner.</small></div>
      </section>}

      {/* ---------- Today's meals ---------- */}
      {household && dash && (
        <div className="card mt-3" style={{ padding: 18 }}>
          <div className="section-head" style={{ marginBottom: 12 }}>
            <div>
              <h2>{t('todaysMeals')}</h2>
              <div className="sub">Planned around your stock - mark done to auto-deduct what you cooked</div>
            </div>
            <Link to="/planner" className="btn btn-sm">Open planner <Icon name="chevR" size={13} /></Link>
          </div>
          <div className="meals-grid stagger">
            {dash.meals.map((m) => (
              <div key={m.slot} className={`meal-row ${m.recipe ? (m.recipe.done ? 'done' : `chip-${m.recipe.stockChip}`) : ''}`}>
                <div className="meal-slot">{t(m.slot)}</div>
                {m.recipe ? (
                  <>
                    <div className="meal-name">{m.recipe.name}</div>
                    <div className="meal-meta">
                      <span className={`chip ${chipClass[m.recipe.stockChip] || ''}`}>{chipLabel[m.recipe.stockChip]}</span>
                      {m.recipe.timeMin && <span className="chip"><Icon name="clock" size={12} /> {m.recipe.timeMin}m</span>}
                      {m.recipe.nutrition && m.recipe.nutrition.protein > 0 && (
                        <span className="chip chip-gym"><Icon name="dumbbell" size={12} /> {m.recipe.nutrition.protein}g protein</span>
                      )}
                    </div>
                    {m.recipe.why && m.recipe.why.length > 0 && (
                      <div className="meal-why"><b style={{ color: 'var(--text)' }}>Why:</b> {m.recipe.why[0]}</div>
                    )}
                    <div className="flex mt-2" style={{ gap: 8 }}>
                      {m.recipe.done ? (
                        <button className="btn btn-sm" onClick={() => undoMeal(m.slot)} disabled={busySlot === m.slot}>
                          <Icon name="undo" size={13} /> {t('undo')}
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-primary" onClick={() => markDone(m.slot)} disabled={busySlot === m.slot}>
                          <Icon name="check" size={13} /> {t('markDone')}
                        </button>
                      )}
                      <Link className="btn btn-sm" to={`/recipes/${m.recipe.key}`}>Recipe</Link>
                    </div>
                    {m.recipe.done && m.recipe.why && (
                      <div className="meal-why">Cooked - stock updated automatically.</div>
                    )}
                  </>
                ) : (
                  <div className="meal-why">Nothing planned - pick something in the planner.</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Use soon strip ---------- */}
      {dash && dash.useSoon && dash.useSoon.length > 0 && (
        <div className="mt-3" style={{ marginBottom: 4 }}>
          <div className="section-head" style={{ marginBottom: 8 }}>
            <div>
              <h2 style={{ fontSize: 16 }}>{t('useSoon')}</h2>
              <div className="sub">The planner already prefers these - here is what needs attention</div>
            </div>
          </div>
          <div className="use-soon stagger">
            {dash.useSoon.map((u) => (
              <div key={u.id} className="use-soon-item">
                <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 13.5 }}>{u.name}</b>
                  <span className="pulse-dot" style={{ background: u.daysToExpiry < 0 ? 'var(--red)' : undefined }} />
                </div>
                <span className="small muted">{u.daysToExpiry < 0 ? 'expired - remove today' : u.daysToExpiry === 0 ? 'expires today' : `${u.daysToExpiry} day${u.daysToExpiry === 1 ? '' : 's'} left`}</span>
                <span className="small">{u.qtyDisplay}{household ? '' : ` · ~${inr(u.estValue)}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-head mt-3">
        <div>
          <h2>{t('kitchenInventory')}</h2>
          <div className="sub">Bars show quantity vs capacity - the marker is your low-stock threshold</div>
        </div>
        <div className="flex" style={{ flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 210 }}>
            <input className="input" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 34 }} />
            <Icon name="search" size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--faint)' }} />
          </div>
          <button className="btn" onClick={exportCsv} disabled={exporting} title="Download CSV">
            <Icon name="upload" /> CSV
          </button>
        </div>
      </div>

      <div className="inventory-category-scroll">
        <button className={`chip ${cat === 'all' ? 'chip-active' : ''}`} onClick={() => setCat('all')}>All ({data ? data.items.length : 0})</button>
        {categories.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'chip-active' : ''}`} onClick={() => setCat(c)}>{c.replace('-', ' ')}</button>
        ))}
      </div>

      {!data && <div className="skeleton" style={{ height: 220 }} />}

      {data && filtered.length === 0 && (
        <EmptyState icon="search" title="Nothing matches here">
          Try a different category or search term, or add a new item to your kitchen stock.
        </EmptyState>
      )}

      <div className="inventory-scroll-panel"><div className="stock-grid">
        {filtered.map((item, i) => (
          <StockCard
            key={item._id} item={item} index={i}
            onChanged={(it) => setData((d) => ({ ...d, items: d.items.map((x) => (x._id === it._id ? { ...x, ...it } : x)) }))}
            onDeleted={(id) => setData((d) => ({ ...d, items: d.items.filter((x) => x._id !== id) }))}
          />
        ))}
      </div></div>

      {data && data.items.some((i) => i.state !== 'ok') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mt-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 14.5 }}>Some items need attention</b>
            <div className="small muted mt-1">{household ? 'Sync these items into your shopping list and compare live store offers.' : 'Prepare a restock request for a saved vendor.'}</div>
          </div>
          <Link to={household ? '/shopping' : '/vendors'} className="btn btn-primary"><Icon name={household ? 'cart' : 'whatsapp'} /> {household ? 'Open shopping list' : 'Restock with a vendor'}</Link>
        </motion.div>
      )}

      <AddItemModal open={adding} onClose={() => setAdding(false)} onAdded={() => load()} />
    </div>
  );
}
