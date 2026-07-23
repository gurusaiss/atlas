import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderPlus, FolderGit2 } from "lucide-react";
import { useCreateProject, useJobs, useProjects } from "../hooks/useAtlas.js";

const STATUS_COLORS = {
  queued: "bg-gray-700 text-gray-300",
  parsing: "bg-blue-900 text-blue-300",
  running: "bg-atlas-accent/20 text-atlas-accent",
  completed: "bg-green-900 text-atlas-success",
  failed: "bg-red-950 text-atlas-critical",
  cancelled: "bg-gray-800 text-gray-500",
};

export default function Dashboard() {
  const { data: projects, isLoading } = useProjects();
  const { data: jobs } = useJobs();
  const createProject = useCreateProject();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await createProject.mutateAsync({ name, description });
    setName("");
    setDescription("");
    setShowForm(false);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            {projects?.length || 0} project{projects?.length === 1 ? "" : "s"} &middot;{" "}
            {jobs?.length || 0} job{jobs?.length === 1 ? "" : "s"}
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="atlas-btn-primary flex items-center gap-2">
          <FolderPlus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="atlas-card p-6 mb-8 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Project name</label>
            <input className="atlas-input w-full" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              className="atlas-input w-full"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={createProject.isPending} className="atlas-btn-primary">
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="atlas-btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-3">Projects</h2>
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !projects?.length ? (
        <div className="atlas-card p-10 text-center text-gray-500">
          <FolderGit2 className="w-8 h-8 mx-auto mb-3 opacity-50" />
          No projects yet. Create one to upload a repository for analysis.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="atlas-card p-5 hover:border-atlas-accent transition-colors"
            >
              <h3 className="font-medium mb-1">{p.name}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{p.description || "No description"}</p>
              {p.is_demo && <span className="atlas-badge bg-atlas-accent/20 text-atlas-accent mt-3">Demo</span>}
            </Link>
          ))}
        </div>
      )}

      <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-3">Recent Jobs</h2>
      {!jobs?.length ? (
        <p className="text-gray-500 text-sm">No jobs yet.</p>
      ) : (
        <div className="atlas-card divide-y divide-atlas-border">
          {jobs.slice(0, 10).map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-atlas-bg/50"
            >
              <div>
                <p className="text-sm font-medium">{job.job_type}</p>
                <p className="text-xs text-gray-500">{new Date(job.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{job.progress}%</span>
                <span className={`atlas-badge ${STATUS_COLORS[job.status] || "bg-gray-800"}`}>{job.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
