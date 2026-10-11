import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, Position } from "reactflow";
import "reactflow/dist/style.css";
import { TONE_BG, TONE_TEXT, usePalette } from "../utils/colors.js";

const EFFORT_TONE = { Low: "moss", Medium: "ochre", High: "crit" };

export default function MicroservicesGraph({ services = [], onSelect }) {
  const palette = usePalette();
  const [selected, setSelected] = useState(null);

  const { nodes, edges } = useMemo(() => {
    const n = services.map((svc, i) => ({
      id: svc.name,
      position: { x: (i % 3) * 270, y: Math.floor(i / 3) * 150 },
      data: { label: svc.name, service: svc },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: palette.card,
        border: `1.5px solid ${palette[EFFORT_TONE[svc.migration_effort]] || palette.ruleStrong}`,
        borderRadius: 3,
        color: palette.ink,
        padding: 12,
        width: 220,
        fontSize: 13,
        fontFamily: '"Instrument Sans", sans-serif',
        fontWeight: 600,
        boxShadow: `3px 3px 0 ${palette.rule}`,
      },
    }));

    // Edges follow the recommended extraction order, approximating a migration path.
    const sorted = [...services].sort((a, b) => (a.extract_order || 0) - (b.extract_order || 0));
    const e = sorted.slice(0, -1).map((svc, i) => ({
      id: `${svc.name}->${sorted[i + 1].name}`,
      source: svc.name,
      target: sorted[i + 1].name,
      markerEnd: { type: MarkerType.ArrowClosed, color: palette.ink3 },
      style: { stroke: palette.ink3, strokeWidth: 1.25 },
      label: "then",
      labelStyle: { fill: palette.ink3, fontSize: 10 },
      labelBgStyle: { fill: palette.card },
    }));

    return { nodes: n, edges: e };
  }, [services, palette]);

  function handleNodeClick(_, node) {
    setSelected(node.data.service);
    onSelect?.(node.data.service);
  }

  const ordered = [...services].sort((a, b) => (a.extract_order || 0) - (b.extract_order || 0));

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="panel" style={{ height: 400 }}>
          <ReactFlow nodes={nodes} edges={edges} onNodeClick={handleNodeClick} fitView proOptions={{ hideAttribution: true }} nodesConnectable={false}>
            <Background color={palette.rule} gap={22} size={1.2} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="panel p-5">
          <ul className="mb-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
            {Object.entries(EFFORT_TONE).map(([label, tone]) => (
              <li key={label} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 ${TONE_BG[tone]}`} />
                {label} effort
              </li>
            ))}
          </ul>

          {selected ? (
            <div key={selected.name} className="animate-fade space-y-4 text-sm">
              <div>
                <h3 className="text-xl">{selected.name}</h3>
                <p className="mt-1 leading-6 text-ink-2">{selected.responsibility}</p>
              </div>
              <p className="num text-xs text-ink-3">
                Extract #{selected.extract_order} ·{" "}
                <span className={TONE_TEXT[EFFORT_TONE[selected.migration_effort]]}>{selected.migration_effort} effort</span>
              </p>
              <div>
                <p className="eyebrow mb-1.5">Files</p>
                <ul className="space-y-0.5 font-mono text-xs text-ink-2">
                  {selected.files?.map((f) => (
                    <li key={f} className="break-all">{f}</li>
                  ))}
                </ul>
              </div>
              {selected.api_surface?.length > 0 && (
                <div>
                  <p className="eyebrow mb-1.5">API surface</p>
                  <ul className="space-y-0.5 font-mono text-xs text-ink-2">
                    {selected.api_surface.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm leading-6 text-ink-3">Select a service on the map to see its files, API surface and migration effort.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="eyebrow mb-3">Suggested extraction order</h3>
        <ol className="panel divide-y divide-rule">
          {ordered.map((svc, i) => (
            <li key={svc.name}>
              <button
                onClick={() => handleNodeClick(null, { data: { service: svc } })}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-sunk/60"
              >
                <span className="num w-6 text-sm text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 font-display text-lg text-ink">{svc.name}</span>
                <span className={`font-mono text-[0.6875rem] uppercase tracking-wider ${TONE_TEXT[EFFORT_TONE[svc.migration_effort]]}`}>{svc.migration_effort}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
