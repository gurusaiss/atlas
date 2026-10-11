import { useMemo, useState } from "react";
import { useAnalyticsDashboard, useAnalyticsGuardrails, useAnalyticsTokens } from "../hooks/useAtlas.js";
import { EmptyState, ErrorCard, SkeletonList } from "../components/QueryState.jsx";
import { SEVERITIES, TONE_BG, TONE_TEXT, usePalette } from "../utils/colors.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { compactNumber, formatDate } from "../utils/format.js";

function Stat({ label, value, sub }) {
  return (
    <div className="bg-card p-5">
      <p className="eyebrow">{label}</p>
      <p className="display mt-2 text-4xl tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

function Section({ eyebrow, title, children }) {
  return (
    <section className="mt-16">
      <p className="eyebrow mb-2">{eyebrow}</p>
      <h2 className="display mb-6 text-3xl">{title}</h2>
      {children}
    </section>
  );
}

const PROVIDERS = [
  { key: "gemini_tokens", label: "Gemini", tone: "sky" },
  { key: "groq_tokens", label: "Groq", tone: "ochre" },
  { key: "mistral_tokens", label: "Mistral", tone: "accent" },
];

function TokenChart({ rows }) {
  const palette = usePalette();
  const [active, setActive] = useState(null);

  const W = 760;
  const H = 230;
  const pad = { l: 44, r: 8, t: 10, b: 28 };

  const { bars, max, ticks } = useMemo(() => {
    const totals = rows.map((r) => PROVIDERS.reduce((s, p) => s + (r[p.key] || 0), 0));
    const maxVal = Math.max(...totals, 1);
    const innerW = W - pad.l - pad.r;
    const step = innerW / rows.length;
    const barW = Math.min(step * 0.62, 44);
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / maxVal);
    const built = rows.map((r, i) => {
      let acc = 0;
      const x = pad.l + step * i + (step - barW) / 2;
      const segments = PROVIDERS.map((p) => {
        const v = r[p.key] || 0;
        const seg = { ...p, v, y: y(acc + v), h: y(acc) - y(acc + v) };
        acc += v;
        return seg;
      });
      return { row: r, x, w: barW, total: totals[i], segments };
    });
    const tickVals = [0, 0.5, 1].map((f) => Math.round(maxVal * f));
    return { bars: built, max: maxVal, ticks: tickVals.map((v) => ({ v, y: y(v) })) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const totals = PROVIDERS.map((p) => ({ ...p, total: rows.reduce((s, r) => s + (r[p.key] || 0), 0) }));
  const focus = active != null ? bars[active] : null;

  return (
    <div>
      <div className="panel p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Stacked bar chart of tokens used per day by provider">
          {ticks.map((t) => (
            <g key={t.v}>
              <line x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} stroke={palette.rule} strokeDasharray={t.v === 0 ? "0" : "2 4"} />
              <text x={pad.l - 8} y={t.y + 3.5} textAnchor="end" fontSize="10" fill={palette.ink3} fontFamily='"IBM Plex Mono", monospace'>
                {compactNumber(t.v)}
              </text>
            </g>
          ))}
          {bars.map((b, i) => (
            <g key={b.row.date} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} tabIndex={0} style={{ outline: "none" }}>
              <rect x={b.x - 4} y={pad.t} width={b.w + 8} height={H - pad.t - pad.b} fill={active === i ? palette.sunk : "transparent"} />
              {b.segments.map((s) => (
                <rect key={s.key} x={b.x} y={s.y} width={b.w} height={Math.max(s.h, 0)} fill={palette[s.tone]} opacity={active == null || active === i ? 1 : 0.45} style={{ transition: "opacity 150ms" }} />
              ))}
              {(rows.length <= 10 || i % Math.ceil(rows.length / 8) === 0) && (
                <text x={b.x + b.w / 2} y={H - 9} textAnchor="middle" fontSize="10" fill={palette.ink3} fontFamily='"IBM Plex Mono", monospace'>
                  {b.row.date.slice(5)}
                </text>
              )}
            </g>
          ))}
        </svg>
        <p className="num mt-2 min-h-[1.25rem] text-xs text-ink-2" aria-live="polite">
          {focus
            ? `${formatDate(focus.row.date)} · ${focus.total.toLocaleString()} tokens · ${focus.segments.filter((s) => s.v).map((s) => `${s.label} ${s.v.toLocaleString()}`).join(" · ")}`
            : `Peak day: ${max.toLocaleString()} tokens`}
        </p>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
        {totals.map((p) => (
          <li key={p.key} className="flex items-center gap-2 text-sm text-ink-2">
            <span className="h-2.5 w-2.5" style={{ background: palette[p.tone] }} />
            {p.label}
            <span className="num text-ink-3">{compactNumber(p.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Analytics() {
  usePageTitle("Analytics");
  const dashQuery = useAnalyticsDashboard();
  const guardrailQuery = useAnalyticsGuardrails();
  const tokenQuery = useAnalyticsTokens();

  const dash = dashQuery.data;
  const severities = dash?.total_findings_by_severity || {};
  const totalFindings = Object.values(severities).reduce((a, b) => a + b, 0);
  const guardrailMax = Math.max(...(guardrailQuery.data || []).map((r) => r.count), 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="rise">
        <p className="eyebrow mb-3">Across all projects</p>
        <h1 className="display text-4xl sm:text-5xl">Analytics</h1>
      </header>

      <div className="mt-10">
        {dashQuery.isLoading ? (
          <SkeletonList rows={2} />
        ) : dashQuery.isError ? (
          <ErrorCard error={dashQuery.error} onRetry={() => dashQuery.refetch()} />
        ) : (
          <div className="rise grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-6" style={{ "--i": 1 }}>
            <Stat label="Repositories" value={dash.total_repos} />
            <Stat label="Analyses" value={dash.total_jobs} />
            <Stat label="Findings" value={totalFindings} />
            <Stat label="Avg complexity" value={dash.avg_complexity} />
            <Stat label="Avg debt" value={`${dash.avg_debt_minutes}m`} sub="per file" />
            <Stat label="Guardrails today" value={dash.guardrail_events_today} />
          </div>
        )}
      </div>

      {dash && (
        <Section eyebrow="Security" title="Findings by severity">
          {totalFindings === 0 ? (
            <EmptyState title="Nothing to report." message="No findings have been recorded yet." seed="findings" />
          ) : (
            <div>
              <div className="flex h-3 overflow-hidden bg-rule" role="img" aria-label="Share of findings by severity">
                {SEVERITIES.map((s) => (
                  <div key={s.key} className={TONE_BG[s.tone]} style={{ width: `${((severities[s.key] || 0) / totalFindings) * 100}%` }} title={`${s.label}: ${severities[s.key] || 0}`} />
                ))}
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-5">
                {SEVERITIES.map((s) => (
                  <div key={s.key} className="bg-card p-4">
                    <dt className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-2">
                      <span className={`h-2 w-2 ${TONE_BG[s.tone]}`} />
                      {s.label}
                    </dt>
                    <dd className={`display mt-2 text-3xl tabular-nums ${severities[s.key] ? TONE_TEXT[s.tone] : "text-ink-3/50"}`}>{severities[s.key] || 0}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Section>
      )}

      <Section eyebrow="Language models" title="Token usage by day">
        {tokenQuery.isLoading ? (
          <SkeletonList rows={3} />
        ) : tokenQuery.isError ? (
          <ErrorCard error={tokenQuery.error} onRetry={() => tokenQuery.refetch()} />
        ) : !tokenQuery.data?.length ? (
          <EmptyState title="No usage yet." message="Token usage appears here after your first analysis." seed="tokens" />
        ) : (
          <TokenChart rows={tokenQuery.data} />
        )}
      </Section>

      <Section eyebrow="Responsible AI" title="Guardrail events">
        {guardrailQuery.isLoading ? (
          <SkeletonList rows={3} />
        ) : guardrailQuery.isError ? (
          <ErrorCard error={guardrailQuery.error} onRetry={() => guardrailQuery.refetch()} />
        ) : !guardrailQuery.data?.length ? (
          <EmptyState title="All quiet." message="No guardrail events have been recorded yet." seed="guardrails" />
        ) : (
          <ul className="panel divide-y divide-rule">
            {guardrailQuery.data.map((row, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[1fr_12rem_3rem]">
                <p className="font-mono text-[0.8125rem] text-ink">
                  {row.check_type} <span className="text-ink-3">→</span> <span className="text-ink-2">{row.action_taken}</span>
                </p>
                <div className="hidden h-1 bg-rule sm:block" aria-hidden="true">
                  <div className="h-full bg-ink" style={{ width: `${(row.count / guardrailMax) * 100}%` }} />
                </div>
                <p className="num text-right text-sm text-ink-2">{row.count}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
