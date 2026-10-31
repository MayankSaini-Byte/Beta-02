import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Cell } from 'recharts';
import api, { inr } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';

const ICONS = ['activity', 'plus', 'cooking', 'truck', 'scale', 'cart', 'camera', 'users', 'chip', 'receipt', 'book'];

export default function Analytics() {
  const { toast } = useApp();
  const [sum, setSum] = useState(null);
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/analytics/summary'), api.get('/analytics/activity')])
      .then(([a, b]) => { setSum(a.data); setActivity(b.data.activity); })
      .catch(() => toast('Could not load insights', 'err'));
  }, []);

  if (!sum) return <div className="skeleton" style={{ height: 320 }} />;

  const catData = sum.categoryValue.map((c) => ({ name: c.category.replace('-', ' '), value: Math.round(c.value), count: c.count }));
  const COLORS = ['var(--accent)', 'var(--terra)', 'var(--mustard)', 'var(--plum)', '#7fc8a9', '#d97757', '#b5a642'];

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><Icon name="box" /><div><b style={{ fontSize: 20 }}>{sum.counts.total}</b><div className="small muted">items tracked</div></div></div>
        <div className="stat-card"><Icon name="budget" /><div><b style={{ fontSize: 20 }}>{inr(sum.estValue)}</b><div className="small muted">kitchen value (est.)</div></div></div>
        <div className="stat-card"><Icon name="scale" /><div><b style={{ fontSize: 20 }}>{sum.accuracy != null ? `${sum.accuracy}%` : '—'}</b><div className="small muted">stock accuracy</div></div></div>
        <div className="stat-card"><Icon name="alert" /><div><b style={{ fontSize: 20 }}>{inr(sum.wastage.wastedValue)}</b><div className="small muted">money wasted</div></div></div>
      </div>

      <div className="grid-2 mt-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 }}>
        {/* Stock by category (₹ value) */}
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 16 }}>Stock by category</h2>
          <div className="sub small muted mb-2">Estimated rupee value of what is in your kitchen right now</div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={catData} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--faint)" fontSize={10} interval={0} angle={-24} textAnchor="end" height={54} />
                <YAxis stroke="var(--faint)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }} formatter={(v, n, p) => [`${inr(v)} · ${p.payload.count} items`, 'value']} />
                <Bar dataKey="value" radius={[7, 7, 0, 0]}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Accuracy over time */}
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 16 }}>Stock accuracy over time</h2>
          <div className="sub small muted mb-2">From physical reconciliations - count your shelf and the app corrects itself</div>
          {sum.accuracyHistory && sum.accuracyHistory.length > 0 ? (
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={sum.accuracyHistory} margin={{ top: 8, right: 10, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="at" stroke="var(--faint)" fontSize={10} tickFormatter={(t) => String(t).slice(5, 10)} />
                  <YAxis domain={[70, 100]} stroke="var(--faint)" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }} formatter={(v) => [`${v}%`, 'accuracy']} />
                  <Line type="monotone" dataKey="accuracy" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--accent)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="small muted">No reconciliation yet - open Scan → Reconcile to count your shelf.</div>
          )}
          {sum.lastReconcile && (
            <div className="small muted mt-2">Last count: {new Date(sum.lastReconcile.at).toLocaleString('en-IN')} · accuracy {sum.lastReconcile.accuracy}%</div>
          )}
        </div>

        {/* Spend trend */}
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 16 }}>Grocery spend trend</h2>
          <div className="sub small muted mb-2">Weekly estimated spend <span className="chip" style={{ fontSize: 10 }}>simulated until real orders build up</span></div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={sum.spendTrend} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" stroke="var(--faint)" fontSize={11} />
                <YAxis stroke="var(--faint)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }} formatter={(v) => [inr(v), 'spend']} />
                <Bar dataKey="spend" radius={[7, 7, 0, 0]} fill="var(--accent)" opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Wastage watch */}
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 16 }}>Wastage watch</h2>
          <div className="sub small muted mb-2">{sum.wastage.note}</div>
          <div className="weight-now" style={{ color: 'var(--terra)' }}>{inr(sum.wastage.wastedValue)}</div>
          <div className="small muted">expired right now: <b style={{ color: 'var(--text)' }}>{sum.wastage.expiredNow}</b> · removed in last 30d: <b style={{ color: 'var(--text)' }}>{sum.wastage.removedLast30d}</b></div>
          {sum.topDepleted.length > 0 && (
            <>
              <div className="meal-slot mt-2">most consumed</div>
              {sum.topDepleted.slice(0, 5).map((d) => (
                <div key={d.name} className="flex" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed var(--border)', fontSize: 12.5 }}>
                  <span>{d.name}</span><b>{Math.round(d.total)} {/^\d+$/.test(String(d.total)) ? '' : ''}</b>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Activity log */}
      <div className="card mt-3" style={{ padding: 16 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Activity log</h2>
            <div className="sub">Who added, used or changed what, and when - the flatmates trail</div>
          </div>
        </div>
        {!activity || activity.length === 0 ? (
          <div className="small muted">Nothing yet - add, cook or buy something and it shows up here.</div>
        ) : (
          <div className="act-feed stagger">
            {activity.slice(0, 18).map((a) => (
              <div key={a.id} className="act-row">
                <div className="act-icon"><Icon name={ICONS.includes(a.icon) ? a.icon : 'activity'} size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div><span className="act-actor">{a.actor}</span> <span className="small muted">{a.action}</span> <b style={{ fontSize: 13 }}>{a.target}</b></div>
                  {a.detail && <div className="small muted" style={{ marginTop: 2 }}>{a.detail}</div>}
                </div>
                <span className="act-when">{new Date(a.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
