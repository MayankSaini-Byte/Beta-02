import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { inr, copyText } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { isHousehold } from '../utils/accountType.js';
import Icon from '../components/Icon.jsx';

export default function Shopping() {
  const { toast, t, user } = useApp();
  const nav = useNavigate();
  const household = isHousehold(user);
  const [list, setList] = useState(null);
  const [newItem, setNewItem] = useState('');
  const [busyItem, setBusyItem] = useState('');
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);

  const load = async () => {
    const { data } = await api.get('/shopping/list');
    setList(data);
  };
  useEffect(() => { load().catch(() => toast('Could not load shopping list', 'err')); }, []);

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
    setBusyItem(item.id);
    try {
      const { data } = await api.post(`/shopping/items/${item.id}/bought`);
      toast(data.message, 'ok', 'Bought');
      await load();
    } catch (e) { toast(e.response?.data?.error || 'Could not update stock', 'err'); }
    setBusyItem('');
  };

  const removeItem = async (item) => {
    setBusyItem(item.id);
    try { await api.delete(`/shopping/items/${item.id}`); await load(); toast(`${item.name} removed`, 'ok'); }
    catch (e) { toast(e.response?.data?.error || 'Could not remove item', 'err'); }
    setBusyItem('');
  };

  const syncPlan = async () => {
    try {
      const { data } = await api.post('/shopping/sync-plan');
      toast(data.message, 'ok', 'Plan synced');
      load();
    } catch (e) { toast(e.response?.data?.error || 'No plan found', 'err'); }
  };

  const doShare = async () => {
    const tab = window.open('about:blank', '_blank');
    try {
      const { data } = await api.post('/shopping/share');
      if (tab) tab.location.href = data.whatsappUrl;
      else window.location.href = data.whatsappUrl;
    } catch { if (tab) tab.close(); toast('Could not build share text', 'err'); }
  };

  const doCopy = async () => {
    try {
      const entries = new Map();
      const automatic = household ? [] : (list.auto || []);
      for (const item of [...automatic, ...(list.saved || []).filter((row) => !row.boughtAt)]) {
        const key = item.key || item.name.trim().toLowerCase();
        const qty = item.buyDisplay || (item.toBuy ? `${item.toBuy} ${item.unit}` : `${item.qty || item.quantity || 1} ${item.unit || 'pc'}`);
        const previous = entries.get(key);
        if (!previous || (Number(item.toBuy || item.qty) > previous.amount)) entries.set(key, { name: item.name, qty, amount: Number(item.toBuy || item.qty) || 0 });
      }
      const text = [...entries.values()].map((item) => `${item.name} — ${item.qty}`).join('\n');
      if (!text) return toast('Your active shopping list is empty', 'warn');
      await copyText(text);
      toast('List copied to clipboard', 'ok');
    } catch { toast('Could not copy', 'err'); }
  };

  if (!list) return <div className="skeleton" style={{ height: 320 }} />;

  // group saved items by category
  const activeItems = (list.saved || []).filter((item) => !item.boughtAt);
  const purchasedItems = (list.saved || []).filter((item) => !!item.boughtAt);
  const grouped = activeItems.reduce((acc, i) => {
    const c = i.category || 'other';
    (acc[c] = acc[c] || []).push(i);
    return acc;
  }, {});

  const totalSaved = activeItems.length;
  const visibleItemIds = new Set((showAllItems ? activeItems : activeItems.slice(0, 5)).map((item) => item.id));

  return (
    <div>
      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, borderLeft: '3px solid var(--mustard)' }}>
        <div className="small muted"><b style={{ color: 'var(--text)' }}>Shopping list and order actions.</b> {household ? 'Compare real store listings by matching pack size and price.' : 'Build a vendor restock message for your suppliers.'}</div>
      </div>

      {/* Plan shortages - the connected loop */}
      {household && list.planNeeds && list.planNeeds.length > 0 && (
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
      {!household && list.auto.length > 0 && (
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
            <div className="sub">Grouped by category, duplicates merged · Mark bought updates your kitchen stock</div>
          </div>
          <div className="flex wrap" style={{ gap: 7 }}>
            <button className="btn" onClick={doShare}><Icon name="whatsapp" /> {t('shareList')}</button>
            <button className="btn" onClick={doCopy}><Icon name="copy" /> {t('copyList')}</button>
          </div>
        </div>

        <div className="flex wrap mb-2" role="tablist" aria-label="Shopping items" style={{ gap: 8 }}>
          <button className={`btn btn-sm ${!showPurchaseHistory ? 'btn-primary' : ''}`} role="tab" aria-selected={!showPurchaseHistory} onClick={() => setShowPurchaseHistory(false)}>Active list</button>
          <button className={`btn btn-sm ${showPurchaseHistory ? 'btn-primary' : ''}`} role="tab" aria-selected={showPurchaseHistory} onClick={() => setShowPurchaseHistory(true)}>Purchase history <span className="chip" style={{ marginLeft: 5 }}>{purchasedItems.length}</span></button>
        </div>

        {!showPurchaseHistory && <div className="flex wrap mb-2" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Add anything else you need..." value={newItem}
            onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
          <button className="btn btn-primary" onClick={addItem}><Icon name="plus" /> Add</button>
        </div>}

        {!showPurchaseHistory && totalSaved === 0 && <div className="small muted">List is empty - sync plan shortages or add items above.</div>}
        {showPurchaseHistory && purchasedItems.length === 0 && <div className="small muted">Items you mark as bought will appear here.</div>}

        {showPurchaseHistory && <div className="stagger">{purchasedItems.map((item) => <div key={item.id} className="member-row"><span className="chip chip-ok"><Icon name="check" /> Purchased</span><div style={{ flex: 1 }}><b>{item.name}</b><div className="small muted">{item.buyDisplay || `${item.toBuy || item.qty} ${item.unit || ''}`} · {item.boughtAt ? new Date(item.boughtAt).toLocaleString() : ''}</div></div><button className="btn btn-ghost btn-icon" onClick={() => removeItem(item)} disabled={busyItem === item.id} title="Remove history item"><Icon name="trash" size={14} /></button></div>)}</div>}

        {!showPurchaseHistory && Object.entries(grouped).map(([cat, items]) => {
          const visibleItems = items.filter((item) => visibleItemIds.has(item.id));
          if (!visibleItems.length) return null;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div className="meal-slot" style={{ marginBottom: 4 }}>{cat.replace('-', ' ')}</div>
              {visibleItems.map((i) => (
                <div key={i.id} className="member-row">
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 13.5 }}>{i.name}</b>
                    {i.boughtAt && <span className="chip chip-ok" style={{ marginLeft: 6 }}>Added to kitchen</span>}
                    {(i.sources || [i.source]).map((s) => <span key={s} className="chip" style={{ marginLeft: 6, fontSize: 10 }}>{s}</span>)}
                    <div className="small muted mt-1">{i.toBuy ? i.buyDisplay || `${i.toBuy} ${i.unit}` : ''} {i.estCost ? `· ~${inr(i.estCost)}` : ''}</div>
                  </div>
                  {household
                    ? <button className="btn btn-sm" onClick={() => nav(`/price-compare?item=${encodeURIComponent(i.key || i.name)}&unit=${encodeURIComponent(i.unit || 'pc')}`)} title="Compare stores and buy"><Icon name="external" size={13} /> Buy</button>
                    : <Link className="btn btn-sm" to="/vendors" title="Send a restock request to your vendor"><Icon name="whatsapp" size={13} /> Buy / restock</Link>}
                  <button className="btn btn-sm btn-primary" onClick={() => markBought(i)} disabled={busyItem === i.id} title="Add to kitchen stock"><Icon name="check" size={13} /> {t('markBought')}</button>
                  <button className="btn btn-ghost btn-icon" onClick={() => removeItem(i)} disabled={busyItem === i.id} title="Remove"><Icon name="trash" size={14} /></button>
                </div>
              ))}
            </div>
          );
        })}
        {!showPurchaseHistory && totalSaved > 5 && <div className="shopping-list-more">
          <button type="button" className="btn" onClick={() => setShowAllItems((current) => !current)}>
            {showAllItems ? 'Show less' : `View more (${totalSaved - 5})`}
            <Icon name={showAllItems ? 'chevronUp' : 'chevD'} size={14} />
          </button>
        </div>}
      </div>

      {household && <Link to="/price-compare" className="card flex-between wrap" style={{ display: 'flex', padding: 16, marginBottom: 14, textDecoration: 'none', border: '1px solid var(--accent)' }}>
        <div><b>Compare live store prices</b><div className="sub">Choose a delivery area, review this list, and see Rewalto listings with store links.</div></div>
        <span className="btn btn-primary"><Icon name="search" /> Open Store Offers</span>
      </Link>}

    </div>
  );
}
