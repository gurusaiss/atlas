import { useAnalyticsDashboard, useAnalyticsGuardrails, useAnalyticsTokens } from "../hooks/useAtlas.js";
import { QueryState, SkeletonList } from "../components/QueryState.jsx";
import { BarChart2, Shield, Cpu } from "lucide-react";

function StatCard({ label, value, sub }) {
  return (
    <div className="atlas-card p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function SeverityBar({ label, count, total, colorClass }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-16 shrink-0 capitalize">{label}</span>
      <div className="flex-1 bg-atlas-border rounded-full h-2">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
    </div>
  );
}

function TokenChart({ rows }) {
  if (!rows?.length) return <p className="text-sm text-gray-500">No token usage data yet.</p>;

  const maxTotal = Math.max(...rows.map((r) => r.gemini_tokens + r.groq_tokens + r.mistral_tokens), 1);

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const total = r.gemini_tokens + r.groq_tokens + r.mistral_tokens;
        return (
          <div key={r.date} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-24 shrink-0">{r.date}</span>
            <div className="flex-1 flex h-4 rounded overflow-hidden bg-atlas-border">
              {r.gemini_tokens > 0 && (
                <div
                  title={`Gemini: ${r.gemini_tokens.toLocaleString()}`}
                  className="bg-blue-500"
                  style={{ width: `${(r.gemini_tokens / maxTotal) * 100}%` }}
                />
              )}
              {r.groq_tokens > 0 && (
                <div
                  title={`Groq: ${r.groq_tokens.toLocaleString()}`}
                  className="bg-purple-500"
                  style={{ width: `${(r.groq_tokens / maxTotal) * 100}%` }}
                />
              )}
              {r.mistral_tokens > 0 && (
                <div
                  title={`Mistral: ${r.mistral_tokens.toLocaleString()}`}
                  className="bg-orange-400"
                  style={{ width: `${(r.mistral_tokens / maxTotal) * 100}%` }}
                />
              )}
            </div>
            <span className="text-xs text-gray-500 w-20 text-right">{total.toLocaleString()}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Gemini</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" />Groq</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />Mistral</span>
      </div>
    </div>
  );
}

export default function Analytics() {
  const dashQuery = useAnalyticsDashboard();
  const guardrailQuery = useAnalyticsGuardrails();
  const tokenQuery = useAnalyticsTokens();

  const dash = dashQuery.data;
  const severities = dash?.total_findings_by_severity || {};
  const totalFindings = Object.values(severities).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <BarChart2 className="w-6 h-6 text-atlas-accent" />
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-gray-500 text-sm">Cross-project usage and quality metrics</p>
        </div>
      </div>

      {/* Overview stats */}
      <section className="mb-8">
        <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-3">Overview</h2>
        {dashQuery.isLoading ? (
          <SkeletonList rows={2} />
        ) : dashQuery.isError ? (
          <p className="text-sm text-atlas-critical">Failed to load overview stats.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Repositories" value={dash.total_repos} />
            <StatCard label="Jobs" value={dash.total_jobs} />
            <StatCard label="Findings" value={totalFindings} />
            <StatCard label="Avg Complexity" value={dash.avg_complexity} />
            <StatCard label="Avg Debt" value={`${dash.avg_debt_minutes}m`} sub="technical debt" />
            <StatCard label="Guardrails Today" value={dash.guardrail_events_today} />
          </div>
        )}
      </section>

      {/* Findings by severity */}
      {!dashQuery.isLoading && dash && (
        <section className="atlas-card p-6 mb-6">
          <h2 className="text-sm font-medium mb-4">Findings by Severity</h2>
          {totalFindings === 0 ? (
            <p className="text-sm text-gray-500">No findings yet.</p>
          ) : (
            <div className="space-y-2">
              {[
                { key: "critical", label: "Critical", color: "bg-atlas-critical" },
                { key: "high", label: "High", color: "bg-orange-400" },
                { key: "medium", label: "Medium", color: "bg-atlas-warning" },
                { key: "low", label: "Low", color: "bg-blue-400" },
                { key: "info", label: "Info", color: "bg-gray-500" },
              ].map(({ key, label, color }) =>
                severities[key] !== undefined || severities[key] === 0 ? (
                  <SeverityBar key={key} label={label} count={severities[key] || 0} total={totalFindings} colorClass={color} />
                ) : null
              )}
            </div>
          )}
        </section>
      )}

      {/* Token usage */}
      <section className="atlas-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-medium">Token Usage by Day</h2>
        </div>
        {tokenQuery.isLoading ? (
          <SkeletonList rows={3} />
        ) : tokenQuery.isError ? (
          <p className="text-sm text-atlas-critical">Failed to load token data.</p>
        ) : (
          <TokenChart rows={tokenQuery.data} />
        )}
      </section>

      {/* Guardrail events */}
      <section className="atlas-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-medium">Guardrail Events</h2>
        </div>
        {guardrailQuery.isLoading ? (
          <SkeletonList rows={3} />
        ) : guardrailQuery.isError ? (
          <p className="text-sm text-atlas-critical">Failed to load guardrail data.</p>
        ) : !guardrailQuery.data?.length ? (
          <p className="text-sm text-gray-500">No guardrail events recorded yet.</p>
        ) : (
          <div className="divide-y divide-atlas-border">
            {guardrailQuery.data.map((row, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-mono text-gray-300">{row.check_type}</span>
                  <span className="text-gray-500 mx-2">&rarr;</span>
                  <span className="text-gray-400">{row.action_taken}</span>
                </div>
                <span className="atlas-badge bg-atlas-border text-gray-400">{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
