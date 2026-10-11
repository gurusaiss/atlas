import { useEffect, useState } from "react";
import mermaid from "mermaid";
import { useThemeStore } from "../store/themeStore.js";
import { PALETTE } from "../utils/colors.js";

function configure(theme) {
  const p = PALETTE[theme] || PALETTE.light;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    fontFamily: '"Instrument Sans", system-ui, sans-serif',
    themeVariables: {
      background: p.card,
      primaryColor: p.card,
      primaryBorderColor: p.ink,
      primaryTextColor: p.ink,
      secondaryColor: p.sunk,
      secondaryBorderColor: p.ruleStrong,
      tertiaryColor: p.paper,
      lineColor: p.ink3,
      textColor: p.ink,
      clusterBkg: p.sunk,
      clusterBorder: p.ruleStrong,
      edgeLabelBackground: p.card,
      fontSize: "14px",
    },
  });
}

export default function MermaidRenderer({ chart, caption }) {
  const theme = useThemeStore((s) => s.theme);
  const [error, setError] = useState(null);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    if (!chart) return undefined;
    let cancelled = false;
    configure(theme);
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, chart)
      .then(({ svg: rendered }) => {
        if (cancelled) return;
        setSvg(rendered);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [chart, theme]);

  if (error) {
    return (
      <div className="panel border-l-2 !border-l-crit p-5 text-sm" role="alert">
        <p className="font-display text-lg text-ink">The diagram couldn't be drawn</p>
        <p className="mt-1 text-ink-2">{error}</p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap bg-sunk p-3 text-xs text-ink-3">{chart}</pre>
      </div>
    );
  }

  return (
    <figure className="panel overflow-x-auto p-5">
      {svg ? (
        <div className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="skeleton mx-auto h-48 w-full max-w-xl" aria-label="Rendering diagram" />
      )}
      {caption && <figcaption className="eyebrow mt-4 text-center">{caption}</figcaption>}
    </figure>
  );
}
