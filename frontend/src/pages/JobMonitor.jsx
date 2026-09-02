import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { useJob } from "../hooks/useAtlas.js";
import { useSSE } from "../hooks/useSSE.js";
import { ErrorCard } from "../components/QueryState.jsx";
import AgentProgressCard from "../components/AgentProgressCard.jsx";
import TokenUsageMeter from "../components/TokenUsageMeter.jsx";
import GuardrailEventFeed from "../components/GuardrailEventFeed.jsx";

const AGENT_ORDER = ["planner", "documentation", "decomposition", "test_generator", "security", "critic", "evaluator"];

export default function JobMonitor() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const jobQuery = useJob(jobId, { refetchInterval: 5000 });
  const job = jobQuery.data;

  const [agentStatuses, setAgentStatuses] = useState({});
  const [tokens, setTokens] = useState(0);
  const [guardrailEvents, setGuardrailEvents] = useState([]);
  const [streamStatus, setStreamStatus] = useState("running");

  const { reconnecting, gaveUp } = useSSE(jobId, (event) => {
    if (event.type === "agent_complete") {
      setAgentStatuses((prev) => ({
        ...prev,
        [event.agent]: { status: event.status, confidence: event.confidence },
      }));
    } else if (event.type === "guardrail_event") {
      setGuardrailEvents((prev) => [...prev, event]);
    } else if (event.type === "progress") {
      setTokens(event.tokens || 0);
    } else if (event.type === "complete") {
      setStreamStatus("completed");
    } else if (event.type === "error") {
      setStreamStatus("error");
    }
  });

  const isDone = streamStatus === "completed" || job?.status === "completed";
  const isFailed = streamStatus === "error" || job?.status === "failed";

  if (jobQuery.isError) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <ErrorCard error={jobQuery.error} onRetry={() => jobQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-semibold">Analysis Job</h1>
        {isDone && (
          <button onClick={() => navigate(`/jobs/${jobId}/results`)} className="atlas-btn-primary">
            View Results
          </button>
        )}
      </div>

      {job?.repository_id && (
        <p className="text-sm text-gray-500 mb-6">
          Status: <span className="text-gray-300">{job.status}</span> &middot; {job.progress ?? 0}% complete
        </p>
      )}

      {reconnecting && !isDone && !isFailed && (
        <div className="mb-6 flex items-center gap-2 text-sm text-amber-300 bg-amber-950/30 border border-amber-900 rounded-md p-3">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Live updates disconnected — reconnecting… (the job itself keeps running on the server either way)
        </div>
      )}
      {gaveUp && !isDone && !isFailed && (
        <div className="mb-6 flex items-center gap-2 text-sm text-atlas-critical bg-red-950/30 border border-red-900 rounded-md p-3">
          <WifiOff className="w-4 h-4 shrink-0" />
          Lost the live connection. The job may still be running — refresh the page to check its current status.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {AGENT_ORDER.map((agentType) => (
          <AgentProgressCard
            key={agentType}
            agentType={agentType}
            status={agentStatuses[agentType]?.status || "pending"}
            confidence={agentStatuses[agentType]?.confidence}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TokenUsageMeter tokensUsed={tokens} />
        <GuardrailEventFeed events={guardrailEvents} />
      </div>

      {isFailed && (
        <div className="mt-6 atlas-card p-4 border-red-900/60">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-atlas-critical shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">Job failed</p>
              <p className="text-sm text-gray-400 mb-3">{job?.error_message || "See server logs for details."}</p>
              {job?.project_id && (
                <Link to={`/projects/${job.project_id}`} className="atlas-btn-secondary text-sm py-1.5 inline-block">
                  Back to project
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
