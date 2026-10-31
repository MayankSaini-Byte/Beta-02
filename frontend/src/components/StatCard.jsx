import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

function useCountUp(target, duration = 650) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export default function StatCard({ icon, tone = 'green', label, value, prefix = '', suffix = '', title }) {
  const numeric = typeof value === 'number';
  const animated = useCountUp(numeric ? value : 0);
  return (
    <div className="card stat-card" title={title}>
      <div className="stat-top">
        <div className={`stat-icon tone-${tone}`}><Icon name={icon} /></div>
      </div>
      <div className="stat-value">
        {prefix}{numeric ? animated.toLocaleString('en-IN') : value}{suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
