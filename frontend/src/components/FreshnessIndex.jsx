import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { errMsg } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from './Icon.jsx';

const FILTERS = ['All', 'Fresh', 'Use soon', 'Almost gone'];
const GROUPS = ['All produce', 'Leafy greens', 'Gourds', 'Roots & tubers', 'Tomatoes & onions', 'Fruits'];
const BAND = (score) => score >= 80 ? 'fresh' : score >= 60 ? 'soon' : score >= 40 ? 'ageing' : 'critical';
const LABEL = (score) => score >= 80 ? 'Fresh' : score >= 60 ? 'Use soon' : score >= 40 ? 'Ageing' : 'Almost gone';
const EMOJI = [
  [/spinach|palak/i, '🥬'], [/methi|leaf|lettuce/i, '🥬'], [/tomato/i, '🍅'], [/onion/i, '🧅'],
  [/potato/i, '🥔'], [/carrot/i, '🥕'], [/cucumber/i, '🥒'], [/lemon/i, '🍋'], [/banana/i, '🍌'],
  [/apple/i, '🍎'], [/orange/i, '🍊'], [/grape/i, '🍇'], [/papaya/i, '🍈'], [/mango/i, '🥭']
];
const produceEmoji = (name) => EMOJI.find(([pattern]) => pattern.test(name))?.[1] || '🥦';

function FreshnessRing({ item }) {
  const score = Math.max(0, Math.min(100, Number(item.score) || 0));
  const band = BAND(score);
  const circumference = 2 * Math.PI * 24;
  return <div className={`freshness-ring ${band}`} role="img" aria-label={`${item.name}: ${score}% freshness, ${item.label}`}>
    <svg viewBox="0 0 56 56" aria-hidden="true"><circle className="freshness-ring-track" cx="28" cy="28" r="24" /><circle className="freshness-ring-value" cx="28" cy="28" r="24" strokeDasharray={`${circumference}`} strokeDashoffset={`${circumference * (1 - score / 100)}`} /></svg>
    <span>{score}<small>%</small></span>
  </div>;
}

function Skeletons({ dairy }) {
  return <div className={dairy ? 'freshness-dairy-list' : 'freshness-produce-grid'} aria-label="Loading freshness data">
    {Array.from({ length: 4 }, (_, i) => <div key={i} className={`freshness-skeleton ${dairy ? 'dairy' : ''}`} />)}
  </div>;
}

export default function FreshnessIndex({ category = 'produce' }) {
  const { toast } = useApp();
  const [items, setItems] = useState(null);
  const [average, setAverage] = useState(null);
  const [sort, setSort] = useState('worst');
  const [filter, setFilter] = useState('All');
  const [group, setGroup] = useState('All produce');
  const [busy, setBusy] = useState('');
  const dairy = category === 'dairy';

  const load = useCallback(async () => {
    setItems(null);
    try {
      const { data } = await api.get(`/freshness/${dairy ? 'dairy' : 'produce'}`);
      setItems(data.items || []);
      setAverage(data.average);
    } catch (error) {
      setItems([]);
      toast(errMsg(error), 'err');
    }
  }, [dairy, toast]);

  useEffect(() => { load(); }, [load]);

  const ordered = useMemo(() => {
    let rows = [...(items || [])];
    if (!dairy && group !== 'All produce') rows = rows.filter((item) => item.subgroup === group);
    if (filter === 'Fresh') rows = rows.filter((item) => item.score >= 80 && item.daysLeft >= 0);
    if (filter === 'Use soon') rows = rows.filter((item) => item.score >= 60 && item.score < 80 && item.daysLeft >= 0);
    if (filter === 'Almost gone') rows = rows.filter((item) => item.score < 60 || item.daysLeft < 0);
    return rows.sort(sort === 'az' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.score - b.score || a.name.localeCompare(b.name));
  }, [items, dairy, group, filter, sort]);

  const act = async (item, action) => {
    if (!window.confirm(`${action === 'spoiled' ? 'Discard' : 'Mark as used'} all ${item.quantity} ${item.unit} of ${item.name}?`)) return;
    setBusy(`${item.id}:${action}`);
    try {
      await api.post(`/freshness/${dairy ? 'dairy' : 'produce'}/${item.id}/${action}`);
      toast(action === 'spoiled' ? `${item.name} logged as food waste.` : `${item.name} marked as used.`, 'ok');
      await load();
    } catch (error) { toast(errMsg(error), 'err'); }
    setBusy('');
  };

  const toggleOpened = async (item) => {
    const opened = !item.opened;
    const optimistic = { ...item, opened, openedAt: opened ? new Date().toISOString().slice(0, 10) : null };
    setItems((current) => current?.map((row) => row.id === item.id ? scoreOptimistically(optimistic) : row));
    try {
      await api.patch(`/pantry/${item.id}`, { opened, openedAt: opened ? new Date().toISOString().slice(0, 10) : null });
      await load();
    } catch (error) { toast(errMsg(error), 'err'); await load(); }
  };

  const expired = dairy ? ordered.filter((item) => item.daysLeft < 0) : [];
  const active = dairy ? ordered.filter((item) => item.daysLeft >= 0) : ordered;
  const useFirst = !dairy ? [...(items || [])].sort((a, b) => a.score - b.score).slice(0, 3) : [];

  return <section className={`freshness-module ${dairy ? 'dairy-theme' : 'produce-theme'}`}>
    <header className="freshness-heading">
      <div><span className="eyebrow">KITCHEN FRESHNESS</span><h2>{dairy ? 'Dairy products' : 'Vegetables & fruits'}</h2><p>{dairy ? 'Cold-chain aware freshness for milk, curd and more.' : 'Keep your greens, vegetables and fruit at their best.'}</p></div>
      <div className="freshness-average"><FreshnessRing item={{ name: dairy ? 'Dairy average' : 'Produce average', score: average ?? 0, label: 'average' }} /><span>Average<strong>{average == null ? '—' : `${average}%`}</strong></span></div>
    </header>

    {items === null ? <Skeletons dairy={dairy} /> : !items.length ? <div className="freshness-empty"><span aria-hidden="true">{dairy ? '🥛' : '🥬'}</span><h3>Add your first item</h3><p>Freshness will appear here once you add {dairy ? 'dairy products' : 'fruit or vegetables'} to My Kitchen.</p></div> : <>
      {!dairy && <section className="freshness-use-first" aria-label="Use first: three lowest freshness items"><div><span className="freshness-section-kicker">USE FIRST</span><b>Best to use next</b></div><div className="freshness-use-first-list">{useFirst.map((item) => <span key={item.id}><i>{produceEmoji(item.name)}</i><b>{item.name}</b><small>{item.daysLabel}</small></span>)}</div></section>}
      {dairy && expired.length > 0 && <section className="dairy-discard-strip" aria-label="Discard today"><div><b>Discard today</b><span>Expired dairy should not be consumed. Dispose of these items safely.</span></div><div>{expired.map((item) => <span key={item.id}>{item.name} · {item.quantity} {item.unit}<button type="button" onClick={() => act(item, 'spoiled')} disabled={busy.startsWith(`${item.id}:`)}>Log discard</button></span>)}</div></section>}
      <div className="freshness-controls">
        {!dairy && <div className="freshness-groups" role="group" aria-label="Filter produce group">{GROUPS.map((name) => <button type="button" key={name} className={group === name ? 'active' : ''} onClick={() => setGroup(name)}>{name}</button>)}</div>}
        <div className="freshness-filters" role="group" aria-label="Filter by freshness">{FILTERS.map((name) => <button type="button" key={name} className={filter === name ? 'active' : ''} onClick={() => setFilter(name)}>{name}</button>)}
          <label>Sort <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort freshness items"><option value="worst">Worst first</option><option value="az">A–Z</option></select></label>
        </div>
      </div>
      {dairy ? <div className="freshness-dairy-list">{active.map((item) => <article className={`freshness-dairy-row ${BAND(item.score)}`} key={item.id}>
        <div className="dairy-icon" aria-hidden="true">{/cheese|paneer/i.test(item.name) ? '🧀' : /butter|cream/i.test(item.name) ? '🧈' : '🥛'}</div><FreshnessRing item={item} />
        <div className="dairy-product-copy"><div><h3>{item.name}</h3><span className={`freshness-label ${BAND(item.score)}`}>{item.label}</span></div><p>{item.quantity} {item.unit} · {item.daysLabel} · {item.storage}</p><span className="cold-chain-badge"><Icon name="thermometer" size={13} /> 0–4°C cold chain</span>{item.opened && item.score < 60 && <div className="dairy-open-warning"><b>Opened {item.openedDays || 0} day{item.openedDays === 1 ? '' : 's'} ago</b> — {item.daysLeft <= 1 ? 'use within 24h' : `use within ${item.daysLeft} days`}</div>}</div>
        <button type="button" className={`opened-toggle ${item.opened ? 'is-open' : ''}`} aria-label={`${item.name}: ${item.opened ? 'opened' : 'sealed'}. Click to mark ${item.opened ? 'sealed' : 'opened'}`} onClick={() => toggleOpened(item)}>{item.opened ? '✓ Opened' : '🔒 Sealed'}</button>
        <div className="freshness-actions"><button type="button" onClick={() => act(item, 'used')} disabled={busy.startsWith(`${item.id}:`)}>Mark as used</button><button type="button" className="quiet-danger" onClick={() => act(item, 'spoiled')} disabled={busy.startsWith(`${item.id}:`)}>Mark as spoiled</button></div>
      </article>)}</div> : <div className="freshness-produce-grid">{active.map((item) => <article className={`freshness-produce-card ${BAND(item.score)}`} key={item.id}>
        <div className="produce-card-top"><span className="produce-emoji" aria-hidden="true">{produceEmoji(item.name)}</span><FreshnessRing item={item} /></div><h3>{item.name}</h3><p>{item.quantity} {item.unit} · {item.storage}</p><div className="produce-card-status"><span className={`freshness-label ${BAND(item.score)}`}>{item.label}</span><b>{item.daysLabel}</b></div><div className="freshness-actions"><button type="button" onClick={() => act(item, 'used')} disabled={busy.startsWith(`${item.id}:`)}>Mark as used</button><button type="button" className="quiet-danger" onClick={() => act(item, 'spoiled')} disabled={busy.startsWith(`${item.id}:`)}>Mark as spoiled</button></div>
      </article>)}</div>}
      {!active.length && !expired.length && <div className="freshness-empty compact">No items match this filter. Try another freshness band.</div>}
    </>}
  </section>;
}

function scoreOptimistically(item) {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(`${item.purchaseDate}T00:00:00`).getTime()) / 86400000));
  const base = Math.max(1, Number(item.shelfLifeDays) || 7) * (item.storage === 'room' ? 0.65 : item.storage === 'freezer' ? 2.5 : 1);
  const left = Math.max(0, Math.ceil(base - elapsed) * (item.opened ? 0.5 : 1));
  const score = Math.max(0, Math.min(100, Math.round(left / base * 100)));
  return { ...item, score, label: LABEL(score), daysLeft: left, daysLabel: left === 0 ? 'expires today' : `${left} day${left === 1 ? '' : 's'} left` };
}
