import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import api, { errMsg } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';

const catEmojiTone = {
  vegetables: 'green', fruits: 'green', dairy: 'blue', grains: 'amber', pulses: 'amber',
  spices: 'violet', bakery: 'amber', frozen: 'blue', protein: 'red', beverages: 'violet',
  'oils-condiments': 'amber', packaged: 'violet', other: 'green'
};

const STEP_BY_UNIT = { g: 100, ml: 100, pc: 1 };

export default function StockCard({ item, index, onChanged, onDeleted }) {
  const { toast } = useApp();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ quantity: item.quantity, threshold: item.threshold, expiryDate: item.expiryDate || '' });

  useEffect(() => {
    if (editing) setForm({ quantity: item.quantity, threshold: item.threshold, expiryDate: item.expiryDate || '' });
  }, [editing, item.quantity, item.threshold, item.expiryDate]);

  const pct = Math.min(100, item.capacity > 0 ? (item.quantity / item.capacity) * 100 : 0);
  const thrPct = Math.min(100, item.capacity > 0 ? (item.threshold / item.capacity) * 100 : 0);
  const tone = item.state === 'out' ? 'bar-out' : item.state === 'low' ? 'bar-low' : 'bar-ok';
  const step = STEP_BY_UNIT[item.unit] || 1;

  const adjust = async (delta) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/pantry/${item._id}/adjust`, { delta, reason: 'quick +/- from dashboard' });
      onChanged(data.item);
    } catch (e) { toast(errMsg(e), 'err'); }
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      const expirySource = form.expiryDate && form.expiryDate !== item.expiryDate ? 'entered' : item.expirySource || 'recorded';
      const { data } = await api.patch(`/pantry/${item._id}`, { ...form, expirySource });
      onChanged(data.item);
      setEditing(false);
      toast(`${item.name} updated`);
    } catch (e) { toast(errMsg(e), 'err'); }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/pantry/${item._id}`);
      onDeleted(item._id);
      setEditing(false);
      toast(`${item.name} removed from stock`);
    } catch (e) { toast(errMsg(e), 'err'); }
    setBusy(false);
  };

  const expiryChip = () => {
    if (item.expiryState === 'expired') return <span className={`chip ${item.expirySource === 'estimated' ? 'chip-warn' : 'chip-bad'}`}><Icon name="alert" /> {item.expirySource === 'estimated' ? 'Freshness estimate passed' : 'Expired'}</span>;
    if (item.expiryState === 'soon') return <span className="chip chip-warn"><Icon name="clock" /> {item.expirySource === 'estimated' ? `Est. ${item.daysToExpiry}d left` : `${item.daysToExpiry}d left`}</span>;
    if (item.expiryDate) return <span className="chip"><Icon name="clock" /> {item.expirySource === 'estimated' ? 'Est. freshness' : item.expirySource === 'scanned' ? 'Scanned' : item.expirySource === 'entered' ? 'Entered' : 'Recorded'} · {new Date(item.expiryDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>;
    return null;
  };

  return (
    <>
      <motion.div
        className={`card card-hover stock-card ${item.state === 'low' ? 'glow-low' : ''} ${item.state === 'out' ? 'glow-out' : ''}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.035, 0.5), duration: 0.3 }}
        onClick={() => setEditing(true)}
        role="button" tabIndex={0}
      >
        <div className="row1">
          <div>
            <div className="stock-name">{item.name}</div>
            <div className="stock-cat">{item.category.replace('-', ' ')}{item.state !== 'ok' && <span style={{ marginLeft: 6, color: item.state === 'out' ? 'var(--red)' : 'var(--amber)', fontWeight: 700 }}>{item.state === 'out' ? 'OUT' : 'LOW'}</span>}</div>
          </div>
          {item.expiryState === 'expired' && item.expirySource !== 'estimated' && <span className="pulse-dot" />}
        </div>

        <div className="stock-qty">
          {item.qtyDisplay.split(' ')[0]} <small>{item.qtyDisplay.split(' ')[1] || item.unit}</small>
        </div>

        <div className="bar-wrap">
          <motion.div
            className={`bar-fill ${tone}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', damping: 22, stiffness: 120, delay: 0.1 + Math.min(index * 0.03, 0.4) }}
          />
          <div className="bar-marker" style={{ left: `${thrPct}%` }} title={`Threshold: ${item.thresholdDisplay}`} />
        </div>

        <div className="stock-foot">
          <div className="flex" style={{ gap: 6 }}>
            {expiryChip()}
            {item.state === 'out' && <span className="chip chip-bad">Order needed</span>}
          </div>
          <div className="qty-stepper" onClick={(e) => e.stopPropagation()}>
            <button className="qty-btn" disabled={busy} onClick={() => adjust(-step)} aria-label={`Use some ${item.name}`}><Icon name="minus" /></button>
            <button className="qty-btn" disabled={busy} onClick={() => adjust(step)} aria-label={`Add ${item.name}`}><Icon name="plus" /></button>
          </div>
        </div>
      </motion.div>

      <Modal open={editing} onClose={() => setEditing(false)} title={item.name}>
        <div className="grid-2">
          <div className="field">
            <label className="label">Quantity ({item.unit})</label>
            <input className="input" type="number" min="0" value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label className="label">Low-stock threshold</label>
            <input className="input" type="number" min="0" value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} />
          </div>
        </div>
        <div className="field">
          <label className="label">Expiry / freshness date</label>
          <input className="input" type="date" value={(form.expiryDate || '').slice(0, 10)}
            onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          <div className="tiny muted mt-1">{item.expirySource === 'estimated' ? 'Typical freshness estimate from category shelf life, not a verified expiry date. Check the package and edit if needed.' : item.expirySource === 'scanned' ? 'Read from a package photo and confirmed by you.' : item.expirySource === 'entered' ? 'Entered manually by you.' : 'Previously recorded date; its original source was not saved.'}</div>
        </div>
        <div className="flex-between mt-2">
          <button className="btn btn-danger" onClick={remove} disabled={busy}><Icon name="trash" /> Remove item</button>
          <div className="flex">
            <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>Save</button>
          </div>
        </div>
        <p className="tiny faint mt-2">
          Auto reminders fire 7 days before expiry. Threshold marker on the bar shows when you will be warned about low stock.
        </p>
      </Modal>
    </>
  );
}
