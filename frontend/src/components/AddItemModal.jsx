import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import api, { errMsg } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';

export default function AddItemModal({ open, onClose, onAdded }) {
  const { toast } = useApp();
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState({ name: '', quantity: 1, unit: 'g', threshold: '', expiryDate: '', purchaseDate: new Date().toISOString().slice(0, 10), storage: 'fridge', shelfLifeDays: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && catalog.length === 0) {
      api.get('/pantry/catalog').then(({ data }) => setCatalog(data.catalog)).catch(() => {});
    }
  }, [open, catalog.length]);

  const selected = useMemo(() => catalog.find((c) => c.name.toLowerCase() === form.name.trim().toLowerCase()), [catalog, form.name]);

  useEffect(() => {
    if (selected) {
      setForm((f) => ({
        ...f,
        unit: selected.unit,
        quantity: selected.unit === 'g' || selected.unit === 'ml' ? 1000 : 1,
        threshold: selected.unit === 'g' || selected.unit === 'ml' ? 250 : 1
      }));
    }
  }, [selected]);

  const submit = async () => {
    if (!form.name.trim()) return toast('Item name is required', 'warn');
    setBusy(true);
    try {
      const { data } = await api.post('/pantry', {
        name: form.name.trim(),
        quantity: Number(form.quantity) || 0,
        unit: form.unit,
        threshold: form.threshold === '' ? undefined : Number(form.threshold),
        expiryDate: form.expiryDate || undefined,
        purchaseDate: form.purchaseDate || undefined,
        storage: form.storage,
        shelfLifeDays: form.shelfLifeDays ? Number(form.shelfLifeDays) : undefined,
        mode: 'add'
      });
      onAdded(data.item, data.merged);
      toast(data.merged ? `${data.item.name} restocked (+${form.quantity} ${form.unit})` : `${data.item.name} added to kitchen stock`);
      setForm({ name: '', quantity: 1, unit: 'g', threshold: '', expiryDate: '', purchaseDate: new Date().toISOString().slice(0, 10), storage: 'fridge', shelfLifeDays: '' });
      onClose();
    } catch (e) { toast(errMsg(e), 'err'); }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add to kitchen stock">
      <div className="field">
        <label className="label">Item name</label>
        <input
          className="input" list="catalog-names" placeholder="Try: paneer, aloo, toor dal, milk..."
          value={form.name} autoFocus
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <datalist id="catalog-names">
          {catalog.map((c) => <option key={c.key} value={c.name} />)}
        </datalist>
        {selected && <p className="tiny faint mt-1">Matched catalog item: {selected.name} - price approx Rs {selected.price}/{selected.unit === 'g' ? 'kg' : selected.unit === 'ml' ? 'L' : 'pc'}</p>}
      </div>
      <div className="field-row">
        <div className="field">
          <label className="label">Quantity</label>
          <input className="input" type="number" min="0" value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        <div className="field">
          <label className="label">Unit</label>
          <select className="select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option value="g">grams (g)</option>
            <option value="ml">millilitre (ml)</option>
            <option value="pc">pieces (pc)</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="label">Purchase date</label>
          <input className="input" type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
        </div>
        <div className="field">
          <label className="label">Typical shelf life (days)</label>
          <input className="input" type="number" min="1" max="3650" placeholder={selected?.shelfLifeDays || 'Auto'} value={form.shelfLifeDays} onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label className="label">Storage mode</label>
        <select className="select" value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })}>
          <option value="room">Room temperature</option><option value="fridge">Refrigerator</option><option value="freezer">Freezer</option>
        </select>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="label">Low threshold (alert below)</label>
          <input className="input" type="number" min="0" placeholder="auto" value={form.threshold}
            onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
        </div>
        <div className="field">
          <label className="label">Expiry (optional)</label>
          <input className="input" type="date" value={form.expiryDate}
            onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
        </div>
      </div>
      <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
        Add to stock
      </button>
      <p className="tiny faint mt-1 tc">Existing items are restocked automatically (quantity adds up).</p>
    </Modal>
  );
}
