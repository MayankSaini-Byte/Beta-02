import { motion } from 'framer-motion';

export default function CoverageRing({ value = 0, size = 46, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 95 ? 'var(--accent)' : pct >= 60 ? 'var(--amber)' : 'var(--red)';
  return (
    <div className="cov-ring" style={{ width: size, height: size }} title={`${pct}% ingredients available`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (pct / 100) * c }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
        />
      </svg>
      <span className="cov-num" style={{ color }}>{pct}</span>
    </div>
  );
}
