import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import api, { inr } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';

export default function Shopping() {
  const { toast, t } = useApp();
  const [list, setList] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [cart, setCart] = useState(null);
  const [order, setOrder] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [busyProvider, setBusyProvider] = useState(null);
  const [newItem, setNewItem] = useState('');
  const [shareText, setShareText] = useState('');
  const [itemRates, setItemRates] = useState(false);
  const [handoff, setHandoff] = useState(null);
  const [handoffBusy, setHandoffBusy] = useState('');

  const load = async () => {
    const { data } = await api.get('/shopping/list');
    setList(data);
    const { data: c } = await api.get('/shopping/cart');
    setCart(c.cart);
    setOrder(c.lastOrder);
  };
  useEffect(() => { load().catch(() => toast('Could not load shopping list', 'err')); }, []);

  const compareItems = useMemo(() => {
    if (!list) return [];
    const auto = list.auto.map((i) => ({ key: i.key, name: i.name, qty: i.toBuy || i.qty, unit: i.unit }));
    const saved = (list.saved || []).filter((s) => !s.done).map((i) => ({ key: i.key, name: i.name, qty: i.toBuy || i.qty, unit: i.unit }));
    const byKey = new Map();
    for (const it of [...auto, ...saved]) {
      const k = it.key || it.name;
      if (!byKey.has(k)) byKey.set(k, it);
    }
    return [...byKey.values()];
  }, [list]);

  const compareAll = async () => {
    if (!compareItems.length) return toast('Nothing to compare - list is empty', 'warn');
    setComparing(true);
    try {
      const { data } = await api.post('/shopping/compare', { items: compareItems });
      setComparison(data);
    } catch (e) { toast(e.response?.data?.error || 'Compare failed', 'err'); }
    setComparing(false);
  };

  const addCart = async (providerId) => {
    if (!compareItems.length) return toast('Nothing to add', 'warn');
    setBusyProvider(providerId);
    try {
      const { data } = await api.post('/shopping/cart', { providerId, items: compareItems });
      setCart(data.cart);
      toast(`${data.cart.providerName} cart ready: ${inr(data.cart.total)} (delivery ${data.cart.fee === 0 ? 'free' : inr(data.cart.fee)})`, 'ok', 'Added to cart');
      if (data.comparison.bestProvider?.id === providerId) toast(`Great pick - cheapest basket, saving ${inr(data.comparison.savings)}!`);
    } catch (e) { toast(e.response?.data?.error || 'Could not add to cart', 'err'); }
    setBusyProvider(null);
  };

  const checkout = async () => {
    try {
      const { data } = await api.post('/shopping/cart/checkout');
      setOrder(data.order);
      setCart(null);
      toast(data.message, 'ok', 'Order placed');
      load();
    } catch (e) { toast(e.response?.data?.error || 'Checkout failed', 'err'); }
  };

  const receive = async () => {
    try {
      const { data } = await api.post('/shopping/cart/receive');
      toast(data.message, 'ok', 'Stock updated');
      setOrder(null);
      load();
    } catch (e) { toast(e.response?.data?.error || 'Could not receive', 'err'); }
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    try {
      await api.post('/shopping/items', { name: newItem.trim(), source: 'manual' });
      setNewItem('');
      load();
      toast('Added to list');
    } catch (e) { toast(e.response?.data?.error || 'Could not add', 'err'); }
  };

  const markBought = async (item) => {
    try {
      const { data } = await api.post(`/shopping/items/${item.id}/bought`);
      toast(data.message, 'ok', 'Bought');
      load();
    } catch (e) { toast(e.response?.data?.error || 'Could not update stock', 'err'); }
  };

  const removeItem = async (item) => {
    await api.delete(`/shopping/items/${item.id}`);
    load();
  };

  const toggleDone = async (item) => {
    await api.patch(`/shopping/items/${item.id}`, { done: !item.done });
    load();
  };

  const syncPlan = async () => {
    try {
      const { data } = await api.post('/shopping/sync-plan');
      toast(data.message, 'ok', 'Plan synced');
      load();
    } catch (e) { toast(e.response?.data?.error || 'No plan found', 'err'); }
  };

  const doShare = async () => {
    try {
      const { data } = await api.post('/shopping/share');
      window.open(data.whatsappUrl, '_blank');
    } catch { toast('Could not build share text', 'err'); }
  };

  const doCopy = async () => {
    try {
      const { data } = await api.post('/shopping/share');
      setShareText(data.text);
      await navigator.clipboard.writeText(data.text);
      toast('List copied to clipboard', 'ok');
    } catch { toast('Could not copy', 'err'); }
  };

  // Deep-link hand-off: no quick-commerce platform has a public cart API, so
  // every item opens its PRE-FILLED SEARCH on the store itself and the user
  // ticks them into the real cart. Copy text is the fast path.
  const openHandoff = async (providerId) => {
    if (!compareItems.length) return toast('Nothing to order - the list is empty', 'warn');
    setHandoffBusy(providerId);
    try {
      const { data } = await api.post('/shopping/handoff', { providerId, items: compareItems });
      setHandoff(data);
      window.open(data.openUrl, '_blank', 'noopener');
      toast(`${data.provider.name} opened - add the items to your cart there`, 'ok', 'Hand-off ready');
    } catch (e) { toast(e.response?.data?.error || 'Hand-off failed', 'err'); }
    setHandoffBusy('');
  };

  const copyHandoff = async () => {
    if (!handoff) return;
    try {
      await navigator.clipboard.writeText(handoff.listText);
      toast('List copied - paste it in the store app chat/search', 'ok');
    } catch { toast('Could not copy', 'err'); }
  };

  if (!list) return <div className="skeleton" style={{ height: 320 }} />;

  // group saved items by category
  const grouped = (list.saved || []).reduce((acc, i) => {
    const c = i.category || 'other';
    (acc[c] = acc[c] || []).push(i);
    return acc;
  }, {});

  const totalSaved = (list.saved || []).filter((i) => !i.done).length;

  return (
    <div>
      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, borderLeft: '3px solid var(--mustard)' }}>
        <div className="small muted"><b style={{ color: 'var(--text)' }}>Price comparison (simulated).</b> Instamart, Blinkit, Zepto and BigBasket don't expose public price APIs and scraping breaks their ToS - this build uses a deterministic price simulator behind a pluggable adapter interface (<code>priceService.js</code>). Swap one file to go live with official/affiliate APIs.</div>
      </div>

      {order && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'var(--accent-deep)' }}>
          <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <b style={{ fontFamily: 'var(--font-display)' }}>Order {order.orderId}</b>
              <span className="small muted"> · {order.providerName} · {order.items.length} items · {inr(order.total)} · ETA {order.etaMin} min (simulated)</span>
            </div>
            <button className="btn btn-primary" onClick={receive}><Icon name="truck" /> Simulate delivery - update stock</button>
          </div>
        </motion.div>
      )}

      {/* Plan shortages - the connected loop */}
      {list.planNeeds && list.planNeeds.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="section-head" style={{ marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 16 }}>Shortages from your meal plan</h2>
              <div className="sub">These are needed for the week's plan (today onwards). One tap moves them into the list below.</div>
            </div>
            <button className="btn btn-primary" onClick={syncPlan}><Icon name="cart" /> Add all to list</button>
          </div>
          <div className="flex wrap" style={{ gap: 7 }}>
            {list.planNeeds.slice(0, 10).map((n) => (
              <span key={n.key} className="chip">{n.name}: {n.buyDisplay} · {inr(n.estCost)}{n.inList ? ' ✓' : ''}</span>
            ))}
          </div>
        </div>
      )}

      {/* Auto items */}
      {list.auto.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="section-head" style={{ marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 16 }}>Auto-generated from low/out-of-stock</h2>
              <div className="sub">Suggested quantities restore you above threshold</div>
            </div>
          </div>
          <div className="stagger">
            {list.auto.map((a) => (
              <div key={a.key || a.name} className="member-row" style={{ gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 13.5 }}>{a.name}</b>
                  <span className={`chip ${a.reason === 'Out of stock' ? 'chip-danger' : 'chip-warn'}`} style={{ marginLeft: 8 }}>{a.reason}</span>
                  <div className="small muted mt-1">{a.buyDisplay} · ~{inr(a.estCost)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved list grouped by category */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Your list {totalSaved > 0 && <span className="chip" style={{ marginLeft: 6 }}>{totalSaved}</span>}</h2>
            <div className="sub">Grouped by category, duplicates merged · "Mark bought" adds straight to your kitchen stock</div>
          </div>
          <div className="flex wrap" style={{ gap: 7 }}>
            <button className="btn" onClick={doShare}><Icon name="whatsapp" /> {t('shareList')}</button>
            <button className="btn" onClick={doCopy}><Icon name="copy" /> {t('copyList')}</button>
          </div>
        </div>

        <div className="flex wrap mb-2" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Add anything else you need..." value={newItem}
            onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
          <button className="btn btn-primary" onClick={addItem}><Icon name="plus" /> Add</button>
        </div>

        {shareText && <div className="receipt-review mb-2"><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, margin: 0 }}>{shareText}</pre></div>}

        {totalSaved === 0 && <div className="small muted">List is empty - sync plan shortages or add items above.</div>}

        {Object.entries(grouped).map(([cat, items]) => {
          const active = items.filter((i) => !i.done);
          if (!active.length) return null;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div className="meal-slot" style={{ marginBottom: 4 }}>{cat.replace('-', ' ')}</div>
              {active.map((i) => (
                <div key={i.id} className="member-row">
                  <input type="checkbox" checked={!!i.done} onChange={() => toggleDone(i)} style={{ width: 17, height: 17 }} aria-label={`Mark ${i.name}`} />
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 13.5 }}>{i.name}</b>
                    {(i.sources || [i.source]).map((s) => <span key={s} className="chip" style={{ marginLeft: 6, fontSize: 10 }}>{s}</span>)}
                    <div className="small muted mt-1">{i.toBuy ? i.buyDisplay || `${i.toBuy} ${i.unit}` : ''} {i.estCost ? `· ~${inr(i.estCost)}` : ''}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => markBought(i)} title="Add to kitchen stock"><Icon name="check" size={13} /> {t('markBought')}</button>
                  <button className="btn btn-ghost btn-icon" onClick={() => removeItem(i)} title="Remove"><Icon name="trash" size={14} /></button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Price comparison (simulated) */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Price comparison (simulated)</h2>
            <div className="sub">Fata-fat: pick the cheapest basket and add it to cart in one click.</div>
          </div>
          <button className="btn btn-primary" onClick={compareAll} disabled={comparing || compareItems.length === 0}>
            <Icon name="sparkles" /> {comparing ? 'Scanning 4 stores...' : `${t('comparePrices')} now`}
          </button>
        </div>

        {comparison && (
          <>
            <div className="device-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))' }}>
              {comparison.baskets.map((b) => {
                const best = comparison.bestProvider && comparison.bestProvider.id === b.providerId;
                return (
                  <div key={b.providerId} className="plan-day" style={{ borderColor: best ? 'var(--accent-deep)' : 'var(--border)', position: 'relative' }}>
                    {best && <span className="chip chip-ok" style={{ position: 'absolute', top: -10, right: 10 }}>BEST PRICE</span>}
                    <b style={{ fontFamily: 'var(--font-display)' }}>{b.providerName}</b>
                    <div className="small muted mt-1">{b.etaMin < 60 ? `${b.etaMin} min delivery` : `${Math.round(b.etaMin / 60)}h slot`} {b.missing > 0 && `· ${b.missing} out of stock`}</div>
                    <div className="weight-now" style={{ fontSize: 22 }}>{b.total}</div>
                    <div className="small muted">{b.subtotal} items + {b.fee === 0 ? 'free delivery' : `${b.fee} delivery`}</div>
                    <button className="btn btn-sm btn-primary mt-2" style={{ width: '100%' }} onClick={() => addCart(b.providerId)} disabled={busyProvider === b.providerId}>
                      <Icon name="cart" size={13} /> Add to cart
                    </button>
                  </div>
                );
              })}
            </div>
            {comparison.savings > 0 && <div className="swap-hint mt-2">Save {inr(comparison.savings)} by picking {comparison.bestProvider.name} for this basket.</div>}
            <button className="btn mt-2" onClick={() => setItemRates(!itemRates)}>{itemRates ? 'Hide' : 'Show'} item-wise store rates</button>
            {itemRates && (
              <div className="table-wrap mt-2">
                <table>
                  <thead><tr><th>Item</th>{comparison.baskets.map((b) => <th key={b.providerId}>{b.providerName}</th>)}</tr></thead>
                  <tbody>
                    {comparison.perItem.map((it) => (
                      <tr key={it.name + it.key}>
                        <td>{it.name} <span className="small muted">({it.commercial.qty} {it.commercial.unit})</span>{it.sanity && <span className="chip chip-danger" style={{ marginLeft: 5 }}>check</span>}</td>
                        {it.quotes.map((q) => <td key={q.providerId} style={{ color: q.inStock ? undefined : 'var(--faint)' }}>{q.lineTotal}{!q.inStock ? ' · OOS' : ''}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Deep-link order hand-off to the real apps */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Order on the real app (hand-off)</h2>
            <div className="sub">Opens each item's pre-filled search on the store - add to cart there. Works on your phone too.</div>
          </div>
        </div>
        <div className="device-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          {(list.providers || []).map((p) => (
            <button key={p.id} className="btn" style={{ borderColor: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}
              onClick={() => openHandoff(p.id)} disabled={handoffBusy === p.id}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: p.color, display: 'inline-block' }} />
              {handoffBusy === p.id ? 'Opening…' : `Order on ${p.name}`}
              <Icon name="external" size={13} />
            </button>
          ))}
        </div>

        {handoff && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
            <div className="flex-between wrap mb-1">
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 14 }}>
                {handoff.items.length} item(s) for {handoff.provider.name} · est ₹{handoff.total} (simulated)
              </b>
              <div className="flex" style={{ gap: 8 }}>
                <button className="btn btn-sm" onClick={copyHandoff}><Icon name="copy" size={12} /> Copy list for {handoff.provider.name}</button>
                <button className="btn btn-sm btn-primary" onClick={() => window.open(handoff.openUrl, '_blank', 'noopener')}><Icon name="external" size={12} /> Open {handoff.provider.name}</button>
              </div>
            </div>
            {handoff.items.map((l, i) => (
              <div key={i} className="member-row">
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 13.5 }}>{l.name}</b>
                  <span className="small muted"> · {l.qtyText} · ~₹{Math.round(l.estCost)}</span>
                </div>
                <a className="btn btn-sm" href={l.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <Icon name="external" size={12} /> Open in {handoff.provider.name}
                </a>
              </div>
            ))}
            <div className="tiny muted mt-1">{handoff.note}</div>
          </motion.div>
        )}
      </div>

      {/* Cart */}
      {cart && (
        <div className="card" style={{ padding: 16, marginBottom: 14, borderColor: 'var(--accent-deep)' }}>
          <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <b style={{ fontFamily: 'var(--font-display)' }}>Cart ready · {cart.providerName}</b>
              <div className="small muted mt-1">{cart.items.length} items · {cart.subtotal} + {cart.fee === 0 ? 'free delivery' : `${cart.fee} delivery`} = <b>{cart.total}</b> · ETA {cart.etaMin} min</div>
            </div>
            <button className="btn btn-primary" onClick={checkout}><Icon name="check" /> Place order (simulated)</button>
          </div>
        </div>
      )}
    </div>
  );
}
