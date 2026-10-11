import { useMemo, useRef, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useDecomposition,
  useDocumentation,
  useJob,
  useMarkFalsePositive,
  useQuality,
  useRepository,
  useSecurityFindings,
  useTestFile,
  useTests,
} from "../hooks/useAtlas.js";
import { API_BASE_PATH } from "../api/client.js";
import { useAtlasStore } from "../store/atlasStore.js";
import MermaidRenderer from "../components/MermaidRenderer.jsx";
import MicroservicesGraph from "../components/MicroservicesGraph.jsx";
import SecurityFindingCard from "../components/SecurityFindingCard.jsx";
import CodeViewer from "../components/CodeViewer.jsx";
import ComplexityHeatmap from "../components/ComplexityHeatmap.jsx";
import Gauge from "../components/Gauge.jsx";
import { EmptyState, ErrorCard, SkeletonList, describeError } from "../components/QueryState.jsx";
import { SEVERITIES, TONE_BG, TONE_TEXT } from "../utils/colors.js";
import { toast } from "../store/toastStore.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { timeAgo } from "../utils/format.js";

async function downloadWithAuth(url, filename) {
  const token = useAtlasStore.getState().accessToken;
  const resp = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "decomposition", label: "Services" },
  { id: "security", label: "Security" },
  { id: "tests", label: "Tests" },
  { id: "metrics", label: "Metrics" },
];

const METRICS = [
  ["faithfulness", "Faithfulness", "Statements match the code that was actually read."],
  ["completeness", "Completeness", "How much of the codebase the analysis covers."],
  ["actionability", "Actionability", "Findings come with a fix you can apply."],
  ["decomposition_validity", "Decomposition validity", "Proposed service boundaries hold up."],
  ["test_coverage_estimate", "Test coverage estimate", "Estimated share of code the generated tests exercise."],
];

function extractMermaid(markdown = "") {
  const match = markdown.match(/```mermaid\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function TestFileViewer({ jobId, test }) {
  const { data, isLoading } = useTestFile(jobId, test.test_file);
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[0.8125rem] text-ink-2">
          {test.source_file} <span className="text-ink-3">→</span> <span className="text-ink">{test.test_file}</span>
        </p>
        <span className="chip">{test.framework}</span>
      </div>
      {isLoading ? <div className="skeleton h-[300px]" /> : <CodeViewer code={data?.test_code} filePath={test.test_file} height="300px" />}
    </section>
  );
}

/** Per-tab loading/error handling so a failed fetch never renders identically to
 * "nothing generated yet". */
function TabQueryState({ query, children }) {
  if (query.isLoading) return <SkeletonList rows={3} />;
  if (query.isError) return <ErrorCard error={query.error} onRetry={() => query.refetch()} />;
  return children;
}

function qualityVerdict(score) {
  if (score >= 0.85) return { title: "A strong result.", body: "The evaluator found the output faithful to the code and thorough." };
  if (score >= 0.7) return { title: "Solid, with gaps.", body: "Mostly reliable. Review the improvement notes below before relying on it." };
  if (score > 0) return { title: "Treat with caution.", body: "The evaluator flagged significant weaknesses. Verify findings against the code." };
  return { title: "No score yet.", body: "The evaluator hasn't produced a quality score for this run." };
}

export default function Results() {
  const { jobId } = useParams();
  const [params, setParams] = useSearchParams();
  const activeTab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview";
  const severityFilter = params.get("sev") || "all";
  const tabRefs = useRef({});

  const jobQuery = useJob(jobId);
  const job = jobQuery.data;
  const docsQuery = useDocumentation(jobId);
  const decompositionQuery = useDecomposition(jobId);
  const findingsQuery = useSecurityFindings(jobId);
  const testsQuery = useTests(jobId);
  const qualityQuery = useQuality(jobId);
  // Wait for the job so repository_id is defined; avoids a false "no metrics" flash.
  const repositoryQuery = useRepository(job?.repository_id || null);
  const markFalsePositive = useMarkFalsePositive();
  const [downloading, setDownloading] = useState(null);

  const docs = docsQuery.data;
  const decomposition = decompositionQuery.data;
  const findings = findingsQuery.data;
  const tests = testsQuery.data;
  const quality = qualityQuery.data;
  const repository = repositoryQuery.data;
  const evaluation = quality?.evaluation || {};
  const architectureDiagram = extractMermaid(docs?.markdown);
  const overall = evaluation.overall_quality_score || 0;
  const verdict = qualityVerdict(overall);

  usePageTitle(repository?.name ? `${repository.name} report` : "Report");

  const severityCounts = useMemo(() => {
    const counts = Object.fromEntries(SEVERITIES.map((s) => [s.key, 0]));
    (findings || []).forEach((f) => {
      if (!f.is_false_positive && counts[f.severity] !== undefined) counts[f.severity] += 1;
    });
    return counts;
  }, [findings]);
  const openFindings = Object.values(severityCounts).reduce((a, b) => a + b, 0);
  const filesAffected = new Set((findings || []).filter((f) => !f.is_false_positive).map((f) => f.file_path)).size;

  const visibleFindings = useMemo(() => {
    const order = Object.fromEntries(SEVERITIES.map((s, i) => [s.key, i]));
    return [...(findings || [])]
      .filter((f) => severityFilter === "all" || f.severity === severityFilter)
      .sort((a, b) => Number(!!a.is_false_positive) - Number(!!b.is_false_positive) || (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  }, [findings, severityFilter]);

  function setTab(id, extra = {}) {
    const next = new URLSearchParams();
    if (id !== "overview") next.set("tab", id);
    Object.entries(extra).forEach(([k, v]) => v && next.set(k, v));
    setParams(next, { replace: true });
  }

  function onTabKey(e, index) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  }

  async function handleDownload(format) {
    const ext = format === "pdf" ? "pdf" : "md";
    setDownloading(format);
    try {
      await downloadWithAuth(`${API_BASE_PATH}/reports/${jobId}/${format}`, `atlas_report_${jobId}.${ext}`);
    } catch (err) {
      toast.error(describeError(err) === "Something went wrong." ? "The download failed. Please try again." : describeError(err));
    } finally {
      setDownloading(null);
    }
  }

  function handleMarkFalsePositive(findingId) {
    markFalsePositive.mutate(
      { findingId, reason: "Reviewed by user" },
      {
        onSuccess: () => toast.success("Marked as a false positive."),
        onError: (err) => toast.error(describeError(err)),
      }
    );
  }

  if (jobQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="skeleton mb-4 h-4 w-28" />
        <div className="skeleton mb-8 h-12 w-80 max-w-full" />
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (jobQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <ErrorCard error={jobQuery.error} onRetry={() => jobQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {job?.project_id && (
        <Link to={`/projects/${job.project_id}`} className="navlink inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to project
        </Link>
      )}

      <header className="rise mt-6 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="eyebrow mb-3">
            Analysis report <span className="mx-2 text-rule-strong">/</span>
            <span className="num normal-case tracking-normal">#{jobId.slice(0, 8)}</span>
            {job?.completed_at && <span className="normal-case tracking-normal"> · {timeAgo(job.completed_at)}</span>}
          </p>
          <h1 className="display break-words text-4xl sm:text-5xl">{repository?.name || "Analysis report"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleDownload("markdown")} disabled={!!downloading} className="btn btn-outline btn-sm" title="Download as Markdown">
            {downloading === "markdown" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Markdown
          </button>
          <button onClick={() => handleDownload("pdf")} disabled={!!downloading} className="btn btn-primary btn-sm" title="Download as PDF">
            {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF
          </button>
        </div>
      </header>

      <div role="tablist" aria-label="Report sections" className="sticky top-16 z-20 -mx-4 mt-8 flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-rule bg-paper/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        {TABS.map((tab, i) => {
          const selected = activeTab === tab.id;
          const badge = tab.id === "security" && findings ? openFindings : null;
          return (
            <button
              key={tab.id}
              ref={(el) => (tabRefs.current[tab.id] = el)}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(tab.id)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-3.5 text-sm font-medium transition-colors ${selected ? "text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              {tab.label}
              {badge != null && <span className="num rounded-sm bg-ink/10 px-1.5 py-px text-[0.6875rem]">{badge}</span>}
              <span className={`absolute inset-x-3 bottom-0 h-0.5 origin-left bg-accent transition-transform duration-300 ease-out ${selected ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="mt-10 animate-fade" key={activeTab}>
        {activeTab === "overview" && (
          <div className="space-y-14">
            {(findingsQuery.isError || qualityQuery.isError) && (
              <p role="alert" className="border-l-2 border-crit bg-crit/10 px-4 py-3 text-sm">
                Some overview data failed to load ({[findingsQuery.isError && "findings", qualityQuery.isError && "quality scores"].filter(Boolean).join(", ")}). The numbers below may be incomplete.
              </p>
            )}

            <section className="grid items-center gap-10 md:grid-cols-[auto_1fr]">
              <Gauge value={overall} size={168} stroke={8} label="Quality" className="mx-auto md:mx-0" />
              <div>
                <p className="eyebrow mb-2">Evaluator verdict</p>
                <h2 className="display text-3xl sm:text-4xl">{verdict.title}</h2>
                <p className="mt-3 max-w-xl leading-7 text-ink-2">{verdict.body}</p>
                {findings && (
                  <p className="mt-4 text-sm text-ink-2">
                    <span className="num font-semibold text-ink">{openFindings}</span> open finding{openFindings === 1 ? "" : "s"} across{" "}
                    <span className="num font-semibold text-ink">{filesAffected}</span> file{filesAffected === 1 ? "" : "s"}.
                  </p>
                )}
              </div>
            </section>

            <section>
              <h2 className="eyebrow mb-4">Findings by severity</h2>
              <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
                {SEVERITIES.slice(0, 4).map((s) => {
                  const count = severityCounts[s.key];
                  return (
                    <button
                      key={s.key}
                      onClick={() => setTab("security", { sev: s.key })}
                      disabled={count === 0}
                      className="group bg-card p-5 text-left transition-colors hover:bg-sunk disabled:cursor-default disabled:hover:bg-card"
                    >
                      <p className={`display text-5xl tabular-nums ${count ? TONE_TEXT[s.tone] : "text-ink-3/50"}`}>{count}</p>
                      <p className="mt-2 flex items-center justify-between font-mono text-[0.6875rem] uppercase tracking-wider text-ink-2">
                        {s.label}
                        {count > 0 && <span className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100">View →</span>}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="eyebrow mb-4">Quality breakdown</h2>
              <dl className="divide-y divide-rule border-y border-rule">
                {METRICS.filter(([key]) => typeof evaluation[key] === "number").map(([key, label, hint]) => {
                  const v = evaluation[key];
                  return (
                    <div key={key} className="grid items-center gap-x-6 gap-y-1.5 py-4 sm:grid-cols-[14rem_1fr_3.5rem]">
                      <div>
                        <dt className="text-sm font-medium text-ink">{label}</dt>
                        <p className="text-xs text-ink-3">{hint}</p>
                      </div>
                      <div className="h-1.5 bg-rule" aria-hidden="true">
                        <div className={`h-full transition-[width] duration-1000 ease-out ${v >= 0.8 ? TONE_BG.moss : v >= 0.6 ? TONE_BG.ochre : TONE_BG.high}`} style={{ width: `${Math.round(v * 100)}%` }} />
                      </div>
                      <dd className="display text-right text-2xl tabular-nums">{Math.round(v * 100)}<span className="text-sm text-ink-3">%</span></dd>
                    </div>
                  );
                })}
              </dl>
            </section>

            {evaluation.improvement_suggestions?.length > 0 && (
              <section>
                <h2 className="eyebrow mb-4">What to improve</h2>
                <ol className="space-y-3">
                  {evaluation.improvement_suggestions.map((s, i) => (
                    <li key={i} className="flex gap-4 text-[0.9375rem] leading-7 text-ink-2">
                      <span className="num mt-0.5 text-sm text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}

        {activeTab === "architecture" && (
          <TabQueryState query={docsQuery}>
            <div className="space-y-8">
              {architectureDiagram && <MermaidRenderer chart={architectureDiagram} caption="System overview" />}
              <article className="panel prose-atlas p-6 sm:p-10">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{docs?.markdown || "_No documentation was generated for this run._"}</ReactMarkdown>
              </article>
            </div>
          </TabQueryState>
        )}

        {activeTab === "decomposition" && (
          <TabQueryState query={decompositionQuery}>
            {decomposition?.services ? (
              <div className="space-y-8">
                <MicroservicesGraph services={decomposition.services} />
                <div className="grid gap-5 md:grid-cols-[1fr_auto]">
                  {decomposition.risks?.length > 0 && (
                    <div className="border-l-2 border-ochre bg-ochre/10 px-5 py-4">
                      <h3 className="eyebrow !text-ochre">Migration risks</h3>
                      <ul className="mt-2 space-y-2 text-sm leading-6 text-ink-2">
                        {decomposition.risks.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <dl className="panel grid min-w-[16rem] grid-cols-2 gap-5 p-5">
                    <div>
                      <dt className="eyebrow">Extract first</dt>
                      <dd className="mt-1 font-display text-lg leading-tight">{decomposition.recommended_first_extraction}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Effort</dt>
                      <dd className="display mt-1 text-3xl tabular-nums">{decomposition.estimated_total_effort_weeks}<span className="ml-1 font-sans text-sm text-ink-3">wks</span></dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              <EmptyState title="No service plan." message="The decomposition agent didn't produce a plan for this run." seed="decomp" />
            )}
          </TabQueryState>
        )}

        {activeTab === "security" && (
          <TabQueryState query={findingsQuery}>
            {!findings?.length ? (
              <EmptyState title="Nothing found." message="No security findings were reported for this run." seed="security" />
            ) : (
              <div>
                <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by severity">
                  {[{ key: "all", label: "All", count: findings.length }, ...SEVERITIES.map((s) => ({ key: s.key, label: s.label, count: findings.filter((f) => f.severity === s.key).length }))]
                    .filter((c) => c.key === "all" || c.count > 0)
                    .map((c) => (
                      <button
                        key={c.key}
                        onClick={() => setTab("security", { sev: c.key === "all" ? null : c.key })}
                        aria-pressed={severityFilter === c.key}
                        className={`chip cursor-pointer transition-colors ${severityFilter === c.key ? "!border-ink bg-ink !text-paper" : "hover:border-ink-3 hover:text-ink"}`}
                      >
                        {c.label}
                        <span className="num opacity-70">{c.count}</span>
                      </button>
                    ))}
                </div>
                <div className="space-y-3">
                  {visibleFindings.map((f, i) => (
                    <div key={f.id || f.title} className="rise" style={{ "--i": Math.min(i, 8) }}>
                      <SecurityFindingCard finding={f} onMarkFalsePositive={f.id ? handleMarkFalsePositive : undefined} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabQueryState>
        )}

        {activeTab === "tests" && (
          <TabQueryState query={testsQuery}>
            {!tests?.length ? (
              <EmptyState title="No tests generated." message="The test agent didn't produce any files for this run." seed="tests" />
            ) : (
              <div className="space-y-10">
                {tests.map((t) => (
                  <TestFileViewer key={t.test_file} jobId={jobId} test={t} />
                ))}
              </div>
            )}
          </TabQueryState>
        )}

        {activeTab === "metrics" && (
          <TabQueryState query={repositoryQuery}>
            <ComplexityHeatmap files={repository?.code_files || []} />
          </TabQueryState>
        )}
      </div>
    </div>
  );
}
