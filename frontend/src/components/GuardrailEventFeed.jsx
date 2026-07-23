const ACTION_COLORS = {
  allowed: "text-atlas-success",
  blocked: "text-atlas-critical",
  redacted: "text-atlas-warning",
  flagged: "text-atlas-warning",
  warned: "text-yellow-500",
};

export default function GuardrailEventFeed({ events = [] }) {
  if (!events.length) {
    return <div className="atlas-card p-4 text-sm text-gray-500">No guardrail events yet.</div>;
  }

  return (
    <div className="atlas-card p-4 max-h-64 overflow-y-auto">
      <h3 className="text-sm text-gray-400 mb-2">Guardrail Events</h3>
      <ul className="space-y-1.5">
        {events.map((e, i) => (
          <li key={i} className="text-xs flex items-center gap-2">
            <span className={`font-medium ${ACTION_COLORS[e.action] || "text-gray-400"}`}>
              {e.action?.toUpperCase()}
            </span>
            <span className="text-gray-500">{e.check_type}</span>
            {e.agent && <span className="text-gray-600">&middot; {e.agent}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
