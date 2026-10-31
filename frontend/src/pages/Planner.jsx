import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api, { inr } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';

const SLOTS = ['breakfast', 'lunch', 'dinner'];
const chipClass = { full: 'chip-ok', partial: 'chip-warn', missing: 'chip-danger' };
const chipLabel = { full: 'Ready', partial: 'Partial', missing: 'To buy' };

export default function Planner() {
  const { toast, t } = useApp();
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const [swapFor, setSwapFor] = useState(null); // {date, slot, current}
  const [swapOptions, setSwapOptions] = useState([]);
  const [copyFrom, setCopyFrom] = useState('');
  const [showWhy, setShowWhy] = useState(null); // meal object

  const load = async () => {
    const { data } = await api.get('/planner');
    setPlan(data.plan);
  };
  useEffect(() => { load().catch(() => toast('Could not load plan', 'err')); }, []);

  const act = async (fn, key) => {
    setBusy(key || 'busy');
    try { await fn(); } catch (e) { toast(e.response?.data?.error || 'Action failed', 'err'); }
    setBusy('');
  };

  const reoptimize = () => act(async () => {
    const { data } = await api.post('/planner/generate', {});
    setPlan(data.plan);
    toast('Week re-optimized - locked meals kept', 'ok');
  }, 'gen');

  const syncList = () => act(async () => {
    const { data } = await api.post('/planner/sync-shopping', {});
    toast(data.message, 'ok', 'Shopping list synced');
  }, 'sync');

  const orderWeek = () => act(async () => {
    const { data } = await api.post('/planner/order', {});
    if (!data.cart) return toast(data.message, 'ok');
    toast(`${data.cart.providerName} cart ready: ${inr(data.cart.total)} (cheapest of 4 stores)`, 'ok', 'Best-price cart');
  }, 'order');

  const setSlot = (date, slot, key) => act(async () => {
    const { data } = await api.put('/planner/slot', { date, slot, key });
    setPlan(data.plan);
    setSwapFor(null);
    toast(key ? 'Meal swapped' : 'Meal cleared', 'ok');
  }, `swap-${date}-${slot}`);

  const toggleLock = (date, slot, locked) => act(async () => {
    const { data } = await api.post('/planner/lock', { date, slot, locked: !locked });
    setPlan(data.plan);
    toast(!locked ? 'Meal locked - re-optimize will keep it' : 'Meal unlocked', 'ok');
  }, `lock-${date}-${slot}`);

  const copyDayTo = (from, to) => act(async () => {
    if (!from || !to) return;
    const { data } = await api.post('/planner/copy-day', { from, to });
    setPlan(data.plan);
    toast(`Day copied from ${from}`, 'ok');
  }, 'copy');

  const doSwap = (date, slot, key) => act(async () => {
    const { data } = await api.put('/planner/slot', { date, slot, key });
    setPlan(data.plan);
    toast(`Swapped to ${key}` , 'ok');
  }, `doswap-${date}-${slot}`);

  const markDone = (date, slot) => act(async () => {
    const { data } = await api.post('/planner/mark-done', { date, slot });
    setPlan(data.plan);
    toast(data.message, 'ok', 'Meal done');
    if (data.shortfall && data.shortfall.length) {
      toast(`Short: ${data.shortfall.map((s) => s.name).join(', ')}`, 'warn');
    }
  }, `done-${date}-${slot}`);

  const unmark = (date, slot) => act(async () => {
    const { data } = await api.post('/planner/unmark', { date, slot });
    setPlan(data.plan);
    toast(`Undo complete - ${data.restored} ingredient(s) restored`, 'ok');
  }, `undo-${date}-${slot}`);

  const openSwap = async (date, slot, current) => {
    setSwapFor({ date, slot, current });
    try {
      const params = { cookable: '0' };
      const { data } = await api.get('/recipes', { params });
      setSwapOptions(data.recipes.filter((r) => r.key !== current).slice(0, 14));
    } catch { setSwapOptions([]); }
  };

  if (!plan) return <div className="skeleton" style={{ height: 320 }} />;

  const b = plan.summary.budget;
  const today = plan.today;

  return (
    <div>
      {/* Budget bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="budget-row">
          <b style={{ fontFamily: 'var(--font-display)' }}>
            {b.fits ? '✅ ' : '⚠️ '}{b.message}
          </b>
          <span className="small muted">{b.pct}% of weekly budget</span>
        </div>
        <div className="budget-bar"><div className={`budget-fill ${b.fits ? '' : 'over'}`} style={{ width: `${Math.min(100, b.pct)}%` }} /></div>
        {!b.fits && plan.summary.cheaperSwaps.length > 0 && (
          <div className="swap-hint">
            <b style={{ color: 'var(--terra)' }}>Cheaper swaps to get under budget:</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {plan.summary.cheaperSwaps.map((s, i) => (
                <li key={i} style={{ marginBottom: 3 }}>
                  {s.note}{' '}<button className="link-btn" onClick={() => doSwap(s.date, s.slot, s.toKey)}>Apply swap</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      {/* Action bar */}
      <div className="flex wrap mb-2" style={{ gap: 8 }}>
        <button className="btn btn-primary" onClick={reoptimize} disabled={busy === 'gen'}>
          <Icon name="refresh" /> {t('reoptimize')}
        </button>
        <button className="btn" onClick={syncList} disabled={busy === 'sync'}>
          <Icon name="cart" /> {t('syncToList')} ({plan.summary.toBuyCount})
        </button>
        <button className="btn" onClick={orderWeek} disabled={busy === 'order'}>
          <Icon name="truck" /> {t('orderWeek')} ({inr(plan.summary.totalCost)})
        </button>
        <span className="chip">{plan.summary.avgCoverage}% avg stock coverage</span>
        <span className="chip">{plan.summary.mealsPlanned} upcoming meals</span>
      </div>

      {/* Week grid */}
      <div className="stagger">
        {plan.days.map((day) => (
          <div key={day.date} className={`plan-day ${day.isPast ? 'past-day' : ''}`}>
            <div className="plan-head">
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>
                {day.label} {day.date.slice(8)}/{day.date.slice(5, 7)}
                {day.date === today && <span className="chip chip-ok" style={{ marginLeft: 8 }}>Today</span>}
                {day.isPast && <span className="chip" style={{ marginLeft: 8 }}>Past</span>}
              </b>
              {!day.isPast && (
                <div className="flex" style={{ gap: 6 }}>
                  <select className="input" style={{ width: 128, padding: '5px 8px', fontSize: 12 }} value="" onChange={(e) => { if (e.target.value) copyDayTo(day.date, e.target.value); }}>
                    <option value="">{t('copyDay')} to…</option>
                    {plan.days.filter((d) => !d.isPast && d.date !== day.date).map((d) => (
                      <option key={d.date} value={d.date}>{d.label} {d.date.slice(8)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {SLOTS.map((slot) => {
              const m = day.meals[slot];
              if (!m) return <div key={slot} className="meal-slot-row"><span className="slot-tag">{t(slot)}</span><span className="small muted">Nothing planned</span></div>;
              return (
                <div key={slot} className="meal-slot-row">
                  <span className="slot-tag">{t(slot)}</span>
                  <b style={{ fontSize: 13.5 }}>{m.name}</b>
                  <span className={`chip ${chipClass[m.stockChip]}`}>{chipLabel[m.stockChip]}</span>
                  {m.done && <span className="chip chip-ok"><Icon name="check" size={12} /> Done</span>}
                  {m.usesExpiring.length > 0 && <span className="chip chip-warn">uses expiring</span>}
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-ghost btn-icon" title="Why this meal?" onClick={() => setShowWhy(showWhy === `${day.date}${slot}` ? null : `${day.date}${slot}`)}><Icon name="eye" size={14} /></button>
                  {!day.isPast && !m.done && (
                    <>
                      <button className="btn btn-ghost btn-icon" title={m.locked ? 'Unlock' : 'Lock (keep on re-optimize)'} onClick={() => toggleLock(day.date, slot, m.locked)}>
                        <Icon name={m.locked ? 'lock' : 'unlock'} size={14} />
                      </button>
                      <button className="btn btn-ghost btn-icon" title="Swap meal" onClick={() => openSwap(day.date, slot, m.key)}><Icon name="swap" size={14} /></button>
                    </>
                  )}
                  {!day.isPast && (m.done ? (
                    <button className="btn btn-sm" onClick={() => unmark(day.date, slot)} title="Undo - restore stock"><Icon name="undo" size={13} /> {t('undo')}</button>
                  ) : (
                    <button className="btn btn-sm btn-primary" onClick={() => markDone(day.date, slot)}><Icon name="check" size={13} /> {t('markDone')}</button>
                  ))}
                  <AnimatePresence>
                    {showWhy === `${day.date}${slot}` && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ width: '100%' }}>
                        <div className="meal-why" style={{ borderTop: '1px dashed var(--border)', paddingTop: 8, marginTop: 4 }}>
                          {m.why.map((w, i) => <div key={i}>• {w}</div>)}
                          {m.deductions && m.deductions.length > 0 && (
                            <div style={{ marginTop: 5 }}><b>Deducted:</b> {m.deductions.map((d) => `${d.display} ${d.name}`).join(', ')}</div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Shopping needs summary */}
      {plan.summary.needs.length > 0 && (
        <div className="card mt-3" style={{ padding: 16 }}>
          <div className="section-head" style={{ marginBottom: 10 }}>
            <div>
              <h2>Weekly stock needed</h2>
              <div className="sub">Only today onwards - past days and cooked meals are excluded</div>
            </div>
            <button className="btn" onClick={syncList}><Icon name="cart" /> {t('syncToList')}</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Have</th><th>To buy</th><th>Est. cost</th></tr></thead>
              <tbody>
                {plan.summary.needs.slice(0, 10).map((n) => (
                  <tr key={n.key}>
                    <td>{n.name}{n.flag && <span className="chip chip-danger" style={{ marginLeft: 6 }}>check unit</span>}</td>
                    <td>{Math.round(n.have)} {n.unit}</td>
                    <td>{n.buyDisplay}</td>
                    <td>{inr(n.estCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Swap modal */}
      <Modal open={!!swapFor} onClose={() => setSwapFor(null)} title={`Swap ${swapFor ? swapFor.slot : ''}`}>
        {swapFor && (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <div className="small muted mb-2">Pick any recipe - coverage is shown per your current stock.</div>
            {swapOptions.map((r) => (
              <button key={r.key} className="member-row" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', borderBottom: '1px dashed var(--border)' }} onClick={() => setSlot(swapFor.date, swapFor.slot, r.key)}>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 13.5 }}>{r.name}</b>
                  <div className="small muted">{r.cuisine} · {r.timeMin} min · {r.nutrition ? `${r.nutrition.protein}g protein` : ''}</div>
                </div>
                <span className={`chip ${r.availability.coverage >= 95 ? 'chip-ok' : r.availability.coverage >= 60 ? 'chip-warn' : 'chip-danger'}`}>{r.availability.coverage}%</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
