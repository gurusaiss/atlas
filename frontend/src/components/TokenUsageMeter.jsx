const DEFAULT_BUDGET = 50000;

export default function TokenUsageMeter({ tokensUsed = 0, budget = DEFAULT_BUDGET }) {
  const pct = Math.min(100, Math.round((tokensUsed / budget) * 100));
  const barColor = pct > 90 ? "bg-atlas-critical" : pct > 70 ? "bg-atlas-warning" : "bg-atlas-accent";

  return (
    <div className="atlas-card p-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-400">Token usage</span>
        <span className="text-gray-300">
          {tokensUsed.toLocaleString()} / {budget.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-atlas-bg rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
