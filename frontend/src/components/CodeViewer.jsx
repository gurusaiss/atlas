import Editor from "@monaco-editor/react";
import { useThemeStore } from "../store/themeStore.js";
import { PALETTE } from "../utils/colors.js";

const LANGUAGE_MAP = {
  py: "python",
  java: "java",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  go: "go",
  rb: "ruby",
  rs: "rust",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "shell",
  yaml: "yaml",
  yml: "yaml",
  json: "json",
  md: "markdown",
  sql: "sql",
};

function inferLanguage(filePath = "") {
  const ext = filePath.split(".").pop();
  return LANGUAGE_MAP[ext] || "plaintext";
}

const strip = (hex) => hex.replace("#", "");

function defineThemes(monaco) {
  const light = PALETTE.light;
  const dark = PALETTE.dark;
  monaco.editor.defineTheme("atlas-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: strip("#8A8473"), fontStyle: "italic" },
      { token: "keyword", foreground: strip("#AF3414") },
      { token: "string", foreground: strip(light.moss) },
      { token: "number", foreground: strip(light.sky) },
      { token: "type", foreground: strip(light.high) },
    ],
    colors: {
      "editor.background": light.card,
      "editor.foreground": light.ink,
      "editorLineNumber.foreground": "#A59F8C",
      "editorLineNumber.activeForeground": light.ink,
      "editor.lineHighlightBackground": light.sunk,
      "editor.selectionBackground": "#D6451F33",
      "editorCursor.foreground": light.accent,
      "editorIndentGuide.background1": light.rule,
      "scrollbarSlider.background": "#BEB6A055",
    },
  });
  monaco.editor.defineTheme("atlas-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: strip("#7A7463"), fontStyle: "italic" },
      { token: "keyword", foreground: strip("#F7845E") },
      { token: "string", foreground: strip(dark.moss) },
      { token: "number", foreground: strip(dark.sky) },
      { token: "type", foreground: strip(dark.high) },
    ],
    colors: {
      "editor.background": dark.card,
      "editor.foreground": dark.ink,
      "editorLineNumber.foreground": "#5E5948",
      "editorLineNumber.activeForeground": dark.ink,
      "editor.lineHighlightBackground": "#24231C",
      "editor.selectionBackground": "#F0653A44",
      "editorCursor.foreground": dark.accent,
      "editorIndentGuide.background1": dark.rule,
      "scrollbarSlider.background": "#4E4A3F66",
    },
  });
}

/** `startLine` renumbers the gutter so a snippet shows its real position in the file. */
export default function CodeViewer({ code, filePath, height = "400px", highlightLines = [], startLine = 1 }) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <div className="panel overflow-hidden">
      {filePath && (
        <div className="flex items-center gap-2 border-b border-rule bg-sunk/60 px-4 py-2 font-mono text-xs text-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          {filePath}
        </div>
      )}
      <Editor
        height={height}
        language={inferLanguage(filePath)}
        theme={theme === "dark" ? "atlas-dark" : "atlas-light"}
        value={code || ""}
        loading={<div className="skeleton m-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]" />}
        beforeMount={defineThemes}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontSize: 12.5,
          lineHeight: 20,
          padding: { top: 12, bottom: 12 },
          scrollBeyondLastLine: false,
          renderLineHighlight: highlightLines.length ? "all" : "none",
          overviewRulerLanes: 0,
          lineNumbers: startLine > 1 ? (n) => String(n + startLine - 1) : "on",
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        }}
        onMount={(editor, monaco) => {
          if (highlightLines.length) {
            editor.deltaDecorations(
              [],
              highlightLines.map((line) => ({
                range: new monaco.Range(line, 1, line, 1),
                options: { isWholeLine: true, className: "atlas-hl-line", linesDecorationsClassName: "atlas-hl-gutter" },
              }))
            );
          }
        }}
      />
    </div>
  );
}
