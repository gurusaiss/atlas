import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useJob } from "../hooks/useAtlas.js";
import { useSSE } from "../hooks/useSSE.js";
import AgentProgressCard from "../components/AgentProgressCard.jsx";
import TokenUsageMeter from "../components/TokenUsageMeter.jsx";
import GuardrailEventFeed from "../components/GuardrailEventFeed.jsx";

const AGENT_ORDER = ["planner", "documentation", "decomposition", "test_generator", "security", "critic", "evaluator"];

export default function JobMonitor() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { data: job } = useJob(jobId, { refetchInterval: 5000 });

  const [agentStatuses, setAgentStatuses] = useState({});
  const [tokens, setTokens] = useState(0);
  const [guardrailEvents, setGuardrailEvents] = useState([]);
  const [streamStatus, setStreamStatus] = useState("running");

  useSSE(jobId, (event) => {
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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Analysis Job</h1>
        {isDone && (
          <button onClick={() => navigate(`/jobs/${jobId}/results`)} className="atlas-btn-primary">
            View Results
          </button>
        )}
      </div>

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

      {streamStatus === "error" && (
        <p className="mt-4 text-sm text-atlas-critical">
          Job failed: {job?.error_message || "See server logs for details."}
        </p>
      )}
    </div>
  );
}
