import { usePalette } from "../utils/colors.js";

/** A thin ring gauge. `value` is 0..1. Color follows quality thresholds. */
export default function Gauge({ value = 0, size = 132, stroke = 7, label, className = "" }) {
  const p = usePalette();
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = clamped >= 0.8 ? p.moss : clamped >= 0.6 ? p.ochre : p.high;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${label || "Score"}: ${Math.round(clamped * 100)} percent`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.rule} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.2, 0.7, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display text-4xl leading-none tabular-nums">{Math.round(clamped * 100)}</span>
        {label && <span className="eyebrow mt-1.5">{label}</span>}
      </div>
    </div>
  );
}
