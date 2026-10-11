import { Check, X } from "lucide-react";

/**
 * The pipeline as a vertical trail. Stage state is derived from the backend's
 * list of finished graph nodes, so each marker reflects real progress rather
 * than a guessed percentage.
 */

export const STAGES = [
  {
    key: "prepare",
    label: "Parse and index",
    detail: "Structure, code embeddings and static analysis",
    nodes: ["parse_repository", "embed_chunks", "static_analysis"],
  },
  { key: "planner", label: "Planner", detail: "Scopes the run and picks the risky files", nodes: ["planner"] },
  {
    key: "parallel",
    group: "In parallel",
    items: [
      { key: "documentation", label: "Documentation", detail: "Architecture notes and diagrams", nodes: ["documentation"] },
      { key: "decomposition", label: "Decomposition", detail: "Service boundaries and migration order", nodes: ["decomposition"] },
      { key: "test_generator", label: "Test generation", detail: "Unit tests for uncovered functions", nodes: ["test_generator"] },
      { key: "security", label: "Security", detail: "OWASP findings with fixes", nodes: ["security"] },
    ],
  },
  { key: "critic", label: "Critic", detail: "Challenges the specialists' output", nodes: ["critic"] },
  { key: "evaluator", label: "Evaluator", detail: "Scores faithfulness and completeness", nodes: ["evaluator"] },
  { key: "report", label: "Report", detail: "Assembles the final deliverables", nodes: ["generate_report"] },
];

const flatten = (stages) => stages.flatMap((s) => (s.items ? s.items : [s]));
export const FLAT_STAGES = flatten(STAGES);

/** Returns { [stageKey]: "done" | "running" | "pending" | "failed" } */
export function deriveStageStatus({ steps, jobStatus }) {
  const done = new Set(steps);
  const finished = jobStatus === "completed";
  const active = jobStatus === "running" || jobStatus === "queued" || jobStatus === "parsing";
  const failed = jobStatus === "failed";
  const result = {};

  let blocked = false; // once a stage isn't done, later sequential stages wait
  for (const stage of STAGES) {
    const members = stage.items || [stage];
    const memberDone = members.map((m) => finished || m.nodes.every((n) => done.has(n)));

    members.forEach((m, i) => {
      if (memberDone[i]) result[m.key] = "done";
      else if (blocked) result[m.key] = "pending";
      else result[m.key] = failed ? "failed" : active ? "running" : "pending";
    });

    if (!memberDone.every(Boolean)) blocked = true;
  }

  if (failed) {
    // Only the first unfinished stage is the one that failed; the rest never ran.
    let marked = false;
    for (const s of FLAT_STAGES) {
      if (result[s.key] === "failed") {
        if (marked) result[s.key] = "pending";
        marked = true;
      }
    }
  }
  return result;
}

function Marker({ state }) {
  if (state === "done") {
    return (
      <span className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-crit text-white">
        <X className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (state === "running") {
    return (
      <span className="relative z-10 flex h-5 w-5 items-center justify-center">
        <span className="absolute h-5 w-5 animate-ping rounded-full bg-accent/40" />
        <span className="relative h-3 w-3 rounded-full bg-accent" />
      </span>
    );
  }
  return <span className="relative z-10 h-5 w-5 rounded-full border-2 border-rule-strong bg-paper" />;
}

const STATE_LABEL = { done: "Done", running: "Working", pending: "Waiting", failed: "Failed" };

function Row({ stage, state, last, nested, confidence }) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last && (
        <span
          className={`absolute left-[0.5625rem] top-6 -bottom-0 w-px ${state === "done" ? "bg-ink" : "bg-rule-strong"} transition-colors duration-500`}
          aria-hidden="true"
        />
      )}
      <Marker state={state} />
      <div className="min-w-0 flex-1 -mt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <p className={`font-display ${nested ? "text-lg" : "text-xl"} ${state === "pending" ? "text-ink-3" : "text-ink"} transition-colors`}>
            {stage.label}
          </p>
          <span
            className={`font-mono text-[0.6875rem] uppercase tracking-wider ${
              state === "running" ? "text-accent-ink" : state === "failed" ? "text-crit" : "text-ink-3"
            }`}
          >
            {typeof confidence === "number" && state === "done" ? `${Math.round(confidence * 100)}% confidence` : STATE_LABEL[state]}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-ink-3">{stage.detail}</p>
      </div>
    </li>
  );
}

export default function StageTrail({ statuses, confidences = {} }) {
  return (
    <ol>
      {STAGES.map((stage, idx) => {
        const last = idx === STAGES.length - 1;
        if (!stage.items) {
          return <Row key={stage.key} stage={stage} state={statuses[stage.key]} last={last} confidence={confidences[stage.key]} />;
        }
        return (
          <li key={stage.key} className="relative pb-6">
            <div className="ml-[0.5625rem] border-l border-dashed border-rule-strong pl-8">
              <p className="eyebrow -ml-1 mb-4 bg-paper py-0.5 pr-2 [margin-top:-0.25rem]">{stage.group}</p>
              <ol className="space-y-0">
                {stage.items.map((item, i) => (
                  <Row key={item.key} stage={item} state={statuses[item.key]} last={i === stage.items.length - 1} nested confidence={confidences[item.key]} />
                ))}
              </ol>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
