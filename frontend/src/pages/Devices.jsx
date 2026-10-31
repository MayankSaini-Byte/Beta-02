import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';

function timeAgo(iso) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function TelemetryChart({ title, data, dataKey, unit, color }) {
  const points = data.filter((row) => row[dataKey] !== null && row[dataKey] !== undefined && Number.isFinite(Number(row[dataKey])));
  return (
    <section className="device-telemetry-chart">
      <b>{title}</b>
      {points.length ? <div className="device-chart-canvas">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="t" stroke="var(--faint)" fontSize={10} minTickGap={26} />
            <YAxis stroke="var(--faint)" fontSize={10} width={45} tickFormatter={(value) => dataKey === 'grams' ? `${Math.round(value)}g` : `${value}${unit}`} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }} formatter={(value) => [`${value} ${unit}`, title]} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.25} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div> : <div className="device-chart-empty">No {title.toLowerCase()} readings have been received for this sensor yet.</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Load-cell weighing station (real hardware: ESP32 + HX711)            */
/* The server keeps the latest reading POSTed by the ESP32; the browser */
/* only reads it, so the value applied to stock can't be faked or stale. */
/* ------------------------------------------------------------------ */
function WeighStation({ pantryItems, devices, toast }) {
  const [live, setLive] = useState(null);        // {grams, stable, online, ts}
  const [sensorId, setSensorId] = useState('scale1');
  const [itemId, setItemId] = useState('');
  const [mode, setMode] = useState('set');       // set | add
  const [containerWeight, setContainerWeight] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [reweigh, setReweigh] = useState(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const { data } = await api.get(`/scale/latest?device_id=${encodeURIComponent(sensorId)}`);
        if (!stop) setLive(data);
        if (!stop && itemId) {
          try {
            const { data: rw } = await api.get(`/scale/reweigh/${itemId}?device_id=${encodeURIComponent(sensorId)}`);
            if (!stop) setReweigh(rw);
          } catch { /* item deleted etc. */ }
        }
      } catch { /* offline */ }
    };
    tick();
    const iv = setInterval(tick, 1500);
    return () => { stop = true; clearInterval(iv); };
  }, [itemId, sensorId]);

  const simulate = async () => {
    setBusy('sim');
    try {
      const { data } = await api.post('/scale/simulate', { itemId: itemId || undefined, containerWeight: Number(containerWeight) || 0 });
      toast(data.message, 'ok', 'Simulated sensor');
    } catch (e) { toast(e.response?.data?.error || 'Simulate failed', 'err'); }
    setBusy('');
  };

  const weigh = async () => {
    setBusy('weigh');
    try {
      const { data } = await api.post(`/scale/stock/${itemId}/weigh`, { mode, deviceId: sensorId, containerWeight: Number(containerWeight) || 0 });
      setResult(data);
      toast(data.message, 'ok', 'Weighed into stock');
    } catch (e) { toast(e.response?.data?.error || 'Weigh failed', 'err', 'Rejected'); }
    setBusy('');
  };

  const canWeigh = live && live.online && live.stable && !!itemId;
  const selected = pantryItems.find((p) => p._id === itemId);
  const pairedSensors = devices.filter((device) => device.source === 'physical' && device.hardwareId);

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14, borderColor: 'var(--accent-deep)' }}>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 16 }}>Load-cell weighing station <span className={`chip ${live?.source === 'physical' ? 'chip-ok' : 'chip-warn'}`} style={{ marginLeft: 6 }}>{live?.source === 'physical' ? 'physical ESP32' : 'simulator'}</span></h2>
          <div className="sub">Authenticated readings arrive through <code>/api/scale/reading</code>. The server applies its latest fresh, stable reading; the browser cannot submit a weight value.</div>
        </div>
        <span className={`status-pill status-${live && live.online ? 'online' : 'stale'}`}>
          <span className="pulse-dot" style={{ width: 6, height: 6, background: live && live.online ? 'var(--accent)' : 'var(--amber)', animation: live && live.online ? undefined : 'none' }} />
          {live && live.online ? 'scale online' : 'scale offline'}
        </span>
      </div>

      <div className="device-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="plan-day">
          <label className="field"><span className="label">Sensor input</span>
            <select className="select" value={sensorId} onChange={(event) => {
              const nextId = event.target.value;
              setSensorId(nextId);
              const nextSensor = devices.find((device) => device.hardwareId === nextId);
              setContainerWeight(String(nextSensor?.tareGrams || 0));
            }}>
              {!pairedSensors.some((device) => device.hardwareId === 'scale1') && <option value="scale1">Legacy station / simulator</option>}
              {pairedSensors.map((device) => <option key={device.id} value={device.hardwareId}>{device.name} · {device.hardwareId}</option>)}
            </select>
          </label>
          <div className="tiny muted mt-2">Live gross weight</div>
          <div className="weight-now">{live && live.grams != null ? `${live.grams} g` : '—'}</div>
          {live?.grams != null && <div className="tiny muted">Net after saved tare: {live.netGrams} g · {(Number(live.netGrams || 0) / 1000).toFixed(2)} kg</div>}
          <div className={`chip ${live && live.stable ? 'chip-ok' : 'chip-warn'}`}>
            {live && live.stable ? 'Stable ✅' : 'Settling…'}
          </div>
          <div className="tiny muted mt-1">
            {live ? `${live.readings || 0} readings accepted · ${live.rejected || 0} rejected` : 'waiting for the first reading…'}
          </div>
          <div className="sensor-current-environment">
            <span><b>{live?.temperatureC == null ? '—' : `${live.temperatureC}°C`}</b><small>Temperature</small></span>
            <span><b>{live?.humidityPercent == null ? '—' : `${live.humidityPercent}%`}</b><small>Humidity</small></span>
          </div>
          {live?.timestamp && <div className="tiny muted mt-1">Last reading {timeAgo(live.timestamp)}</div>}
        </div>

        <div className="plan-day" style={{ gridColumn: 'span 2' }}>
          <div className="field">
            <label className="label">Stock item to weigh</label>
            <select className="select" value={itemId} onChange={(e) => { setItemId(e.target.value); setResult(null); }}>
              <option value="">Choose an item…</option>
              {pantryItems.map((p) => <option key={p._id} value={p._id}>{p.name} · now {p.qtyDisplay}</option>)}
            </select>
          </div>
          <div className="field-row mt-1">
            <div className="field" style={{ flex: 1 }}>
              <label className="label">Container weight (tare), g</label>
              <div className="flex" style={{ gap: 6 }}>
                <input className="input" type="number" min="0" placeholder="0" value={containerWeight} onChange={(e) => setContainerWeight(e.target.value)} />
                <button className="btn btn-sm" title="Set tare = current reading" onClick={() => live && live.grams != null && setContainerWeight(String(live.grams))} disabled={!live || !live.online}>Tare</button>
              </div>
            </div>
            <div className="field">
              <label className="label">Mode</label>
              <div className="flex" style={{ gap: 6 }}>
                <button className={`btn btn-sm ${mode === 'set' ? 'btn-primary' : ''}`} onClick={() => setMode('set')}>Set total</button>
                <button className={`btn btn-sm ${mode === 'add' ? 'btn-primary' : ''}`} onClick={() => setMode('add')}>Add to existing</button>
              </div>
            </div>
          </div>
          <div className="flex wrap mt-1" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={weigh} disabled={!canWeigh || busy === 'weigh'}>
              <Icon name="scale" size={13} /> {busy === 'weigh' ? 'Weighing…' : 'Add weight to stock'}
            </button>
            <button className="btn" onClick={simulate} disabled={busy === 'sim' || sensorId !== 'scale1' || live?.source === 'physical'} title="Demo fallback when no physical sensor is selected">
              <Icon name="refresh" size={13} /> Simulate sensor
            </button>
            {!live?.online && <span className="tiny muted" style={{ alignSelf: 'center' }}>Waiting for the ESP32 - press Simulate sensor for the demo.</span>}
          </div>
          {result && (
            <div className="small mt-1" style={{ color: 'var(--accent)' }}>
              <b>{result.item.name}: {result.item.quantity} {result.item.unit}</b> · scale read {result.applied.scaleGrams} g − container {result.applied.containerWeight} g = {result.applied.netGrams} g ({result.applied.mode})
            </div>
          )}
        </div>
      </div>

      {reweigh && selected && (
        <div className="swap-hint mt-2">
          <b>Post-cook check:</b> expected {Math.round(reweigh.appGrams)} {reweigh.unit === 'pc' ? 'pc' : 'g'} in app,
          measured {reweigh.scaleGrams != null ? `${reweigh.scaleGrams} g` : '— (scale offline)'}
          {reweigh.diffGrams != null && <> · diff <b style={{ color: Math.abs(reweigh.diffGrams) > 50 ? 'var(--amber)' : 'var(--accent)' }}>{reweigh.diffGrams > 0 ? '+' : ''}{reweigh.diffGrams} g</b></>}
          {reweigh.lastDeduction && <> · last meal deduction: {Math.round(reweigh.lastDeduction.delta)} {reweigh.lastDeduction.unit} ({new Date(reweigh.lastDeduction.at).toLocaleDateString('en-IN')})</>}
        </div>
      )}

      <div className="tiny muted mt-2">
        Guards: reading older than 3 s → “Scale offline” · unstable → “Weight not stable yet” · net &lt; 0 → rejected ·
        nonsense values (e.g. −999 g) are rejected server-side and counted, never applied.
      </div>
    </div>
  );
}

export default function Devices() {
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null); // {id, name, series}
  const [busy, setBusy] = useState('');
  const [linkFor, setLinkFor] = useState(null);
  const [pantryItems, setPantryItems] = useState([]);
  const [newName, setNewName] = useState('');
  const [newHardwareId, setNewHardwareId] = useState('');

  const load = async () => {
    const { data } = await api.get('/devices');
    setData(data);
  };
  useEffect(() => {
    let active = true;
    const refresh = () => api.get('/devices').then(({ data }) => { if (active) setData(data); }).catch(() => {});
    refresh().catch(() => toast('Could not load devices', 'err'));
    const interval = setInterval(refresh, 2000);
    api.get('/pantry').then(({ data }) => setPantryItems(data.items)).catch(() => {});
    return () => { active = false; clearInterval(interval); };
  }, [toast]);

  const simulate = async (id, mode) => {
    setBusy(id + mode);
    try {
      const { data } = await api.post(`/devices/${id}/simulate`, { mode });
      if (data.flagged) toast(data.message, 'warn', 'Rejected');
      else toast(data.message, 'ok', 'Sensor ping');
      await load();
    } catch (e) { toast(e.response?.data?.error || 'Simulate failed', 'err'); }
    setBusy('');
  };

  const tare = async (id) => {
    setBusy(id + 'tare');
    try {
      const { data } = await api.post(`/devices/${id}/tare`);
      toast(data.message, 'ok', 'Calibrated');
      await load();
    } catch (e) { toast(e.response?.data?.error || 'Tare failed', 'err'); }
    setBusy('');
  };

  const showHistory = async (id, name) => {
    setBusy(id + 'hist');
    try {
      const { data } = await api.get(`/devices/${id}/history`);
      setHistory({ id, name, source: data.source, series: data.series.map((s) => ({ ...s, t: new Date(s.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) })) });
    } catch { toast('Could not load history', 'err'); }
    setBusy('');
  };

  const createDevice = async () => {
    if (!newName.trim()) return;
    try {
      const { data } = await api.post('/devices', { name: newName.trim(), hardwareId: newHardwareId.trim() || undefined });
      setNewName('');
      setNewHardwareId('');
      toast(data.source === 'physical' ? 'Paired. Set the same Device ID in the ESP32 firmware.' : 'Storage point added with simulator readings.', 'ok', 'Storage added');
      await load();
    } catch (e) { toast(e.response?.data?.error || 'Could not pair', 'err'); }
  };

  const link = async (deviceId, pantryItemId) => {
    try {
      await api.post(`/devices/${deviceId}/link`, { pantryItemId });
      toast('Sensor linked - stock now tracks this storage point', 'ok');
      setLinkFor(null);
      load();
    } catch (e) { toast(e.response?.data?.error || 'Link failed', 'err'); }
  };

  const resolve = async (deviceId, use) => {
    try {
      const { data } = await api.post(`/devices/conflicts/${deviceId}/resolve`, { use });
      toast(data.message, 'ok', 'Conflict resolved');
      load();
    } catch (e) { toast(e.response?.data?.error || 'Resolve failed', 'err'); }
  };

  if (!data) return <div className="skeleton" style={{ height: 320 }} />;

  return (
    <div>
      <WeighStation pantryItems={pantryItems} devices={data.devices} toast={toast} />

      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, borderLeft: '3px solid var(--plum)' }}>
        <div className="small muted"><b style={{ color: 'var(--text)' }}>Live storage monitoring.</b> Pair a physical ESP32 by its Device ID, or leave the ID blank to use the simulator. Readings never change stock until you choose a weighing action.</div>
      </div>

      {data.conflicts.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Sensor vs app - which is right?</h2>
          <div className="stagger">
            {data.conflicts.map((c) => (
              <div key={c.deviceId} className="conflict-card" style={{ marginBottom: 8 }}>
                <div className="flex wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <b>{c.deviceName}</b> <span className="small muted">→ {c.itemName}</span>
                    <div className="small mt-1">Sensor: <b>{c.sensorDisplay}</b> vs app: <b>{c.appDisplay}</b> <span className="chip chip-warn" style={{ marginLeft: 6 }}>{c.diffG > 0 ? '+' : ''}{c.diffG} g</span></div>
                  </div>
                  <div className="flex" style={{ gap: 8 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => resolve(c.deviceId, 'sensor')}>Trust sensor</button>
                    <button className="btn btn-sm" onClick={() => resolve(c.deviceId, 'app')}>Keep app</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="device-pair-form card mb-2">
        <label className="field"><span className="label">Storage point name</span><input className="input" placeholder="e.g. Rice container" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createDevice()} /></label>
        <label className="field"><span className="label">Physical Device ID <em>Optional · leave blank for simulator</em></span><input className="input" placeholder="Must match DEVICE_ID in firmware" value={newHardwareId} onChange={(e) => setNewHardwareId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createDevice()} /></label>
        <button className="btn btn-primary" onClick={createDevice}><Icon name="chip" /> Add storage point</button>
      </div>

      <div className="device-grid stagger">
        {data.devices.map((d) => (
          <div key={d.id} className="card device-card">
            <div className="device-head">
              <div>
                <b style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{d.name}</b>
                <div className="small muted mt-1">
                  <Icon name="wifi" size={11} /> {d.wifi} · last seen {timeAgo(d.lastSeen)}
                </div>
              </div>
              <span className={`status-pill status-${d.status}`}>
                <span className="pulse-dot" style={{ width: 6, height: 6, background: d.status === 'online' ? 'var(--accent)' : d.status === 'stale' ? 'var(--amber)' : 'var(--faint)', animation: d.status === 'online' ? undefined : 'none' }} />
                {d.status}
              </span>
            </div>

            <div className="device-source-line"><span className={`chip ${d.source === 'physical' ? 'chip-ok' : ''}`}>{d.source === 'physical' ? 'PHYSICAL ESP32' : 'SIMULATOR'}</span>{d.hardwareId && <code>{d.hardwareId}</code>}</div>
            <div className="weight-now">{(d.source === 'physical' ? d.netGrams : d.grams) != null ? `${d.source === 'physical' ? d.netGrams : d.grams} g` : '—'}</div>
            <div className="device-environment-row">
              <span><Icon name="thermometer" size={13} /><b>{d.temperatureC == null ? '—' : `${d.temperatureC}°C`}</b><small>Temperature</small></span>
              <span><Icon name="droplet" size={13} /><b>{d.humidityPercent == null ? '—' : `${d.humidityPercent}%`}</b><small>Humidity</small></span>
              <span><Icon name="scale" size={13} /><b>{d.stable ? 'Stable' : 'Unstable'}</b><small>Weight</small></span>
            </div>
            <div className="tiny muted">Last reading: {timeAgo(d.lastReadingAt || d.lastSeen)}{d.tareGrams ? ` · tare ${d.tareGrams} g` : ''}</div>
            {d.linkedItem ? (
              <div className="small muted">linked: <b style={{ color: 'var(--text)' }}>{d.linkedItem.name}</b> · app says {Math.round(d.linkedItem.appQty)} {d.linkedItem.unit} ({d.linkedItem.state})</div>
            ) : (
              <div className="small muted">not linked - <button className="link-btn" onClick={() => setLinkFor(linkFor === d.id ? null : d.id)}>link a stock item</button></div>
            )}

            {linkFor === d.id && (
              <select className="input mt-2" style={{ width: '100%' }} value="" onChange={(e) => e.target.value && link(d.id, e.target.value)}>
                <option value="">Choose a stock item…</option>
                {pantryItems.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            )}

            <div className="mt-2">
              <div className="flex" style={{ justifyContent: 'space-between', fontSize: 11.5 }}>
                <span className="muted"><Icon name="battery" size={12} /> battery</span>
                <span className="muted">{d.battery}%</span>
              </div>
              <div className="batt-track mt-1"><div className={`batt-fill ${d.battery < 25 ? 'lowb' : ''}`} style={{ width: `${d.battery}%` }} /></div>
            </div>

            <div className="flex wrap mt-2" style={{ gap: 7 }}>
              {d.source !== 'physical' && <>
                <button className="btn btn-sm" onClick={() => simulate(d.id, 'drift')} disabled={busy === d.id + 'drift'}><Icon name="refresh" size={12} /> Simulate</button>
                <button className="btn btn-sm" onClick={() => simulate(d.id, 'refill')} disabled={busy === d.id + 'refill'}>Refill</button>
              </>}
              <button className="btn btn-sm" onClick={() => tare(d.id)} disabled={busy === d.id + 'tare'}><Icon name="scale" size={12} /> Tare</button>
              <button className="btn btn-sm" onClick={() => showHistory(d.id, d.name)} disabled={busy === d.id + 'hist'}><Icon name="analytics" size={12} /> Chart</button>
            </div>
          </div>
        ))}
      </div>

      {history && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card mt-3" style={{ padding: 16 }}>
          <div className="section-head" style={{ marginBottom: 8 }}>
            <div><h2 style={{ fontSize: 16 }}>Sensor history · {history.name}</h2><div className="small muted">{history.source === 'physical' ? 'Recorded ESP32 readings' : 'Simulator weight history; environmental readings are unavailable'}</div></div>
            <button className="btn btn-ghost btn-icon" onClick={() => setHistory(null)}><Icon name="x" /></button>
          </div>
          <div className="device-telemetry-history-grid">
            <TelemetryChart title="Weight" data={history.series} dataKey="grams" unit="g" color="var(--accent)" />
            <TelemetryChart title="Temperature" data={history.series} dataKey="temperatureC" unit="°C" color="var(--amber)" />
            <TelemetryChart title="Humidity" data={history.series} dataKey="humidityPercent" unit="% RH" color="var(--plum)" />
          </div>
        </motion.div>
      )}

      <div className="card mt-3" style={{ padding: 16 }}>
        <b style={{ fontFamily: 'var(--font-display)' }}>Expected vs measured accuracy</b>
        <div className="small muted mt-1">
          Every sensor update is audited: when a meal is marked done, the recipe's expected deduction is compared with the weight drop the sensor saw.
          See <Link to="/analytics">Insights → accuracy</Link> for the numbers, and the audit trail in <Link to="/analytics">activity</Link>.
        </div>
      </div>
    </div>
  );
}
