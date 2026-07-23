import { useState } from "react";
import { Github, UploadCloud } from "lucide-react";
import { useAddGithubRepository, useUploadRepository } from "../hooks/useAtlas.js";

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
    try {
      await upload.mutateAsync(file);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      e.target.value = "";
    }
  }

  async function handleGithubSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await addGithub.mutateAsync({ githubUrl, branch });
      setGithubUrl("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to clone repository");
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
