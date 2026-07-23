import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

let initialized = false;

export default function MermaidRenderer({ chart }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    if (!initialized) {
      mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
      initialized = true;
    }

    if (!chart) return;

    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, chart)
      .then(({ svg: renderedSvg }) => {
        setSvg(renderedSvg);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [chart]);

  if (error) {
    return (
      <div className="atlas-card p-4 text-sm text-atlas-critical">
        Failed to render diagram: {error}
        <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">{chart}</pre>
      </div>
    );
  }

  return <div ref={containerRef} className="atlas-card p-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}
