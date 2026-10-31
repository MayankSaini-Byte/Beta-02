import { useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';

function phoneDigits(value) { return String(value || '').replace(/\D/g, ''); }

export default function VendorRestocking() {
  const { user, toast } = useApp();
  const [vendors, setVendors] = useState([]);
  const [list, setList] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({ name: '', phone: user?.businessProfile?.vendorContact || '', notes: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [vendorResponse, listResponse] = await Promise.all([api.get('/vendors'), api.get('/shopping/list')]);
    setVendors(vendorResponse.data.vendors || []);
    setList(listResponse.data);
  };
  useEffect(() => { load().catch(() => toast('Could not load vendor restocking', 'err')); }, []);

  useEffect(() => {
    if (!selectedId && vendors.length) setSelectedId(vendors[0]._id);
  }, [vendors, selectedId]);

  const restockItems = useMemo(() => {
    if (!list) return [];
    const rows = [
      ...(list.auto || []).map((item) => ({ ...item, quantity: item.buyDisplay || `${item.toBuy || item.qty} ${item.unit || ''}`, reason: item.reason })),
      ...(list.saved || []).filter((item) => !item.boughtAt).map((item) => ({ ...item, quantity: item.buyDisplay || `${item.toBuy || item.qty || 1} ${item.unit || 'pc'}` }))
    ];
    const unique = new Map();
    rows.forEach((item) => {
      const key = item.key || String(item.name).toLowerCase();
      if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()];
  }, [list]);

  const addVendor = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/vendors', form);
      setVendors((current) => [...current, data.vendor]);
      setSelectedId(data.vendor._id);
      setForm({ name: '', phone: '', notes: '' });
      toast('Vendor saved', 'ok');
    } catch (error) { toast(error.response?.data?.error || 'Could not save vendor', 'err'); }
    finally { setBusy(false); }
  };

  const removeVendor = async (vendor) => {
    try {
      await api.delete(`/vendors/${vendor._id}`);
      const next = vendors.filter((item) => item._id !== vendor._id);
      setVendors(next);
      if (selectedId === vendor._id) setSelectedId(next[0]?._id || '');
      toast(`${vendor.name} removed`, 'ok');
    } catch (error) { toast(error.response?.data?.error || 'Could not remove vendor', 'err'); }
  };

  const openWhatsApp = () => {
    const vendor = vendors.find((item) => item._id === selectedId);
    if (!vendor) return toast('Save or select a vendor first', 'warn');
    const digits = phoneDigits(vendor.phone);
    const number = digits.length === 10 ? `91${digits}` : digits;
    if (number.length < 7) return toast('Add the vendor’s phone number with country code', 'warn');
    if (!restockItems.length) return toast('Your restocking list is empty', 'warn');
    const outlet = user?.businessProfile?.outletName || user?.name || 'KitchenSync outlet';
    const lines = restockItems.map((item, index) => `${index + 1}. ${item.name} — ${item.quantity}${item.reason ? ` (${item.reason})` : ''}`);
    const message = `Hi ${vendor.name}, please restock these items for ${outlet}:\n\n${lines.join('\n')}\n\nPlease confirm availability and delivery time. Thank you.`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="vendor-page">
      <section className="vendor-hero">
        <div><div className="eyebrow">SUPPLIER WORKFLOW</div><h2>Vendor Restocking</h2><p>Turn low stock and saved shopping items into a clear WhatsApp restock request.</p></div>
        <span className="vendor-icon"><Icon name="whatsapp" size={23} /></span>
      </section>

      <div className="vendor-grid">
        <section className="card vendor-main-card">
          <div className="section-head"><div><h3>Restock list</h3><p className="sub">Low-stock inventory and active shopping items are merged, with duplicates removed.</p></div><span className="chip">{restockItems.length} items</span></div>
          {restockItems.length ? <div className="vendor-restock-list">{restockItems.map((item) => <div className="vendor-restock-row" key={item.key || item.id || item.name}><span className="vendor-item-dot"><Icon name="box" size={15} /></span><span className="vendor-item-name"><b>{item.name}</b><small>{item.reason || item.category || 'Requested item'}</small></span><span className="vendor-item-qty">{item.quantity}</span></div>)}</div> : <div className="vendor-empty"><Icon name="check" /><b>Nothing to restock right now</b><span>Add items from Shopping or wait for stock alerts.</span></div>}
          <button className="btn btn-primary vendor-send-button" onClick={openWhatsApp} disabled={!restockItems.length || !vendors.length}><Icon name="whatsapp" /> Prepare WhatsApp message</button>
          <p className="tiny muted">WhatsApp opens with the message prefilled. Review the quantities and tap Send in WhatsApp.</p>
        </section>

        <section className="card vendor-side-card">
          <div className="section-head"><div><h3>Vendors</h3><p className="sub">Save supplier name and WhatsApp number.</p></div></div>
          {vendors.length > 0 && <div className="vendor-select-list">{vendors.map((vendor) => <div className={`vendor-select-row ${selectedId === vendor._id ? 'selected' : ''}`} key={vendor._id}><label><input type="radio" name="vendor" checked={selectedId === vendor._id} onChange={() => setSelectedId(vendor._id)} /><span><b>{vendor.name}</b><small>{vendor.phone}</small></span></label><button className="btn btn-ghost btn-icon" aria-label={`Delete ${vendor.name}`} onClick={() => removeVendor(vendor)}><Icon name="trash" size={14} /></button></div>)}</div>}
          <form className="vendor-form" onSubmit={addVendor}>
            <label className="field"><span className="label">Vendor / supplier name</span><input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Fresh produce supplier" /></label>
            <label className="field"><span className="label">WhatsApp number</span><input className="input" type="tel" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+91 98765 43210" /></label>
            <button className="btn" disabled={busy}><Icon name="plus" /> {busy ? 'Saving…' : 'Save vendor'}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
