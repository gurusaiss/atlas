import { useParams, useNavigate, Link } from "react-router-dom";
import { Play, GitBranch } from "lucide-react";
import { useProject, useRepositories, useCreateJob } from "../hooks/useAtlas.js";
import RepoUploader from "../components/RepoUploader.jsx";

const STATUS_COLORS = {
  pending: "bg-gray-700 text-gray-300",
  parsing: "bg-blue-900 text-blue-300",
  ready: "bg-green-900 text-atlas-success",
  error: "bg-red-950 text-atlas-critical",
};

export default function ProjectView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: repositories, isLoading } = useRepositories(projectId);
  const createJob = useCreateJob();

  async function handleAnalyze(repositoryId) {
    const job = await createJob.mutateAsync({ repositoryId });
    navigate(`/jobs/${job.id}`);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold mb-1">{project?.name || "Project"}</h1>
      <p className="text-gray-400 text-sm mb-8">{project?.description}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <RepoUploader projectId={projectId} />
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-3">Repositories</h2>
          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : !repositories?.length ? (
            <div className="atlas-card p-8 text-center text-gray-500">
              No repositories yet -- upload a ZIP or add a GitHub URL to get started.
            </div>
          ) : (
            <div className="atlas-card divide-y divide-atlas-border">
              {repositories.map((repo) => (
                <div key={repo.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-medium">{repo.name}</p>
                    <p className="text-xs text-gray-500">
                      {repo.primary_language || "unknown"} &middot; {repo.total_loc} LOC &middot;{" "}
                      {repo.total_files} files
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`atlas-badge ${STATUS_COLORS[repo.status] || "bg-gray-800"}`}>
                      {repo.status}
                    </span>
                    {repo.status === "ready" && (
                      <Link
                        to={`/repositories/${repo.id}/graph`}
                        className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1.5"
                        title="View call graph"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                      </Link>
                    )}
                    <button
                      onClick={() => handleAnalyze(repo.id)}
                      disabled={createJob.isPending}
                      className="atlas-btn-primary text-sm py-1.5 flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Analyze
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
