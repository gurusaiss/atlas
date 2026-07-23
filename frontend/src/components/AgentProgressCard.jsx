import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";

const STATUS_ICON = {
  pending: <CircleDashed className="w-4 h-4 text-gray-500" />,
  running: <Loader2 className="w-4 h-4 text-atlas-accent animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4 text-atlas-success" />,
  failed: <XCircle className="w-4 h-4 text-atlas-critical" />,
  skipped: <CircleDashed className="w-4 h-4 text-gray-600" />,
};

const AGENT_LABELS = {
  planner: "Planner",
  documentation: "Documentation",
  decomposition: "Decomposition",
  test_generator: "Test Generation",
  security: "Security",
  critic: "Critic",
  evaluator: "Evaluator",
};

export default function AgentProgressCard({ agentType, status, confidence }) {
  const isRunning = status === "running";
  return (
    <div
      className={`atlas-card p-4 flex items-center justify-between ${
        isRunning ? "border-atlas-accent shadow-[0_0_0_1px_rgba(99,102,241,0.3)] animate-pulse" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {STATUS_ICON[status] || STATUS_ICON.pending}
        <span className="text-sm font-medium">{AGENT_LABELS[agentType] || agentType}</span>
      </div>
      {typeof confidence === "number" && (
        <span className="text-xs text-gray-500">{Math.round(confidence * 100)}% confidence</span>
      )}
    </div>
  );
}
