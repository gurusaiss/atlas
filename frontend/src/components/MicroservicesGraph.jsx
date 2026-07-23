import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType } from "reactflow";
import "reactflow/dist/style.css";

const EFFORT_COLORS = { Low: "#10b981", Medium: "#f59e0b", High: "#ef4444" };

export default function MicroservicesGraph({ services = [], onSelect }) {
  const [selected, setSelected] = useState(null);

  const { nodes, edges } = useMemo(() => {
    const n = services.map((svc, i) => ({
      id: svc.name,
      position: { x: (i % 3) * 260, y: Math.floor(i / 3) * 160 },
      data: { label: svc.name, service: svc },
      style: {
        background: "#161922",
        border: `2px solid ${EFFORT_COLORS[svc.migration_effort] || "#242836"}`,
        borderRadius: 8,
        color: "#f3f4f6",
        padding: 10,
        width: 220,
        fontSize: 13,
      },
    }));

    // Edge from lowest-extract-order service to the next, approximating a migration path.
    const sorted = [...services].sort((a, b) => (a.extract_order || 0) - (b.extract_order || 0));
    const e = sorted.slice(0, -1).map((svc, i) => ({
      id: `${svc.name}->${sorted[i + 1].name}`,
      source: svc.name,
      target: sorted[i + 1].name,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#4b5563" },
      label: "extract next",
      labelStyle: { fill: "#6b7280", fontSize: 10 },
    }));

    return { nodes: n, edges: e };
  }, [services]);

  function handleNodeClick(_, node) {
    setSelected(node.data.service);
    onSelect?.(node.data.service);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 atlas-card" style={{ height: 420 }}>
        <ReactFlow nodes={nodes} edges={edges} onNodeClick={handleNodeClick} fitView proOptions={{ hideAttribution: true }}>
          <Background color="#242836" gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      <div className="atlas-card p-4">
        <div className="flex gap-3 mb-4 text-xs">
          {Object.entries(EFFORT_COLORS).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>

        {selected ? (
          <div className="space-y-2 text-sm">
            <h3 className="font-medium">{selected.name}</h3>
            <p className="text-gray-400">{selected.responsibility}</p>
            <p className="text-xs text-gray-500">Migration effort: {selected.migration_effort}</p>
            <p className="text-xs text-gray-500">Extract order: #{selected.extract_order}</p>
            <div>
              <p className="text-xs text-gray-500 mb-1">Files</p>
              <ul className="text-xs font-mono text-gray-400 space-y-0.5">
                {selected.files?.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            {selected.api_surface?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">API surface</p>
                <ul className="text-xs font-mono text-gray-400 space-y-0.5">
                  {selected.api_surface.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Click a service node to see details.</p>
        )}
      </div>
    </div>
  );
}
