const ACTION_STYLE = {
  allowed: "text-moss",
  blocked: "text-crit",
  redacted: "text-ochre",
  flagged: "text-ochre",
  warned: "text-ochre",
};

export default function GuardrailEventFeed({ events = [] }) {
  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Guardrail log</p>
        <p className="num text-xs text-ink-3">{events.length} event{events.length === 1 ? "" : "s"}</p>
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-ink-3">Nothing has needed flagging so far. Redactions and blocks will appear here as they happen.</p>
      ) : (
        <ul className="mt-4 max-h-60 space-y-2 overflow-y-auto pr-1" aria-live="polite">
          {events.map((e, i) => (
            <li key={i} className="animate-fade font-mono text-xs leading-5">
              <span className={`font-semibold uppercase ${ACTION_STYLE[e.action] || "text-ink-2"}`}>{e.action}</span>{" "}
              <span className="text-ink-2">{e.check_type}</span>
              {e.agent && <span className="text-ink-3"> · {e.agent}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
