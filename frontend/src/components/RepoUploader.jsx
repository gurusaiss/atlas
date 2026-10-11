import { useRef, useState } from "react";
import { FileArchive, Github, Loader2 } from "lucide-react";
import { useAddGithubRepository, useUploadRepository } from "../hooks/useAtlas.js";
import { describeError } from "./QueryState.jsx";
import { toast } from "../store/toastStore.js";

const MAX_UPLOAD_MB = 50;
const GITHUB_URL_PATTERN = /^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+\/?$/i;

const MODES = [
  { id: "upload", label: "Upload ZIP" },
  { id: "github", label: "GitHub URL" },
];

export default function RepoUploader({ projectId }) {
  const [mode, setMode] = useState("upload");
  const [githubUrl, setGithubUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const upload = useUploadRepository(projectId);
  const addGithub = useAddGithubRepository(projectId);

  async function handleFile(file) {
    if (!file) return;
    setError("");

    // Fail fast on an obviously wrong file instead of waiting on a multi-MB
    // round trip to a 413. The backend enforces the same limits.
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Only .zip files are supported.");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`That file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is ${MAX_UPLOAD_MB} MB.`);
      return;
    }

    try {
      await upload.mutateAsync(file);
      toast.success(`${file.name} uploaded. Parsing starts automatically.`);
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function handleGithubSubmit(e) {
    e.preventDefault();
    setError("");

    if (!GITHUB_URL_PATTERN.test(githubUrl.trim())) {
      setError("Enter a public GitHub URL, like https://github.com/owner/repo");
      return;
    }

    try {
      await addGithub.mutateAsync({ githubUrl: githubUrl.trim(), branch: branch.trim() || "main" });
      toast.success("Repository cloned. Parsing starts automatically.");
      setGithubUrl("");
    } catch (err) {
      setError(describeError(err));
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (upload.isPending) return;
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="panel">
      <div role="tablist" aria-label="Add a repository" className="flex border-b border-rule">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => {
              setMode(m.id);
              setError("");
            }}
            className={`relative flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mode === m.id ? "text-ink" : "text-ink-3 hover:text-ink"
            }`}
          >
            {m.label}
            <span
              className={`absolute inset-x-0 -bottom-px h-0.5 origin-left bg-accent transition-transform duration-200 ${
                mode === m.id ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="p-5">
        {error && (
          <p role="alert" className="mb-4 animate-pop border-l-2 border-crit bg-crit/10 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}

        {mode === "upload" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
              className={`flex w-full flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition-all duration-200 ${
                dragging
                  ? "scale-[1.01] border-accent bg-accent/5"
                  : "border-rule-strong hover:border-ink-3 hover:bg-sunk/50"
              } disabled:cursor-wait`}
              style={{ borderRadius: 3 }}
            >
              {upload.isPending ? (
                <Loader2 className="h-7 w-7 animate-spin text-accent" />
              ) : (
                <FileArchive className={`h-7 w-7 transition-colors ${dragging ? "text-accent" : "text-ink-3"}`} strokeWidth={1.5} />
              )}
              <span className="text-sm font-medium text-ink">
                {upload.isPending ? "Uploading…" : dragging ? "Drop to upload" : "Drop a .zip here, or browse"}
              </span>
              <span className="font-mono text-xs text-ink-3">Up to {MAX_UPLOAD_MB} MB</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        ) : (
          <form onSubmit={handleGithubSubmit} className="space-y-5">
            <label className="block">
              <span className="field-label flex items-center gap-1.5">
                <Github className="h-3 w-3" /> Repository URL
              </span>
              <input
                className="field"
                placeholder="https://github.com/owner/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                required
                inputMode="url"
              />
            </label>
            <label className="block">
              <span className="field-label">Branch</span>
              <input className="field" placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </label>
            <button type="submit" disabled={addGithub.isPending} className="btn btn-primary w-full">
              {addGithub.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Cloning…
                </>
              ) : (
                "Add repository"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
