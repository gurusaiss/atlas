import { useState } from "react";
import { ChevronRight } from "lucide-react";
import CodeViewer from "./CodeViewer.jsx";
import { SEVERITIES, TONE_BORDER, TONE_TEXT } from "../utils/colors.js";

const SEVERITY_TONE = Object.fromEntries(SEVERITIES.map((s) => [s.key, s.tone]));

export default function SecurityFindingCard({ finding, onMarkFalsePositive }) {
  const [expanded, setExpanded] = useState(false);
  const tone = SEVERITY_TONE[finding.severity] || "ink3";
  const dismissed = finding.is_false_positive;

  return (
    <article className={`panel border-l-[3px] ${TONE_BORDER[tone]} transition-opacity ${dismissed ? "opacity-55" : ""}`}>
      <button
        className="group flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-start gap-3">
          <ChevronRight className={`mt-1 h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200 ${expanded ? "rotate-90 text-ink" : "group-hover:translate-x-0.5"}`} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`stamp ${TONE_TEXT[tone]}`}>{finding.severity}</span>
              <h3 className={`font-display text-lg leading-snug text-ink ${dismissed ? "line-through decoration-ink-3" : ""}`}>{finding.title}</h3>
            </div>
            <p className="mt-1.5 truncate font-mono text-xs text-ink-3">
              {finding.file_path}
              {finding.line_start ? `:${finding.line_start}` : ""}
            </p>
          </div>
        </div>
        {finding.cwe_id && <span className="chip hidden shrink-0 sm:inline-flex">{finding.cwe_id}</span>}
      </button>

      {expanded && (
        <div className="animate-fade space-y-4 border-t border-rule px-5 pb-5 pt-4 sm:pl-12">
          <p className="text-[0.9375rem] leading-7 text-ink-2">{finding.description}</p>

          {finding.code_snippet && (
            <CodeViewer
              code={finding.code_snippet}
              filePath={finding.file_path}
              height={`${Math.min(finding.code_snippet.split("\n").length * 20 + 28, 280)}px`}
              startLine={finding.line_start || 1}
              highlightLines={
                finding.line_start
                  ? Array.from(
                      { length: Math.min(Math.max((finding.line_end || finding.line_start) - finding.line_start + 1, 1), 8) },
                      (_, i) => i + 1
                    )
                  : []
              }
            />
          )}

          {finding.suggested_fix && (
            <div className="border-l-2 border-moss bg-moss/10 px-4 py-3">
              <p className="eyebrow !text-moss">Suggested fix</p>
              <p className="mt-1 text-sm leading-6 text-ink">{finding.suggested_fix}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-ink-3">
            <p className="font-mono">
              {[finding.owasp_category && `${finding.owasp_category} ${finding.owasp_title || ""}`.trim(), finding.source && `via ${finding.source}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {onMarkFalsePositive && !dismissed && (
              <button onClick={() => onMarkFalsePositive(finding.id)} className="link text-[0.8125rem]">
                Mark as false positive
              </button>
            )}
            {dismissed && <span>Dismissed as a false positive</span>}
          </div>
        </div>
      )}
    </article>
  );
}
