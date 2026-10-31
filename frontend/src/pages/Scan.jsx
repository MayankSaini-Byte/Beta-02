import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import api, { errMsg } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { isHousehold } from '../utils/accountType.js';
import Icon from '../components/Icon.jsx';

/* ================================================================== */
/* Shared bits                                                         */
/* ================================================================== */

function CaptureButton({ onFile, label, busy, accent }) {
  const ref = useRef(null);
  return (
    <>
      <button className={`btn ${accent ? 'btn-primary' : ''}`} onClick={() => ref.current && ref.current.click()} disabled={busy}>
        <Icon name="camera" /> {busy ? 'Reading…' : label}
      </button>
      {/* Plain file input - opens the rear camera on Android & iPhone, works without HTTPS */}
      <input
        ref={ref} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onFile(f); e.target.value = ''; }}
      />
    </>
  );
}

function ConfBar({ value }) {
  const has = Number.isFinite(Number(value)) && Number(value) > 0;
  const pct = Math.round((Number(value) || 0) * 100);
  const low = has && pct < 70;
  if (!has) return <span className="tiny muted">—</span>;
  return (
    <div style={{ minWidth: 90 }}>
      <div className="tiny muted" style={{ color: low ? 'var(--amber)' : undefined }}>{pct}% conf{low ? ' · check' : ''}</div>
      <div className="conf-bar mt-1"><div className="conf-fill" style={{ width: `${pct}%`, background: low ? 'var(--amber)' : 'var(--accent)' }} /></div>
    </div>
  );
}

function FailureCard({ message, hint, onRetake, onText, extra }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card mt-2" style={{ borderColor: 'var(--amber)' }}>
      <b style={{ color: 'var(--amber)' }}><Icon name="alert" size={13} /> Scan failed</b>
      <p className="small mt-1" style={{ marginBottom: hint ? 4 : 0 }}>{message}</p>
      {hint && <p className="tiny muted">{hint}</p>}
      <div className="flex wrap mt-2" style={{ gap: 8 }}>
        {onRetake && <button className="btn" onClick={onRetake}><Icon name="refresh" /> Retake photo</button>}
        {onText && <button className="btn" onClick={onText}><Icon name="receipt" /> Add items manually / paste text</button>}
        {extra}
      </div>
    </motion.div>
  );
}

/* ================================================================== */
/* 2) RECEIPT SCANNER - photo -> model -> review -> confirm -> stock    */
/* ================================================================== */

function ReceiptPanel() {
  const { toast } = useApp();
  const [imgPreview, setImgPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(null);   // {receiptId, engine, items, duplicate, message}
  const [failure, setFailure] = useState(null);
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState('');
  const [acc, setAcc] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(null);   // confirm summary

  useEffect(() => {
    api.get('/receipts/accuracy').then(({ data }) => setAcc(data)).catch(() => {});
  }, []);

  const review = (data) => {
    setScan(data);
    setFailure(null);
    if (data.duplicate) toast(data.message, 'warn', 'Duplicate receipt');
    else toast(`${(data.items || []).length} item(s) extracted - review and confirm`, 'ok', 'Receipt scanned');
  };

  const upload = async (file) => {
    setBusy(true);
    setScan(null);
    setFailure(null);
    setDone(null);
    setTextMode(false);
    setImgPreview(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append('receipt', file);
      const { data } = await api.post('/receipts/scan', fd);
      if (data.ok) review(data);
      else setFailure(data);
    } catch (e) {
      setFailure({ message: "Couldn't read this receipt. Retake, or add the items manually.", hint: errMsg(e) });
    }
    setBusy(false);
  };

  const scanText = async (raw) => {
    const t = String(raw || text).trim();
    if (!t) return toast('Paste the receipt text first', 'warn');
    setBusy(true);
    setScan(null);
    setFailure(null);
    try {
      const { data } = await api.post('/receipts/scan', { text: t });
      if (data.ok) review(data);
      else setFailure(data);
    } catch (e) { setFailure({ message: "Couldn't read this receipt text.", hint: errMsg(e) }); }
    setBusy(false);
  };

  const scanDemo = async () => {
    setBusy(true);
    setScan(null);
    setFailure(null);
    setTextMode(false);
    try {
      const { data } = await api.post('/receipts/demo', {});
      review({ ...data, message: data.message || 'Demo receipt - same pipeline as a photo.' });
    } catch (e) { toast(errMsg(e), 'err'); }
    setBusy(false);
  };

  const setItem = (i, patch) => setScan((s) => ({ ...s, items: s.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  const confirm = async () => {
    const chosen = (scan.items || []).filter((i) => i.checked !== false);
    if (!chosen.length) return toast('Tick at least one item', 'warn');
    setConfirming(true);
    try {
      const { data } = await api.post('/receipts/confirm', { receiptId: scan.receiptId, items: scan.items });
      setDone(data);
      setScan(null);
      setImgPreview(null);
      toast(data.message, 'ok', 'Stock updated');
    } catch (e) { toast(errMsg(e), 'err'); }
    setConfirming(false);
  };

  const lowCount = scan ? (scan.items || []).filter((i) => i.flag === 'low-confidence').length : 0;

  return (
    <div className="card scan-panel">
      <div className="flex-between wrap">
        <div>
          <h3 style={{ fontSize: 15 }}>Receipt scanner</h3>
          <p className="small muted mt-1" style={{ maxWidth: 640 }}>
        Flow: photograph the bill → KitchenSync reads the printed text locally → units are
            parsed ("500G", "1 LTR", "2 PCS") → lines are fuzzy-matched to your stock ("TOMATO LOCAL" joins "Tomato")
            → <b>you review</b> → Confirm adds to stock. The photo's SHA-256 hash is remembered, so scanning the same
            bill twice can never double your stock.
          </p>
        </div>
        {acc && <span className="chip chip-ok">Measured accuracy: {acc.correct}/{acc.tested} items + {acc.unitTests.passed}/{acc.unitTests.tested} unit checks</span>}
      </div>

      <div className="flex wrap mt-2" style={{ gap: 8 }}>
        <CaptureButton onFile={upload} label="Take a photo of the receipt" busy={busy} accent />
        <button className="btn" onClick={() => setTextMode(!textMode)}><Icon name="receipt" /> Paste text instead</button>
        <button className="btn" onClick={scanDemo} disabled={busy}><Icon name="sparkles" /> Demo receipt</button>
      </div>

      {textMode && (
        <div className="mt-2">
          <textarea className="input" rows={5} placeholder="Paste the OCR / receipt text here…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary mt-1" onClick={() => scanText()} disabled={busy}>Extract items</button>
        </div>
      )}

      {imgPreview && busy && (
        <div className="tc mt-2">
          <img src={imgPreview} alt="receipt" className="preview-img" style={{ maxHeight: 200, opacity: 0.6 }} />
          <div className="small muted mt-1">Reading the receipt locally with PaddleOCR…</div>
        </div>
      )}

      {failure && (
        <FailureCard
          message={failure.message}
          hint={failure.hint}
          onRetake={() => { setFailure(null); setImgPreview(null); }}
          onText={() => { setTextMode(true); setFailure(null); }}
        />
      )}

      {done && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card mt-2" style={{ borderColor: 'var(--accent)' }}>
          <b style={{ color: 'var(--accent)' }}><Icon name="check" size={13} /> {done.message}</b>
          <div className="mt-1">
            {done.items.map((it, i) => (
              <div key={i} className="small">· {it.name}: {it.display} {it.merged ? '(merged into existing stock)' : '(new item)'}{it.price ? ` · ₹${it.price}` : ''}</div>
            ))}
          </div>
        </motion.div>
      )}

      {scan && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="receipt-review mt-2">
          <div className="flex-between wrap mb-1">
            <b style={{ fontSize: 13.5 }}>
              Review - fix what's wrong, untick anything the scan got wrong
              {scan.duplicate && <span className="chip chip-warn" style={{ marginLeft: 8 }}>duplicate - stock not changed again</span>}
            </b>
            <span className="chip">engine: {scan.engine}</span>
          </div>
          {scan.receipt && <div className="small muted mb-1" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>{[['Store', scan.receipt.store], ['Date', scan.receipt.date], ['Subtotal', scan.receipt.subtotal], ['Tax', scan.receipt.tax], ['Discount', scan.receipt.discount], ['Total', scan.receipt.total_amount]].filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => <span key={label}><b>{label}:</b> {label === 'Store' || label === 'Date' ? value : `${scan.receipt.currency === 'INR' ? '₹' : scan.receipt.currency === 'USD' ? '$' : ''}${value}`}</span>)}</div>}
          {lowCount > 0 && <div className="tiny mb-1" style={{ color: 'var(--amber)' }}>{lowCount} low-confidence row(s) in amber - double-check those.</div>}
          <div className="table-wrap">
            <table>
              <thead><tr><th style={{ width: 30 }}></th><th>Item (as printed)</th><th>Matched stock</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 70 }}>Unit</th><th style={{ width: 80 }}>₹ Price</th><th style={{ width: 120 }}>Confidence</th></tr></thead>
              <tbody>
                {scan.items.map((it, i) => (
                  <tr key={i} style={{ background: it.flag === 'low-confidence' ? 'rgba(245, 158, 11, 0.07)' : undefined }}>
                    <td><input type="checkbox" checked={it.checked !== false} onChange={() => setItem(i, { checked: it.checked === false })} style={{ width: 16, height: 16 }} /></td>
                    <td>
                      <input className="input" style={{ padding: '4px 8px', fontSize: 12.5 }} value={it.raw_name} onChange={(e) => setItem(i, { raw_name: e.target.value, name: e.target.value })} />
                      {it.flag && <div className="tiny" style={{ color: 'var(--amber)' }}>{it.flag}</div>}
                    </td>
                    <td className="small">{it.matched_name ? <span className="chip chip-ok">{it.matched_name}</span> : it.key ? <span className="chip">{it.name}</span> : <span className="tiny muted">new item</span>}</td>
                    <td><input className="input" style={{ padding: '4px 8px', fontSize: 12.5 }} type="number" min="0" value={it.qty ?? ''} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} /></td>
                    <td>
                      <select className="select" style={{ padding: '4px 6px', fontSize: 12.5 }} value={it.unit || 'g'} onChange={(e) => setItem(i, { unit: e.target.value })}>
                        <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">L</option><option value="pc">pc</option>
                      </select>
                    </td>
                    <td><input className="input" style={{ padding: '4px 8px', fontSize: 12.5 }} type="number" min="0" value={it.price ?? ''} onChange={(e) => setItem(i, { price: Number(e.target.value) })} /></td>
                    <td><ConfBar value={it.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary mt-2" onClick={confirm} disabled={confirming}>
            <Icon name="check" /> {confirming ? 'Adding…' : `Confirm - add ${scan.items.filter((i) => i.checked !== false).length} item(s) to stock`}
          </button>
        </motion.div>
      )}

      {!scan && !busy && !failure && (
        <div className="small muted mt-2" style={{ lineHeight: 1.8 }}>
          <b style={{ color: 'var(--text)' }}>If a scan misses something:</b> when the photo is blurry or
          nothing is detected, you'll see "Couldn't read this receipt" - retake, paste the text, or add items manually.
          It never crashes and never invents items.
        </div>
      )}
    </div>
  );
}

/* ================================================================== */

export default function Scan() {
  const { user } = useApp();
  return (
    <div>
      {isHousehold(user) && <div className="premium-feature-banner"><span className="premium-feature-mark"><Icon name="sparkles" /></span><span><b>Premium feature</b><small>Scan & Detect brings receipt scanning to your household.</small></span><span className="premium-pill">PREMIUM</span></div>}
      <ReceiptPanel />
    </div>
  );
}
