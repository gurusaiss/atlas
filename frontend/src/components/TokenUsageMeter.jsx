const DEFAULT_BUDGET = 50000;

export default function TokenUsageMeter({ tokensUsed = 0, budget = DEFAULT_BUDGET }) {
  const pct = Math.min(100, Math.round((tokensUsed / budget) * 100));
  const tone = pct > 90 ? "bg-crit" : pct > 70 ? "bg-ochre" : "bg-ink";

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Token budget</p>
        <p className="num text-xs text-ink-3">{pct}% used</p>
      </div>
      <p className="display mt-3 text-3xl tabular-nums">
        {tokensUsed.toLocaleString()}
        <span className="ml-1.5 font-sans text-sm font-normal text-ink-3">/ {budget.toLocaleString()}</span>
      </p>
      <div className="relative mt-4 h-1.5 bg-rule" role="progressbar" aria-valuenow={tokensUsed} aria-valuemin={0} aria-valuemax={budget} aria-label="Token usage">
        <div className={`h-full ${tone} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
        {[70, 90].map((t) => (
          <span key={t} className="absolute -top-1 h-3.5 w-px bg-ink-3/50" style={{ left: `${t}%` }} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
