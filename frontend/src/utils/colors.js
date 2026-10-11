import { useThemeStore } from "../store/themeStore.js";

// Hex mirror of the CSS tokens in index.css. SVG attributes, React Flow styles,
// Monaco and Mermaid can't read CSS variables, so they take these values instead.
// Keep the two in sync.
export const PALETTE = {
  light: {
    paper: "#F3EEE3",
    card: "#FBF8F1",
    sunk: "#EAE4D6",
    ink: "#1B1A17",
    ink2: "#544F44",
    ink3: "#6E685A",
    rule: "#D9D2C0",
    ruleStrong: "#BEB6A0",
    accent: "#D6451F",
    moss: "#26624C",
    ochre: "#96620E",
    sky: "#2B4C7E",
    crit: "#9E1C34",
    high: "#B8540F",
  },
  dark: {
    paper: "#14130F",
    card: "#1C1B16",
    sunk: "#0E0D0A",
    ink: "#ECE7DA",
    ink2: "#B0AA9A",
    ink3: "#868071",
    rule: "#343129",
    ruleStrong: "#4E4A3F",
    accent: "#F0653A",
    moss: "#68BC9C",
    ochre: "#E0AC4A",
    sky: "#80A3D8",
    crit: "#EE6C82",
    high: "#EE924C",
  },
};

export function usePalette() {
  const theme = useThemeStore((s) => s.theme);
  return PALETTE[theme] || PALETTE.light;
}

/** Cyclomatic complexity -> semantic color key. */
export function complexityTone(value) {
  if (value <= 5) return "moss";
  if (value <= 10) return "sky";
  if (value <= 20) return "ochre";
  return "crit";
}

export const COMPLEXITY_BANDS = [
  { tone: "moss", label: "Simple", range: "1–5" },
  { tone: "sky", label: "Moderate", range: "6–10" },
  { tone: "ochre", label: "Complex", range: "11–20" },
  { tone: "crit", label: "Untestable", range: "21+" },
];

export const SEVERITIES = [
  { key: "critical", label: "Critical", tone: "crit" },
  { key: "high", label: "High", tone: "high" },
  { key: "medium", label: "Medium", tone: "ochre" },
  { key: "low", label: "Low", tone: "sky" },
  { key: "info", label: "Info", tone: "ink3" },
];

// Tailwind needs full class names to be present in source, so map tones explicitly.
export const TONE_TEXT = {
  moss: "text-moss",
  sky: "text-sky",
  ochre: "text-ochre",
  crit: "text-crit",
  high: "text-high",
  ink3: "text-ink-3",
};
export const TONE_BG = {
  moss: "bg-moss",
  sky: "bg-sky",
  ochre: "bg-ochre",
  crit: "bg-crit",
  high: "bg-high",
  ink3: "bg-ink-3",
};
export const TONE_BORDER = {
  moss: "border-moss",
  sky: "border-sky",
  ochre: "border-ochre",
  crit: "border-crit",
  high: "border-high",
  ink3: "border-ink-3",
};
