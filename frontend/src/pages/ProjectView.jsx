import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Play, GitBranch, Loader2, Trash2 } from "lucide-react";
import { useProject, useRepositories, useCreateJob, useDeleteRepository } from "../hooks/useAtlas.js";
import { ErrorCard, QueryState, describeError } from "../components/QueryState.jsx";
import { toast } from "../store/toastStore.js";
import RepoUploader from "../components/RepoUploader.jsx";

const STATUS_COLORS = {
  pending: "bg-gray-700 text-gray-300",
  parsing: "bg-blue-900 text-blue-300",
  ready: "bg-green-900 text-atlas-success",
  error: "bg-red-950 text-atlas-critical",
};

// Only "ready" repos can be analyzed — "pending" means the ZIP was just
// uploaded but the parser hasn't run yet (it runs as the first pipeline node).
// Allowing "pending" would start a job before any code files exist in the DB.
const ANALYZABLE_STATUSES = new Set(["ready"]);

export default function ProjectView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const projectQuery = useProject(projectId);
  const repositoriesQuery = useRepositories(projectId);
  const project = projectQuery.data;
  const repositories = repositoriesQuery.data;
  const createJob = useCreateJob();
  const deleteRepository = useDeleteRepository(projectId);
  const [analyzingRepoId, setAnalyzingRepoId] = useState(null);

  async function handleAnalyze(repositoryId) {
    setAnalyzingRepoId(repositoryId);
    try {
      const job = await createJob.mutateAsync({ repositoryId });
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      toast.error(describeError(err));
      setAnalyzingRepoId(null);
    }
  }

  async function handleDeleteRepository(repo) {
    if (!window.confirm(`Delete "${repo.name}"? This cannot be undone.`)) return;
    try {
      await deleteRepository.mutateAsync(repo.id);
      toast.success(`"${repo.name}" deleted.`);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {projectQuery.isError ? (
        <div className="mb-8">
          <ErrorCard error={projectQuery.error} onRetry={() => projectQuery.refetch()} />
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-semibold mb-1">
            {projectQuery.isLoading ? (
              <span className="inline-block h-7 w-48 bg-atlas-border rounded animate-pulse" />
            ) : (
              project?.name || "Project"
            )}
          </h1>
          <p className="text-gray-400 text-sm mb-8">{project?.description}</p>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <RepoUploader projectId={projectId} />
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-3">Repositories</h2>
          <QueryState
            query={repositoriesQuery}
            emptyMessage="No repositories yet — upload a ZIP or add a GitHub URL to get started."
          >
            <div className="atlas-card divide-y divide-atlas-border">
              {repositories?.map((repo) => {
                const isAnalyzable = ANALYZABLE_STATUSES.has(repo.status);
                const isAnalyzing = analyzingRepoId === repo.id && createJob.isPending;
                return (
                  <div
                    key={repo.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{repo.name}</p>
                      <p className="text-xs text-gray-500">
                        {repo.primary_language || "unknown"} &middot; {repo.total_loc} LOC &middot;{" "}
                        {repo.total_files} files
                      </p>
                      {repo.status === "error" && repo.parse_error && (
                        <p className="text-xs text-atlas-critical mt-1">{repo.parse_error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
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
                        disabled={!isAnalyzable || createJob.isPending}
                        title={!isAnalyzable ? `Repository is ${repo.status}` : undefined}
                        className="atlas-btn-primary text-sm py-1.5 flex items-center gap-1.5"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        {isAnalyzing ? "Starting…" : "Analyze"}
                      </button>
                      <button
                        onClick={() => handleDeleteRepository(repo)}
                        disabled={deleteRepository.isPending}
                        title="Delete repository"
                        className="p-1.5 rounded text-gray-500 hover:text-atlas-critical hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </QueryState>
        </div>
      </div>
    </div>
  );
}
