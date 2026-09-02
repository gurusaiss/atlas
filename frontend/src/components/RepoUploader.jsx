import { useState } from "react";
import { Github, UploadCloud } from "lucide-react";
import { useAddGithubRepository, useUploadRepository } from "../hooks/useAtlas.js";
import { describeError } from "./QueryState.jsx";
import { toast } from "../store/toastStore.js";

const MAX_UPLOAD_MB = 50;
const GITHUB_URL_PATTERN = /^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+\/?$/i;

export default function RepoUploader({ projectId }) {
  const [mode, setMode] = useState("upload");
  const [githubUrl, setGithubUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [error, setError] = useState("");
  const upload = useUploadRepository(projectId);
  const addGithub = useAddGithubRepository(projectId);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    // Validate before spending bandwidth on a doomed upload -- the backend
    // enforces the same limits, but failing fast here is a much better UX for
    // an obviously-wrong file than waiting on a multi-MB round trip to 413.
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Only .zip files are supported.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`File is ${(file.size / (1024 * 1024)).toFixed(1)}MB — max is ${MAX_UPLOAD_MB}MB.`);
      e.target.value = "";
      return;
    }

    try {
      await upload.mutateAsync(file);
      toast.success(`${file.name} uploaded — parsing will start automatically.`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      e.target.value = "";
    }
  }

  async function handleGithubSubmit(e) {
    e.preventDefault();
    setError("");

    if (!GITHUB_URL_PATTERN.test(githubUrl.trim())) {
      setError("Enter a public GitHub URL like https://github.com/owner/repo");
      return;
    }

    try {
      await addGithub.mutateAsync({ githubUrl: githubUrl.trim(), branch: branch.trim() || "main" });
      toast.success("Repository cloned — parsing will start automatically.");
      setGithubUrl("");
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="atlas-card p-5">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("upload")}
          className={`text-sm px-3 py-1.5 rounded ${mode === "upload" ? "bg-atlas-accent text-white" : "text-gray-400"}`}
        >
          Upload ZIP
        </button>
        <button
          onClick={() => setMode("github")}
          className={`text-sm px-3 py-1.5 rounded ${mode === "github" ? "bg-atlas-accent text-white" : "text-gray-400"}`}
        >
          GitHub URL
        </button>
      </div>

      {error && <p className="text-sm text-atlas-critical mb-3">{error}</p>}

      {mode === "upload" ? (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-atlas-border rounded-lg p-8 cursor-pointer hover:border-atlas-accent transition-colors">
          <UploadCloud className="w-8 h-8 text-gray-500" />
          <span className="text-sm text-gray-400">
            {upload.isPending ? "Uploading..." : "Click to select a .zip repository (max 50MB)"}
          </span>
          <input type="file" accept=".zip" className="hidden" onChange={handleFileChange} disabled={upload.isPending} />
        </label>
      ) : (
        <form onSubmit={handleGithubSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Github className="w-4 h-4 text-gray-500" />
            <input
              className="atlas-input flex-1"
              placeholder="https://github.com/owner/repo"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              required
            />
          </div>
          <input
            className="atlas-input"
            placeholder="branch (default: main)"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          />
          <button type="submit" disabled={addGithub.isPending} className="atlas-btn-primary self-start">
            {addGithub.isPending ? "Cloning..." : "Add repository"}
          </button>
        </form>
      )}
    </div>
  );
}
