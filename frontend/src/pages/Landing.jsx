import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Contour from "../components/Contour.jsx";
import PipelineTrail from "../components/PipelineTrail.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

const DELIVERABLES = [
  {
    title: "Architecture notes",
    body: "A written tour of the system: components, responsibilities, data flow and the API surface, with a diagram you can edit.",
    tag: "Markdown + Mermaid",
  },
  {
    title: "Service boundaries",
    body: "Bounded contexts proposed from real dependency coupling, ordered by what to extract first and what it will cost.",
    tag: "Interactive graph",
  },
  {
    title: "Tests that run",
    body: "Unit tests for the functions nobody dared to touch, covering the happy path, the edges and the error handling.",
    tag: "pytest · JUnit",
  },
  {
    title: "Security findings",
    body: "OWASP Top 10 issues pinned to file and line, scored by severity, each with the fix written out.",
    tag: "Semgrep · Bandit · CWE",
  },
  {
    title: "Quality ledger",
    body: "Cyclomatic complexity, coupling and cohesion for every file, rolled up into an estimate of technical debt.",
    tag: "Complexity treemap",
  },
  {
    title: "A second opinion",
    body: "A separate evaluator scores every agent's output for faithfulness and completeness and flags likely false positives.",
    tag: "LLM-as-judge",
  },
];

const STEPS = [
  { title: "Bring the code", body: "Upload a ZIP or paste a public GitHub URL. Python, Java and JavaScript are parsed." },
  { title: "Parse and index", body: "tree-sitter extracts the structure; the code is chunked and embedded so agents retrieve instead of guess." },
  { title: "Seven agents work", body: "A planner scopes the job, four specialists run in parallel, a critic challenges them, an evaluator scores the result." },
  { title: "Review and export", body: "Browse findings, dismiss false positives, then download the whole report as Markdown or PDF." },
];

const SAFEGUARDS = [
  ["Secrets and personal data are redacted", "before any prompt leaves the process."],
  ["Static analysis goes first", "Semgrep and Bandit find the issues; the model explains them rather than inventing them."],
  ["Every run has a token budget", "so one large repository can't drain the quota."],
  ["Each guardrail action is logged", "and visible in your analytics, not buried in server output."],
];

export default function Landing() {
  usePageTitle("");

  return (
    <div>
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden border-b border-rule">
        <Contour
          seed="atlas-hero"
          cols={80}
          rows={44}
          levels={16}
          className="pointer-events-none absolute inset-0 h-full w-full drift text-ink/[0.13]"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-24">
          <div>
            <p className="eyebrow rise mb-6 flex items-center gap-3" style={{ "--i": 0 }}>
              <span className="h-px w-8 bg-accent" />
              Legacy code, surveyed
            </p>
            <h1 className="display rise text-[2.75rem] font-medium leading-[1.02] sm:text-6xl lg:text-[4.25rem]" style={{ "--i": 1 }}>
              Read the whole codebase before you{" "}
              <span className="relative inline-block whitespace-nowrap italic text-accent-ink">
                rewrite
                <svg viewBox="0 0 220 14" className="absolute -bottom-2 left-0 h-3 w-full text-accent" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 9 C 40 2, 70 12, 110 6 S 190 3, 218 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>{" "}
              a line of it.
            </h1>
            <p className="rise mt-8 max-w-xl text-lg leading-8 text-ink-2" style={{ "--i": 2 }}>
              Atlas runs a seven-agent analysis over a legacy repository and returns an architecture map, service boundaries,
              generated tests and a security report, each tied to the lines of code behind it.
            </p>
            <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ "--i": 3 }}>
              <Link to="/demo" className="btn btn-primary !px-6 !py-3 text-[0.9375rem]">
                Open the live demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/register" className="btn btn-outline !px-6 !py-3 text-[0.9375rem]">
                Create an account
              </Link>
            </div>
            <p className="rise mt-5 font-mono text-xs text-ink-3" style={{ "--i": 4 }}>
              The demo needs no sign-up · results are pre-computed
            </p>
          </div>

          <div className="rise relative" style={{ "--i": 3 }}>
            <div className="panel relative p-5 shadow-[0_30px_60px_-30px_rgb(var(--ink)/0.45)] sm:p-7">
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow">Fig. 1 — one run</p>
                <p className="eyebrow flex items-center gap-2">
                  <span className="dot animate-pulse text-accent" />
                  live trace
                </p>
              </div>
              <PipelineTrail className="h-auto w-full" />
            </div>
            <span className="absolute -bottom-3 -right-3 -z-10 h-full w-full border border-rule-strong" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* ---------- deliverables ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.6fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow mb-4">§ 01 — The output</p>
            <h2 className="display text-4xl sm:text-5xl">What one run hands back.</h2>
            <p className="mt-5 max-w-sm text-ink-2">
              Six deliverables from a single analysis, all of which you can browse in the demo without signing up.
            </p>
          </div>

          <ol className="border-t border-rule">
            {DELIVERABLES.map((d, i) => (
              <li key={d.title} className="group border-b border-rule">
                <div className="grid items-baseline gap-x-6 gap-y-2 px-2 py-7 transition-colors duration-200 group-hover:bg-card sm:grid-cols-[3rem_1fr_auto] sm:px-4">
                  <span className="num text-sm text-ink-3 transition-colors group-hover:text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-2xl text-ink transition-transform duration-200 group-hover:translate-x-1">{d.title}</h3>
                    <p className="mt-2 max-w-xl text-[0.9375rem] leading-7 text-ink-2">{d.body}</p>
                  </div>
                  <span className="chip self-start sm:mt-1.5">{d.tag}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="border-y border-rule bg-sunk/60">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <p className="eyebrow mb-4">§ 02 — The route</p>
          <h2 className="display max-w-2xl text-4xl sm:text-5xl">From a ZIP file to a report you can act on.</h2>
          <ol className="relative mt-14 grid gap-x-8 gap-y-10 md:grid-cols-4">
            <span className="absolute left-0 right-0 top-[0.4375rem] hidden h-px bg-rule-strong md:block" aria-hidden="true" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="relative z-10 mb-5 block h-3.5 w-3.5 rounded-full border-2 border-ink bg-paper" aria-hidden="true" />
                <p className="num mb-2 text-xs text-ink-3">Step {i + 1}</p>
                <h3 className="text-xl">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- safeguards ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow mb-4">§ 03 — The guardrails</p>
            <h2 className="display text-4xl sm:text-5xl">Nothing leaves the process unchecked.</h2>
            <p className="mt-5 max-w-md text-ink-2">
              Legacy repositories are full of things that should never reach a third-party model. Atlas is built around that.
            </p>
          </div>
          <dl className="divide-y divide-rule border-y border-rule">
            {SAFEGUARDS.map(([term, detail]) => (
              <div key={term} className="py-5">
                <dt className="font-display text-xl text-ink">{term}</dt>
                <dd className="mt-1 text-sm leading-6 text-ink-2">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- closing ---------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden bg-ink px-6 py-20 text-paper sm:px-14">
          <Contour seed="atlas-cta" cols={80} rows={30} levels={14} className="absolute inset-0 h-full w-full text-paper/[0.14]" />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <h2 className="display max-w-xl text-4xl !text-paper sm:text-5xl">See it on a real codebase.</h2>
            <Link
              to="/demo"
              className="group inline-flex items-center gap-2 bg-paper px-6 py-3 text-[0.9375rem] font-medium text-ink transition-colors hover:bg-accent hover:text-white"
              style={{ borderRadius: 3 }}
            >
              Explore the demo
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
