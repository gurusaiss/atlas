/**
 * The seven-agent pipeline drawn as a trail map: one planner, four specialists
 * running in parallel lanes, then the critic and evaluator. Two markers walk the
 * parallel lanes at the same time; stations light up as a marker passes.
 * Pure SVG + CSS, and it freezes under prefers-reduced-motion.
 */

const LANES = [
  { y: 46, label: "Documentation" },
  { y: 124, label: "Decomposition" },
  { y: 206, label: "Test generation" },
  { y: 284, label: "Security" },
];
const SPINE_Y = 165;
const CYCLE = 9; // seconds

function lanePath(y) {
  return `M122 ${SPINE_Y} C 200 ${SPINE_Y}, 224 ${y}, 306 ${y} C 386 ${y}, 410 ${SPINE_Y}, 486 ${SPINE_Y}`;
}

function Station({ x, y, label, delay, anchor = "middle", dy = 22, big = false }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={big ? 7 : 5.5}
        className="station-dot"
        style={{ "--d": `${delay}s`, "--cycle": `${CYCLE}s` }}
        strokeWidth="1.5"
      />
      <text x={x} y={y + dy} textAnchor={anchor} className="fill-ink-2 font-mono" style={{ fontSize: 10.5, letterSpacing: "0.04em" }}>
        {label}
      </text>
    </g>
  );
}

export default function PipelineTrail({ className = "" }) {
  const secPath = `M26 ${SPINE_Y} H122 C 200 ${SPINE_Y}, 224 284, 306 284 C 386 284, 410 ${SPINE_Y}, 486 ${SPINE_Y} H 612`;
  const docPath = `M26 ${SPINE_Y} H122 C 200 ${SPINE_Y}, 224 46, 306 46 C 386 46, 410 ${SPINE_Y}, 486 ${SPINE_Y} H 612`;

  return (
    <svg
      viewBox="0 -18 640 348"
      className={className}
      role="img"
      aria-label="Diagram of the Atlas pipeline: a planner feeds four parallel agents (documentation, decomposition, test generation, security), then a critic and an evaluator."
    >
      <style>{`
        .station-dot { fill: rgb(var(--card)); stroke: rgb(var(--ink)); animation: station var(--cycle) linear infinite; animation-delay: var(--d); }
        @keyframes station {
          0% { fill: rgb(var(--accent)); stroke: rgb(var(--accent)); }
          9% { fill: rgb(var(--accent)); stroke: rgb(var(--accent)); }
          16%, 100% { fill: rgb(var(--card)); stroke: rgb(var(--ink)); }
        }
        @media (prefers-reduced-motion: reduce) { .station-dot { animation: none; } }
      `}</style>

      {/* trails */}
      <g fill="none" stroke="rgb(var(--ink-3))" strokeWidth="1.25" strokeLinecap="round">
        <path d={`M26 ${SPINE_Y} H122`} strokeDasharray="2 5" />
        <path d={`M486 ${SPINE_Y} H612`} strokeDasharray="2 5" />
        {LANES.map((l) => (
          <path key={l.label} d={lanePath(l.y)} opacity="0.75" />
        ))}
      </g>

      {/* origin + terminus */}
      <circle cx="26" cy={SPINE_Y} r="3.5" fill="rgb(var(--ink))" />
      <text x="26" y={SPINE_Y + 22} className="fill-ink-3 font-mono" style={{ fontSize: 10.5, letterSpacing: "0.04em" }}>
        repo
      </text>
      <path d={`M612 ${SPINE_Y - 8} L612 ${SPINE_Y + 8}`} stroke="rgb(var(--ink))" strokeWidth="2" strokeLinecap="round" />
      <text x="612" y={SPINE_Y + 24} textAnchor="end" className="fill-ink-3 font-mono" style={{ fontSize: 10.5, letterSpacing: "0.04em" }}>
        report
      </text>

      {/* stations */}
      <Station x={122} y={SPINE_Y} label="Planner" delay={CYCLE * 0.15} big />
      {LANES.map((l, i) => (
        <Station key={l.label} x={306} y={l.y} label={l.label} delay={CYCLE * 0.46} dy={i === 3 ? 24 : -14} />
      ))}
      <Station x={486} y={SPINE_Y} label="Critic" delay={CYCLE * 0.77} big />
      <Station x={549} y={SPINE_Y} label="Evaluator" delay={CYCLE * 0.89} anchor="middle" dy={-16} />

      {/* walkers: two markers move through the parallel lanes together */}
      <g aria-hidden="true">
        <circle r="4" fill="rgb(var(--accent))">
          <animateMotion dur={`${CYCLE}s`} repeatCount="indefinite" path={secPath} />
        </circle>
        <circle r="4" fill="rgb(var(--accent))" opacity="0.55">
          <animateMotion dur={`${CYCLE}s`} repeatCount="indefinite" path={docPath} />
        </circle>
      </g>

      {/* parallel bracket */}
      <g stroke="rgb(var(--rule-strong))" strokeWidth="1" fill="none">
        <path d="M262 8 V 310" strokeDasharray="1 4" />
        <path d="M350 8 V 310" strokeDasharray="1 4" />
      </g>
      <text x="306" y="-4" textAnchor="middle" className="fill-ink-3 font-mono" style={{ fontSize: 9.5, letterSpacing: "0.14em" }}>
        IN PARALLEL
      </text>
    </svg>
  );
}
