import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType } from "reactflow";
import "reactflow/dist/style.css";

function complexityColor(value) {
  if (value <= 5) return "#10b981";
  if (value <= 10) return "#3b82f6";
  if (value <= 20) return "#f59e0b";
  return "#ef4444";
}

/** Force-directed call graph: one node per file (sized by LOC, colored by
 * complexity), one edge per resolved function call between files. */
export default function CallGraphViewer({ nodes = [], edges = [], filterHighCouplingOnly = false }) {
  const [selected, setSelected] = useState(null);

  const { flowNodes, flowEdges } = useMemo(() => {
    const visibleNodes = filterHighCouplingOnly
      ? nodes.filter((n) => (n.coupling_score || 0) >= 0.3)
      : nodes;
    const visiblePaths = new Set(visibleNodes.map((n) => n.file_path));

    // Simple circular layout -- no physics simulation dependency needed for a
    // few dozen file-level nodes; React Flow's fitView handles the rest.
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
        background: "#161922",
        border: `2px solid ${complexityColor(n.cyclomatic_complexity || 0)}`,
        borderRadius: 6,
        color: "#f3f4f6",
        padding: 8,
        fontSize: 11,
        width: Math.min(60 + Math.sqrt(n.loc || 1) * 8, 220),
      },
    }));

    const flowEdges = edges
      .filter((e) => visiblePaths.has(e.caller_file) && visiblePaths.has(e.callee_file))
      .filter((e) => e.caller_file !== e.callee_file) // only cross-file calls are interesting here
      .map((e, i) => ({
        id: `${e.caller_file}->${e.callee_file}-${i}`,
        source: e.caller_file,
        target: e.callee_file,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#4b5563", strokeWidth: Math.min(1 + Math.log(e.call_count || 1), 4) },
      }));

    return { flowNodes, flowEdges };
  }, [nodes, edges, filterHighCouplingOnly]);

  if (!nodes.length) {
    return <div className="atlas-card p-8 text-center text-gray-500">No call graph data available yet.</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 atlas-card" style={{ height: 520 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodeClick={(_, node) => setSelected(node.data.node)}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#242836" gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      <div className="atlas-card p-4">
        <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />Simple</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />Moderate</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />Complex</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />Untestable</span>
        </div>

        {selected ? (
          <div className="space-y-2 text-sm">
            <h3 className="font-mono text-xs break-all">{selected.file_path}</h3>
            <p className="text-xs text-gray-500">Language: {selected.language || "unknown"}</p>
            <p className="text-xs text-gray-500">LOC: {selected.loc}</p>
            <p className="text-xs text-gray-500">Cyclomatic complexity: {selected.cyclomatic_complexity}</p>
            <p className="text-xs text-gray-500">Coupling score: {selected.coupling_score?.toFixed(2)}</p>
            {selected.coupling_score >= 0.3 && (
              <p className="text-xs text-amber-400">
                High coupling -- unlikely to be a clean microservice boundary on its own.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Click a file node to see its metrics.</p>
        )}
      </div>
    </div>
  );
}
