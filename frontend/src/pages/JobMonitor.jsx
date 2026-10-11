import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, WifiOff } from "lucide-react";
import { useCancelJob, useJob } from "../hooks/useAtlas.js";
import { useSSE } from "../hooks/useSSE.js";
import { ErrorCard, describeError } from "../components/QueryState.jsx";
import StageTrail, { FLAT_STAGES, deriveStageStatus } from "../components/StageTrail.jsx";
import TokenUsageMeter from "../components/TokenUsageMeter.jsx";
import GuardrailEventFeed from "../components/GuardrailEventFeed.jsx";
import StatusPill from "../components/StatusPill.jsx";
import { toast } from "../store/toastStore.js";
import { confirm } from "../store/confirmStore.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { humanize } from "../utils/format.js";

const MILESTONES = [10, 20, 25, 35, 47, 55, 62, 70, 80, 90, 95];

function useElapsed(startIso, endIso, running) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!startIso) return null;
  const end = endIso ? new Date(endIso).getTime() : now;
  const seconds = Math.max(0, Math.floor((end - new Date(startIso).getTime()) / 1000));
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function JobMonitor() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const jobQuery = useJob(jobId, {
    refetchInterval: (query) => (["completed", "failed", "cancelled"].includes(query.state.data?.status) ? false : 5000),
  });
  const job = jobQuery.data;
  const cancelJob = useCancelJob();

  const [sseSteps, setSseSteps] = useState([]);
  const [confidences, setConfidences] = useState({});
  const [tokens, setTokens] = useState(0);
  const [percent, setPercent] = useState(0);
  const [guardrailEvents, setGuardrailEvents] = useState([]);
  const [streamStatus, setStreamStatus] = useState("running");

  const { reconnecting, gaveUp } = useSSE(jobId, (event) => {
    if (event.type === "agent_complete") {
      setConfidences((prev) => ({ ...prev, [event.agent]: event.confidence }));
    } else if (event.type === "guardrail_event") {
      setGuardrailEvents((prev) => [...prev, event]);
    } else if (event.type === "progress") {
      setTokens(event.tokens || 0);
      setPercent((p) => Math.max(p, event.percent || 0));
      if (Array.isArray(event.steps)) setSseSteps(event.steps);
    } else if (event.type === "complete") {
      setStreamStatus("completed");
    } else if (event.type === "error") {
      setStreamStatus("error");
    }
  });

  const status = job?.status;
  const isDone = streamStatus === "completed" || status === "completed";
  const isCancelled = status === "cancelled";
  const isFailed = (streamStatus === "error" || status === "failed") && !isDone && !isCancelled;
  const isRunning = !isDone && !isFailed && !isCancelled;
  const effectiveStatus = isDone ? "completed" : isCancelled ? "cancelled" : isFailed ? "failed" : status || "running";

  const steps = useMemo(() => {
    const fromJob = (job?.current_step || "").split(",").filter(Boolean);
    return Array.from(new Set([...fromJob, ...sseSteps]));
  }, [job?.current_step, sseSteps]);

  const stageStatus = useMemo(() => deriveStageStatus({ steps, jobStatus: effectiveStatus }), [steps, effectiveStatus]);
  const doneCount = FLAT_STAGES.filter((s) => stageStatus[s.key] === "done").length;
  const progress = isDone ? 100 : Math.max(percent, job?.progress ?? 0);
  const elapsed = useElapsed(job?.started_at || job?.created_at, job?.completed_at, isRunning);
  const tokenCount = Math.max(tokens, job?.total_tokens_used ?? 0);
  const currentLabel = isDone
    ? "Finished"
    : isFailed
      ? "Stopped early"
      : isCancelled
        ? "Cancelled"
        : FLAT_STAGES.find((s) => stageStatus[s.key] === "running")?.label || "Starting";

  usePageTitle(isRunning ? `${progress}% · Analysis` : isDone ? "Analysis complete" : "Analysis");

  async function handleCancel() {
    const ok = await confirm({
      title: "Cancel this analysis?",
      message: "The run stops immediately and can't be resumed. You can start a fresh analysis afterwards.",
      confirmLabel: "Cancel analysis",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await cancelJob.mutateAsync(jobId);
      toast.success("Analysis cancelled.");
      if (job?.project_id) navigate(`/projects/${job.project_id}`);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  if (jobQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <ErrorCard error={jobQuery.error} onRetry={() => jobQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {job?.project_id ? (
        <Link to={`/projects/${job.project_id}`} className="navlink inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to project
        </Link>
      ) : (
        <span className="skeleton block h-4 w-28" />
      )}

      <header className="rise mt-6 flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-8">
        <div>
          <p className="eyebrow mb-3 flex items-center gap-3">
            <span>{humanize(job?.job_type || "analysis")}</span>
            <span className="h-3 w-px bg-rule-strong" />
            <span className="num normal-case tracking-normal">#{jobId.slice(0, 8)}</span>
            <StatusPill status={effectiveStatus} />
          </p>
          <h1 className="display text-4xl sm:text-5xl">
            {isDone ? (
              <>Analysis <span className="italic text-accent-ink">complete.</span></>
            ) : isFailed ? (
              <>The run <span className="italic text-crit">stopped.</span></>
            ) : isCancelled ? (
              <>Run <span className="italic text-ink-3">cancelled.</span></>
            ) : (
              <>Surveying your <span className="italic text-accent-ink">codebase.</span></>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button onClick={handleCancel} disabled={cancelJob.isPending} className="btn btn-outline btn-danger">
              Cancel run
            </button>
          )}
          {isDone && (
            <button onClick={() => navigate(`/jobs/${jobId}/results`)} className="btn btn-primary !px-6 !py-3">
              Open the report
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {reconnecting && isRunning && (
        <div role="status" className="mt-6 flex animate-pop items-center gap-3 border-l-2 border-ochre bg-ochre/10 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ochre" />
          Live updates dropped, reconnecting. The analysis keeps running on the server either way.
        </div>
      )}
      {gaveUp && isRunning && (
        <div role="alert" className="mt-6 flex items-center gap-3 border-l-2 border-crit bg-crit/10 px-4 py-3 text-sm">
          <WifiOff className="h-4 w-4 shrink-0 text-crit" />
          Lost the live connection. The run may still be going: refresh to check its latest status.
        </div>
      )}

      {/* progress */}
      <section className="rise mt-10 grid gap-8 md:grid-cols-[auto_1fr] md:items-end" style={{ "--i": 1 }} aria-label="Progress">
        <div>
          <p className="display flex items-start leading-none tabular-nums" style={{ fontSize: "clamp(4.5rem, 12vw, 8rem)" }} aria-live="polite">
            {progress}
            <span className="mt-2 text-[0.28em] text-ink-3">%</span>
          </p>
        </div>
        <div className="pb-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="font-display text-2xl text-ink">
              {currentLabel}
              {isRunning && <span className="ml-1 inline-flex gap-0.5 align-baseline" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className="animate-pulse text-accent" style={{ animationDelay: `${i * 200}ms` }}>.</span>)}</span>}
            </p>
            <p className="num text-sm text-ink-3">
              {doneCount}/{FLAT_STAGES.length} stages{elapsed ? ` · ${elapsed}` : ""}
            </p>
          </div>
          <div
            className="relative mt-4 h-2 bg-rule"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Analysis progress"
          >
            <div
              className={`absolute inset-y-0 left-0 transition-[width] duration-700 ease-out ${isFailed ? "bg-crit" : isDone ? "bg-moss" : "bg-accent"}`}
              style={{ width: `${progress}%` }}
            />
            {MILESTONES.map((m) => (
              <span key={m} className="absolute inset-y-0 w-px bg-paper/80" style={{ left: `${m}%` }} aria-hidden="true" />
            ))}
          </div>
        </div>
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <section aria-label="Pipeline stages" className="rise" style={{ "--i": 2 }}>
          <h2 className="eyebrow mb-6">Pipeline</h2>
          <StageTrail statuses={stageStatus} confidences={confidences} />
        </section>

        <aside className="rise space-y-5 lg:sticky lg:top-24 lg:self-start" style={{ "--i": 3 }}>
          <TokenUsageMeter tokensUsed={tokenCount} />
          <GuardrailEventFeed events={guardrailEvents} />
        </aside>
      </div>

      {isFailed && (
        <div className="panel mt-10 border-l-2 !border-l-crit p-6" role="alert">
          <p className="font-display text-xl">What went wrong</p>
          <p className="mt-1 text-sm leading-6 text-ink-2">{job?.error_message || "The run stopped unexpectedly. Check the server logs for details."}</p>
          {job?.project_id && (
            <Link to={`/projects/${job.project_id}`} className="btn btn-outline btn-sm mt-4 inline-flex">
              Back to project
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
