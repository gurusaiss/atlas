const STATUS = {
  queued: { label: "Queued", cls: "text-ink-3" },
  pending: { label: "Pending", cls: "text-ochre" },
  parsing: { label: "Parsing", cls: "text-sky", pulse: true },
  running: { label: "Running", cls: "text-accent-ink", pulse: true },
  ready: { label: "Ready", cls: "text-moss" },
  completed: { label: "Completed", cls: "text-moss" },
  failed: { label: "Failed", cls: "text-crit" },
  error: { label: "Error", cls: "text-crit" },
  cancelled: { label: "Cancelled", cls: "text-ink-3" },
};

export default function StatusPill({ status }) {
  const s = STATUS[status] || { label: status || "Unknown", cls: "text-ink-3" };
  return (
    <span className={`inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-wider ${s.cls}`}>
      <span className="relative flex h-2 w-2">
        {s.pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" />}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      {s.label}
    </span>
  );
}
