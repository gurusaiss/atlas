import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import CodeViewer from "./CodeViewer.jsx";

const SEVERITY_STYLES = {
  critical: "bg-red-950 text-atlas-critical border-red-900",
  high: "bg-orange-950 text-orange-400 border-orange-900",
  medium: "bg-amber-950 text-atlas-warning border-amber-900",
  low: "bg-blue-950 text-blue-400 border-blue-900",
  info: "bg-gray-800 text-gray-400 border-gray-700",
};

export default function SecurityFindingCard({ finding, onMarkFalsePositive }) {
  const [expanded, setExpanded] = useState(false);
  const severityStyle = SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES.info;

  return (
    <div className={`atlas-card border-l-4 ${severityStyle.split(" ").find((c) => c.startsWith("border"))}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <span className={`atlas-badge ${severityStyle}`}>{finding.severity?.toUpperCase()}</span>
          <span className="text-sm font-medium">{finding.title}</span>
        </div>
        <span className="text-xs text-gray-500 font-mono">
          {finding.file_path}:{finding.line_start}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-sm text-gray-300">{finding.description}</p>

          {finding.code_snippet && (
            <CodeViewer
              code={finding.code_snippet}
              filePath={finding.file_path}
              height="120px"
              highlightLines={finding.line_start ? [finding.line_start] : []}
            />
          )}

          {finding.suggested_fix && (
            <div className="bg-green-950/30 border border-green-900 rounded p-3">
              <p className="text-xs text-atlas-success font-medium mb-1">Suggested fix</p>
              <p className="text-sm text-gray-300">{finding.suggested_fix}</p>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {finding.owasp_category && `${finding.owasp_category} -- ${finding.owasp_title || ""}`}
              {finding.cwe_id && ` · ${finding.cwe_id}`}
              {finding.source && ` · detected by ${finding.source}`}
            </span>
            {onMarkFalsePositive && !finding.is_false_positive && (
              <button
                onClick={() => onMarkFalsePositive(finding.id)}
                className="text-atlas-accent hover:underline"
              >
                Mark as false positive
              </button>
            )}
            {finding.is_false_positive && <span className="text-gray-600">Marked as false positive</span>}
          </div>
        </div>
      )}
    </div>
  );
}
