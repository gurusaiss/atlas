import { useMemo, useState } from "react";
import * as d3 from "d3";

const WIDTH = 700;
const HEIGHT = 400;

function complexityColor(value) {
  if (value <= 5) return "#10b981";
  if (value <= 10) return "#3b82f6";
  if (value <= 20) return "#f59e0b";
  return "#ef4444";
}

export default function ComplexityHeatmap({ files = [] }) {
  const [hovered, setHovered] = useState(null);

  const leaves = useMemo(() => {
    if (!files.length) return [];

    const root = d3
      .hierarchy({ children: files })
      .sum((d) => Math.max(d.loc || 1, 1))
      .sort((a, b) => b.value - a.value);

    d3.treemap().size([WIDTH, HEIGHT]).padding(2)(root);
    return root.leaves();
  }, [files]);

  if (!files.length) {
    return <div className="atlas-card p-8 text-center text-gray-500">No file metrics available.</div>;
  }

  return (
    <div className="atlas-card p-4">
      <svg width={WIDTH} height={HEIGHT} className="w-full h-auto">
        {leaves.map((leaf) => {
          const file = leaf.data;
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          return (
            <g
              key={file.file_path}
              transform={`translate(${leaf.x0}, ${leaf.y0})`}
              onMouseEnter={() => setHovered(file)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                width={w}
                height={h}
                fill={complexityColor(file.cyclomatic_complexity || 0)}
                fillOpacity={0.85}
                stroke="#0f1117"
                strokeWidth={1}
              />
              {w > 60 && h > 20 && (
                <text x={4} y={14} fontSize={10} fill="#0f1117" fontWeight={600}>
                  {file.file_path.split("/").pop()}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />Simple (&le;5)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />Moderate (6-10)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />Complex (11-20)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />Untestable (21+)</span>
        </div>
        {hovered && (
          <span className="text-xs text-gray-300 font-mono">
            {hovered.file_path} -- complexity {hovered.cyclomatic_complexity}, {hovered.loc} LOC
          </span>
        )}
      </div>
    </div>
  );
}
