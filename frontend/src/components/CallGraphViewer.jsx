import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import { COMPLEXITY_BANDS, TONE_BG, complexityTone, usePalette } from "../utils/colors.js";
import { EmptyState } from "./QueryState.jsx";

/** One node per file (sized by LOC, outlined by complexity), one edge per
 * resolved cross-file call. */
export default function CallGraphViewer({ nodes = [], edges = [], filterHighCouplingOnly = false }) {
  const palette = usePalette();
  const [selected, setSelected] = useState(null);

  const { flowNodes, flowEdges } = useMemo(() => {
    const visibleNodes = filterHighCouplingOnly ? nodes.filter((n) => (n.coupling_score || 0) >= 0.3) : nodes;
    const visiblePaths = new Set(visibleNodes.map((n) => n.file_path));

    // A simple ring layout is plenty for a few dozen files; fitView does the rest.
    const angleStep = (2 * Math.PI) / Math.max(visibleNodes.length, 1);
    const radius = Math.max(160, visibleNodes.length * 18);

    const flowNodes = visibleNodes.map((n, i) => ({
      id: n.file_path,
      position: {
        x: radius * Math.cos(i * angleStep) + radius,
        y: radius * Math.sin(i * angleStep) + radius,
      },
      data: { label: n.file_path.split("/").pop(), node: n },
      style: {
        background: palette.card,
        border: `1.5px solid ${palette[complexityTone(n.cyclomatic_complexity || 0)]}`,
        borderRadius: 3,
        color: palette.ink,
        padding: 8,
        fontSize: 11,
        fontFamily: '"IBM Plex Mono", monospace',
        width: Math.min(60 + Math.sqrt(n.loc || 1) * 8, 220),
      },
    }));

    const flowEdges = edges
      .filter((e) => visiblePaths.has(e.caller_file) && visiblePaths.has(e.callee_file))
      .filter((e) => e.caller_file !== e.callee_file)
      .map((e, i) => ({
        id: `${e.caller_file}->${e.callee_file}-${i}`,
        source: e.caller_file,
        target: e.callee_file,
        markerEnd: { type: MarkerType.ArrowClosed, color: palette.ink3 },
        style: { stroke: palette.ink3, strokeWidth: Math.min(1 + Math.log(e.call_count || 1), 4), opacity: 0.8 },
      }));

    return { flowNodes, flowEdges };
  }, [nodes, edges, filterHighCouplingOnly, palette]);

  if (!nodes.length) {
    return <EmptyState title="No call graph yet." message="The graph is built when a repository is first analysed." seed="callgraph" />;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.8fr_1fr]">
      <div className="panel" style={{ height: 540 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodeClick={(_, node) => setSelected(node.data.node)}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
        >
          <Background color={palette.rule} gap={22} size={1.2} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="panel p-5">
        <ul className="mb-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
          {COMPLEXITY_BANDS.map((b) => (
            <li key={b.tone} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 ${TONE_BG[b.tone]}`} />
              {b.label}
            </li>
          ))}
        </ul>

        {selected ? (
          <div key={selected.file_path} className="animate-fade space-y-4">
            <h3 className="break-all font-mono text-sm text-ink">{selected.file_path}</h3>
            <dl className="grid grid-cols-2 gap-4">
              {[
                ["Language", selected.language || "unknown"],
                ["Lines", selected.loc],
                ["Complexity", selected.cyclomatic_complexity],
                ["Coupling", selected.coupling_score?.toFixed(2)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="eyebrow">{k}</dt>
                  <dd className="display mt-0.5 text-xl tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            {selected.coupling_score >= 0.3 && (
              <p className="border-l-2 border-ochre bg-ochre/10 px-3 py-2 text-sm leading-5 text-ink-2">
                Highly coupled: unlikely to be a clean service boundary on its own.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm leading-6 text-ink-3">Select a file on the graph to see its metrics.</p>
        )}
      </div>
    </div>
  );
}
