import Editor from "@monaco-editor/react";

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

export default function CodeViewer({ code, filePath, height = "400px", highlightLines = [] }) {
  return (
    <div className="atlas-card overflow-hidden">
      {filePath && (
        <div className="px-4 py-2 border-b border-atlas-border text-xs text-gray-400 font-mono">{filePath}</div>
      )}
      <Editor
        height={height}
        language={inferLanguage(filePath)}
        theme="vs-dark"
        value={code || ""}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          renderLineHighlight: highlightLines.length ? "all" : "none",
        }}
        onMount={(editor, monaco) => {
          if (highlightLines.length) {
            editor.deltaDecorations(
              [],
              highlightLines.map((line) => ({
                range: new monaco.Range(line, 1, line, 1),
                options: { isWholeLine: true, className: "bg-red-500/10", linesDecorationsClassName: "bg-atlas-critical" },
              }))
            );
          }
        }}
      />
    </div>
  );
}
