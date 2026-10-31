import { useState } from 'react';
import { motion } from 'framer-motion';
import { inr } from '../api/client.js';
import Icon from './Icon.jsx';

/**
 * Renders a full price comparison: per-store basket cards + per-item quotes table.
 * data = { perItem, baskets, bestProvider, savings, simulated }
 */
export default function PriceTable({ data, onAddCart, busyProvider }) {
  const [expanded, setExpanded] = useState(false);

  if (!data || !data.baskets) return null;

  return (
    <div>
      <div className="provider-grid">
        {data.baskets.map((b, i) => (
          <motion.div
            key={b.providerId}
            className={`card card-hover provider-card ${data.bestProvider && data.bestProvider.id === b.providerId ? 'best' : ''}`}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
          >
            {data.bestProvider && data.bestProvider.id === b.providerId && <span className="best-badge">BEST PRICE</span>}
            <div className="provider-head">
              <span className="provider-dot" style={{ background: b.color }} />
              <div>
                <div className="provider-name">{b.providerName}</div>
                <div className="provider-eta">
                  {b.etaMin >= 60 ? `${Math.round(b.etaMin / 60)}h slot` : `${b.etaMin} min delivery`}
                  {b.missing > 0 && <span style={{ color: 'var(--red)' }}> · {b.missing} item out of stock</span>}
                </div>
              </div>
            </div>
            <div className="price-big inr">{b.total > 0 ? inr(b.total) : '--'}</div>
            <div className="tiny muted" style={{ marginTop: 3 }}>
              {inr(b.subtotal)} items {b.fee > 0 ? `+ ${inr(b.fee)} delivery` : '+ free delivery'}
            </div>
            <button
              className={`btn btn-sm mt-2 ${data.bestProvider && data.bestProvider.id === b.providerId ? 'btn-primary' : ''}`}
              style={{ width: '100%' }}
              disabled={b.subtotal === 0 || busyProvider === b.providerId}
              onClick={() => onAddCart && onAddCart(b.providerId)}
            >
              <Icon name="cart" /> Add to cart
            </button>
          </motion.div>
        ))}
      </div>

      {data.savings > 0 && (
        <p className="small mt-2" style={{ color: 'var(--accent)' }}>
          <b>Save {inr(data.savings)}</b> by picking {data.bestProvider ? data.bestProvider.name : 'the best store'} for this basket.
        </p>
      )}

      <button className="btn btn-ghost btn-sm mt-2" onClick={() => setExpanded((e) => !e)}>
        {expanded ? 'Hide' : 'Show'} item-wise store rates <Icon name="chevD" />
      </button>

      {expanded && (
        <div className="table-scroll mt-1" style={{ maxHeight: 340 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Need</th>
                {data.perItem[0] && data.perItem[0].quotes.map((q) => (
                  <th key={q.providerId} className="num">{q.providerName.split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.perItem.map((it) => {
                const bestLine = Math.min(...it.quotes.filter((q) => q.inStock).map((q) => q.lineTotal));
                return (
                  <tr key={it.name}>
                    <td>
                      <b>{it.name}</b>
                      {it.quotes.some((q) => !q.inStock) && <span className="tiny" style={{ color: 'var(--red)' }}> · some OOS</span>}
                    </td>
                    <td className="muted small">{it.commercial.qty} {it.commercial.unit}</td>
                    {it.quotes.map((q) => (
                      <td key={q.providerId} className={`num ${q.inStock && q.lineTotal === bestLine ? 'bold' : 'muted'}`}
                        style={q.inStock && q.lineTotal === bestLine ? { color: 'var(--accent)' } : q.inStock ? {} : { textDecoration: 'line-through', opacity: 0.5 }}>
                        {q.inStock ? inr(q.lineTotal) : 'OOS'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
