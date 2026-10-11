import { useMemo, useState } from "react";
import * as d3 from "d3";
import { COMPLEXITY_BANDS, TONE_BG, complexityTone, usePalette } from "../utils/colors.js";
import { EmptyState } from "./QueryState.jsx";
import { compactNumber } from "../utils/format.js";

const WIDTH = 760;

function fitLabel(name, width) {
  const max = Math.floor((width - 14) / 6.4);
  if (name.length <= max) return name;
  return max > 3 ? `${name.slice(0, max - 1)}…` : "";
}
const HEIGHT = 420;

export default function ComplexityHeatmap({ files = [] }) {
  const palette = usePalette();
  const [hovered, setHovered] = useState(null);

  const leaves = useMemo(() => {
    if (!files.length) return [];
    const root = d3
      .hierarchy({ children: files })
      .sum((d) => Math.max(d.loc || 1, 1))
      .sort((a, b) => b.value - a.value);
    d3.treemap().size([WIDTH, HEIGHT]).padding(3).round(true)(root);
    return root.leaves();
  }, [files]);

  const hotspots = useMemo(
    () => [...files].sort((a, b) => (b.cyclomatic_complexity || 0) - (a.cyclomatic_complexity || 0)).slice(0, 6),
    [files]
  );
  const maxComplexity = Math.max(...hotspots.map((f) => f.cyclomatic_complexity || 0), 1);
  const totalDebt = files.reduce((sum, f) => sum + (f.technical_debt_minutes || 0), 0);

  if (!files.length) {
    return <EmptyState title="No file metrics yet." message="Metrics appear once the repository has been parsed and analysed." seed="metrics" />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <div className="panel p-4">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Treemap of files sized by lines of code and colored by cyclomatic complexity">
            {leaves.map((leaf) => {
              const file = leaf.data;
              const w = leaf.x1 - leaf.x0;
              const h = leaf.y1 - leaf.y0;
              const tone = complexityTone(file.cyclomatic_complexity || 0);
              const active = hovered?.file_path === file.file_path;
              return (
                <g
                  key={file.file_path}
                  transform={`translate(${leaf.x0}, ${leaf.y0})`}
                  onMouseEnter={() => setHovered(file)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "default" }}
                >
                  <rect
                    width={w}
                    height={h}
                    fill={palette[tone]}
                    fillOpacity={active ? 1 : 0.82}
                    stroke={active ? palette.ink : "none"}
                    strokeWidth={active ? 2 : 0}
                    style={{ transition: "fill-opacity 150ms" }}
                  />
                  {w > 50 && h > 22 && (
                    <text x={7} y={16} fontSize={10.5} fill={palette.paper} fontFamily='"IBM Plex Mono", monospace' fontWeight={500} style={{ pointerEvents: "none" }}>
                      {fitLabel(file.file_path.split("/").pop(), w)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="mt-3 flex min-h-[1.5rem] flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-2">
              {COMPLEXITY_BANDS.map((b) => (
                <li key={b.tone} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 ${TONE_BG[b.tone]}`} />
                  {b.label} <span className="num text-ink-3">{b.range}</span>
                </li>
              ))}
            </ul>
            <p className="num text-xs text-ink-2" aria-live="polite">
              {hovered ? `${hovered.file_path} · complexity ${hovered.cyclomatic_complexity} · ${hovered.loc} lines` : "Hover a block for details"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-3">Block size is lines of code. Colour is cyclomatic complexity.</p>
      </div>

      <div>
        <h3 className="eyebrow mb-4">Hotspots</h3>
        <ol className="panel divide-y divide-rule">
          {hotspots.map((f, i) => {
            const tone = complexityTone(f.cyclomatic_complexity || 0);
            return (
              <li key={f.file_path} className="px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-mono text-[0.8125rem] text-ink" title={f.file_path}>
                    <span className="num mr-2 text-ink-3">{i + 1}</span>
                    {f.file_path.split("/").pop()}
                  </p>
                  <p className="num shrink-0 text-xs text-ink-3">{f.cyclomatic_complexity}</p>
                </div>
                <div className="mt-2 h-1 bg-rule">
                  <div className={`h-full ${TONE_BG[tone]}`} style={{ width: `${((f.cyclomatic_complexity || 0) / maxComplexity) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-rule pt-5">
          <div>
            <dt className="eyebrow">Files</dt>
            <dd className="display mt-1 text-2xl tabular-nums">{files.length}</dd>
          </div>
          <div>
            <dt className="eyebrow">Est. debt</dt>
            <dd className="display mt-1 text-2xl tabular-nums">{compactNumber(Math.round(totalDebt / 60))}<span className="ml-1 font-sans text-sm text-ink-3">hrs</span></dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
