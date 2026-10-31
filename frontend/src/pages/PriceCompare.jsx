import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';

const moneyMinor = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0) / 100);
const observedLabel = (value) => {
  if (!value) return 'No recent stock check';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'No recent stock check' : `Checked ${parsed.toLocaleString()}`;
};

function shoppingItems(data) {
  const rows = [
    ...(data?.saved || []).filter((item) => !item.boughtAt).map((item) => ({ ...item, qty: Number(item.toBuy || item.qty), sourceLabel: 'Shopping list' })),
    ...(data?.planNeeds || []).filter((item) => !item.inList).map((item) => ({ ...item, qty: Number(item.toBuy), sourceLabel: 'Meal plan' }))
  ].filter((item) => item.name && Number.isFinite(item.qty) && item.qty > 0 && item.unit);

  const merged = new Map();
  for (const item of rows) {
    const key = item.key || item.name.trim().toLowerCase();
    const previous = merged.get(key);
    if (!previous || item.qty > previous.qty) merged.set(key, item);
  }
  return [...merged.values()].map(({ name, key, qty, unit, sourceLabel }) => ({ name, key, qty, unit, sourceLabel }));
}

export default function PriceCompare() {
  const { toast, user } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [configured, setConfigured] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [compareError, setCompareError] = useState('');
  const pincode = String(user?.household?.pincode || '').trim();
  const validPincode = /^[1-9]\d{5}$/.test(pincode);
  const [selectedIds, setSelectedIds] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const items = useMemo(() => shoppingItems(list), [list]);
  const itemId = (item) => `${item.key || item.name.trim().toLowerCase()}::${item.unit}`;
  const selectedItems = useMemo(() => selectedIds === null ? items : items.filter((item) => selectedIds.includes(itemId(item))), [items, selectedIds]);

  const load = async () => {
    setLoadError('');
    try {
      const [listResponse, statusResponse] = await Promise.all([
        api.get('/shopping/list'),
        api.get('/shopping/live-compare/status')
      ]);
      setList(listResponse.data);
      setConfigured(Boolean(statusResponse.data.configured));
      const available = shoppingItems(listResponse.data);
      const requestedKey = new URLSearchParams(location.search).get('item')?.trim().toLowerCase();
      const requestedMatches = requestedKey ? available.filter((item) => String(item.key || item.name).trim().toLowerCase() === requestedKey || item.name.trim().toLowerCase() === requestedKey).map(itemId) : [];
      setSelectedIds((current) => current === null ? (requestedMatches.length ? requestedMatches : available.map(itemId)) : current.filter((id) => available.some((item) => itemId(item) === id)));
    } catch (error) {
      setLoadError(errMsg(error));
    }
  };

  useEffect(() => { load(); }, []);

  const compare = async (forceRefresh = false) => {
    if (!selectedItems.length) return toast('Select at least one item to compare.', 'warn');
    if (!validPincode) {
      toast('Add your delivery PIN in Profile before searching stores.', 'warn');
      navigate('/profile');
      return;
    }
    const action = forceRefresh ? 'Refresh live store listings' : 'Search live store listings';
    const approved = window.confirm(`${action} for ${selectedItems.length} selected item${selectedItems.length === 1 ? '' : 's'} near PIN ${pincode}? Rewalto may charge up to one credit per item. Cached results may be free.`);
    if (!approved) return;
    setBusy(!forceRefresh);
    setRefreshing(forceRefresh);
    setCompareError('');
    setResult(null);
    try {
      const { data } = await api.post('/shopping/live-compare', {
        pincode,
        forceRefresh,
        items: selectedItems.map(({ name, qty, unit }) => ({ name, qty, unit }))
      });
      if (!Array.isArray(data.items)) throw new Error('The price service returned an unreadable response. Please try again.');
      setResult(data);
    } catch (error) {
      const message = errMsg(error);
      setCompareError(message);
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  };

  const toggleItem = (item) => {
    const id = itemId(item);
    setSelectedIds((current) => {
      const selected = new Set(current ?? items.map(itemId));
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return [...selected];
    });
    setResult(null);
  };

  const toggleAll = () => {
    setSelectedIds(selectedItems.length === items.length ? [] : items.map(itemId));
    setResult(null);
  };

  if (!list && !loadError) return <div className="skeleton" style={{ height: 320 }} />;

  return (
    <div>
      <section className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="section-head" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div className="eyebrow">LIVE LISTINGS · REWALTO</div>
            <h2 style={{ margin: '5px 0', fontFamily: 'var(--font-display)' }}>Compare store prices</h2>
            <div className="sub">Find matching store listings for your KitchenSync shopping needs, then open a listing to buy.</div>
          </div>
          <Link className="btn" to="/shopping"><Icon name="cart" /> Edit shopping list</Link>
        </div>
        <div className="receipt-review mt-2" style={{ display: 'grid', gap: 4 }}>
          <b>How this works</b>
              <span>1. We use the delivery PIN saved in your household Profile.</span>
          <span>2. Review the items and quantities KitchenSync found.</span>
          <span>3. Compare live listings and open a retailer link.</span>
          <span className="tiny">Prices/availability are Rewalto’s latest collected data, may change, and are not checkout guarantees. A store link is shown only when Rewalto provides one.</span>
        </div>
        {loadError && <div className="receipt-review mt-2" role="alert"><b>Could not load price comparison.</b><div>{loadError}</div><button className="btn mt-1" onClick={load}>Try again</button></div>}
        {configured === null && !loadError && <div className="tiny muted mt-1">Checking live price service…</div>}
        {configured === false && <div className="receipt-review mt-2" role="alert"><b>Live comparison is not configured.</b><div>Add <code>MULTISTOREAPI</code> to <code>backend/.env</code> and restart KitchenSync.</div></div>}
      </section>

      {list && (
        <div className="grid-2" style={{ alignItems: 'start', gap: 16 }}>
          <section className="card" style={{ padding: 16 }}>
            <div className="section-head"><div><h2 style={{ fontSize: 16 }}>1 · Delivery area</h2><div className="sub">The PIN from your household Profile is used automatically.</div></div></div>
            <div className="price-profile-pin"><b>{validPincode ? `PIN ${pincode}` : 'No delivery PIN saved'}</b><Link className="btn btn-sm" to="/profile">{validPincode ? 'Edit in Profile' : 'Add in Profile'}</Link></div>
            {!validPincode && <div className="tiny muted mt-1">Save a six-digit delivery PIN in Profile to enable local store listings.</div>}
          </section>

          <section className="card" style={{ padding: 16 }}>
            <div className="section-head" style={{ alignItems: 'flex-start', gap: 12 }}><div><h2 style={{ fontSize: 16 }}>2 · Choose items</h2><div className="sub">Select only what you want to search across stores.</div></div><span className="chip">{selectedItems.length} of {items.length} selected</span></div>
            <button className="btn btn-primary mt-1" onClick={() => compare(false)} disabled={busy || refreshing || !selectedItems.length || configured !== true || !validPincode} style={{ width: '100%', justifyContent: 'center', minHeight: 46 }}>
              <Icon name="search" /> {busy ? 'Searching selected items…' : `Compare ${selectedItems.length || ''} selected item${selectedItems.length === 1 ? '' : 's'}`}
            </button>
              <div className="flex-between mt-2" style={{ gap: 8 }}><span className="tiny muted">Shopping list · meal plan needs</span><button type="button" className="btn btn-sm" onClick={toggleAll} disabled={!items.length}>{selectedItems.length === items.length ? 'Clear selection' : 'Select all'}</button></div>
            {!items.length ? (
              <div className="empty-state"><b>Your comparison list is empty.</b><p>Add items or sync meal-plan shortages from Shopping.</p><Link className="btn btn-primary" to="/shopping">Open shopping list</Link></div>
            ) : (
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {items.map((item) => {
                  const checked = selectedItems.some((selected) => itemId(selected) === itemId(item));
                  return <label key={itemId(item)} className="member-row" style={{ justifyContent: 'space-between', gap: 12, cursor: 'pointer', border: checked ? '1px solid var(--accent)' : '1px solid var(--border)', background: checked ? 'var(--surface-soft)' : 'transparent', padding: '12px 14px', borderRadius: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><input type="checkbox" checked={checked} onChange={() => toggleItem(item)} aria-label={`Compare ${item.name}`} /><span><b>{item.name}</b><span className="tiny muted" style={{ display: 'block' }}>{item.sourceLabel}</span></span></span><span className="small">{item.qty} {item.unit}</span>
                  </label>;
                })}
              </div>
            )}
            {!validPincode && <div className="tiny muted mt-1">Add the delivery PIN in Profile to compare nearby listings.</div>}
            {!items.length && <div className="tiny muted mt-1">Add or sync items before comparing.</div>}
            {items.length > 0 && !selectedItems.length && <div className="tiny muted mt-1">Select one or more items to enable comparison.</div>}
          </section>
        </div>
      )}

      <Modal open={Boolean(result)} onClose={() => setResult(null)} title={`Live store prices${result ? ` · PIN ${result.pincode}` : ''}`} width="min(960px, calc(100vw - 32px))">
        {result && <section style={{ padding: 4 }}>
          <div className="section-head" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div><h2 style={{ fontSize: 17 }}>Results for PIN {result.pincode}</h2><div className="sub">{result.cachedItems} cached · {result.creditsCharged} credit(s) charged</div></div>
            <button className="btn" onClick={() => compare(true)} disabled={busy || refreshing}><Icon name="refresh" /> {refreshing ? 'Refreshing…' : 'Refresh listings'}</button>
          </div>
          {result.cheapestBasketMinor !== null ? (
            <div className="swap-hint mb-2">Cheapest compatible multi-store basket: {moneyMinor(result.cheapestBasketMinor)}{result.bestSingleStore ? ` · Best single store (${result.bestSingleStore.retailer.replaceAll('_', ' ')}): ${moneyMinor(result.bestSingleStore.totalMinor)}` : ''}</div>
          ) : <div className="receipt-review mb-2">No complete basket total: at least one item is missing a compatible listing with a usable price and stock signal.</div>}
          {result.items.map((item, index) => (
            <article key={`${item.name}-${item.unit}-${index}`} style={{ padding: '13px 0', borderTop: '1px solid var(--border)' }}>
              <div className="flex-between wrap" style={{ gap: 8 }}><b>{item.name}</b><span className="small muted">Need {item.qty} {item.unit}{item.cheapest && ` · lowest compatible ${moneyMinor(item.cheapest.lineTotalMinor, item.cheapest.currency)}`}</span></div>
              {item.error ? <div className="receipt-review mt-1" role="alert">Couldn’t check this item: {item.error}</div> : !item.offers?.length ? <div className="small muted mt-1">No matching store listings for this PIN. Try another nearby PIN or check the item name.</div> : (
                <div className="device-grid mt-1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  {item.offers.map((offer, offerIndex) => (
                    <div key={`${offer.retailer}-${offer.title}-${offerIndex}`} className="plan-day" style={{ padding: 12 }}>
                      <div className="small muted">{offer.retailer.replaceAll('_', ' ')}{offer === item.cheapest ? ' · lowest compatible' : ''}</div>
                      <b>{offer.priceMinor == null ? 'No recent price' : moneyMinor(offer.priceMinor, offer.currency)}</b>
                      <div className="small">{offer.title}{offer.packSize ? ` · ${offer.packSize}` : ''}</div>
                      {offer.packsNeeded && <div className="tiny muted">{offer.packsNeeded} pack(s) · estimated {moneyMinor(offer.lineTotalMinor, offer.currency)}</div>}
                      {offer.unitPriceMinor != null && <div className="tiny muted">{moneyMinor(offer.unitPriceMinor, offer.currency)} / {offer.pack?.kind === 'mass' ? 'kg' : offer.pack?.kind === 'volume' ? 'L' : 'piece'}</div>}
                      <div className="tiny muted">{offer.stock === true ? 'In stock' : offer.stock === false ? 'Out of stock' : 'Availability unknown'} · {observedLabel(offer.observedAt)}</div>
                      {!offer.comparable && <div className="tiny muted">Pack size/product match could not be verified for an automatic total.</div>}
                      {offer.url?.startsWith('https://') && <a className="btn btn-sm mt-1" href={offer.url} target="_blank" rel="noopener noreferrer">{offer.stock === false ? 'Check availability ↗' : 'Open store listing ↗'}</a>}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>}
      </Modal>
      <Modal open={Boolean(compareError)} onClose={() => setCompareError('')} title="Price comparison issue" width="min(520px, calc(100vw - 32px))">
        <div className="receipt-review" role="alert" style={{ marginBottom: 16 }}>{compareError}</div>
        <div className="flex wrap" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={() => setCompareError('')}>Close</button>
          <button className="btn btn-primary" onClick={() => compare(false)} disabled={busy || configured !== true || !selectedItems.length || !validPincode}><Icon name="refresh" /> Try again</button>
        </div>
      </Modal>
    </div>
  );
}
