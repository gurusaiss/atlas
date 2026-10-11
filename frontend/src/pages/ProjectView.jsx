import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, FileText, GitBranch, Loader2, Play, Trash2 } from "lucide-react";
import { useProject, useRepositories, useCreateJob, useDeleteRepository, useJobs } from "../hooks/useAtlas.js";
import { ErrorCard, QueryState, describeError } from "../components/QueryState.jsx";
import StatusPill from "../components/StatusPill.jsx";
import Contour from "../components/Contour.jsx";
import RepoUploader from "../components/RepoUploader.jsx";
import { toast } from "../store/toastStore.js";
import { confirm } from "../store/confirmStore.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { compactNumber } from "../utils/format.js";

// Only "ready" repositories can be analysed. "pending" means the upload landed
// but the parser hasn't indexed it yet -- starting a job then would run against
// an empty file table.
const ANALYZABLE_STATUSES = new Set(["ready"]);

export default function ProjectView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const projectQuery = useProject(projectId);
  const repositoriesQuery = useRepositories(projectId);
  const jobsQuery = useJobs();
  const project = projectQuery.data;
  const repositories = repositoriesQuery.data;
  const createJob = useCreateJob();
  const deleteRepository = useDeleteRepository(projectId);
  const [analyzingRepoId, setAnalyzingRepoId] = useState(null);

  usePageTitle(project?.name || "Project");

  // Newest completed (or in-flight) job per repository, so each row can link to its results.
  const latestJobByRepo = useMemo(() => {
    const map = new Map();
    (jobsQuery.data || []).forEach((job) => {
      if (job.project_id !== projectId) return;
      const prev = map.get(job.repository_id);
      if (!prev || new Date(job.created_at) > new Date(prev.created_at)) map.set(job.repository_id, job);
    });
    return map;
  }, [jobsQuery.data, projectId]);

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
    const ok = await confirm({
      title: `Delete “${repo.name}”?`,
      message: "The repository and its analysis results will be removed permanently.",
      confirmLabel: "Delete repository",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteRepository.mutateAsync(repo.id);
      toast.success(`Deleted “${repo.name}”.`);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link to="/dashboard" className="navlink inline-flex items-center gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" />
        All projects
      </Link>

      {projectQuery.isError ? (
        <div className="mt-6">
          <ErrorCard error={projectQuery.error} onRetry={() => projectQuery.refetch()} />
        </div>
      ) : (
        <header className="relative mt-6 overflow-hidden border-y border-rule py-9">
          {project && (
            <Contour seed={project.id} cols={80} rows={14} levels={10} className="pointer-events-none absolute inset-0 h-full w-full text-ink/[0.09]" />
          )}
          <div className="relative">
            {projectQuery.isLoading ? (
              <div className="space-y-3">
                <div className="skeleton h-10 w-72" />
                <div className="skeleton h-4 w-96 max-w-full" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="display rise text-4xl sm:text-5xl">{project?.name || "Project"}</h1>
                  {project?.is_demo && <span className="chip">Demo</span>}
                </div>
                {project?.description && <p className="rise mt-3 max-w-2xl text-ink-2" style={{ "--i": 1 }}>{project.description}</p>}
              </>
            )}
          </div>
        </header>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[22rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="eyebrow mb-3">Add a repository</h2>
          <RepoUploader projectId={projectId} />
        </aside>

        <section>
          <h2 className="eyebrow mb-3">Repositories</h2>
          <QueryState
            query={repositoriesQuery}
            emptyTitle="No repositories yet."
            emptyMessage="Upload a ZIP or add a GitHub URL on the left to get started."
          >
            <ul className="panel divide-y divide-rule">
              {repositories?.map((repo, i) => {
                const isAnalyzable = ANALYZABLE_STATUSES.has(repo.status);
                const isAnalyzing = analyzingRepoId === repo.id && createJob.isPending;
                const latest = latestJobByRepo.get(repo.id);
                const latestHref =
                  latest?.status === "completed" ? `/jobs/${latest.id}/results` : latest ? `/jobs/${latest.id}` : null;
                return (
                  <li key={repo.id} className="rise px-5 py-5" style={{ "--i": i }}>
                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="truncate text-xl">{repo.name}</h3>
                          <StatusPill status={repo.status} />
                        </div>
                        <p className="num mt-1.5 text-xs text-ink-3">
                          {repo.primary_language || "unknown"} · {compactNumber(repo.total_loc)} lines · {repo.total_files} files
                        </p>
                        {repo.status === "error" && repo.parse_error && (
                          <p className="mt-2 text-sm text-crit">{repo.parse_error}</p>
                        )}
                        {latestHref && (
                          <Link to={latestHref} className="link mt-3 inline-flex items-center gap-1.5 text-sm">
                            <FileText className="h-3.5 w-3.5" />
                            {latest.status === "completed" ? "Latest results" : "Analysis in progress"}
                          </Link>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {repo.status === "ready" && (
                          <Link to={`/repositories/${repo.id}/graph`} className="icon-btn" title="Call graph" aria-label={`Call graph for ${repo.name}`}>
                            <GitBranch className="h-4 w-4" />
                          </Link>
                        )}
                        <button
                          onClick={() => handleDeleteRepository(repo)}
                          disabled={deleteRepository.isPending}
                          title="Delete repository"
                          aria-label={`Delete ${repo.name}`}
                          className="icon-btn hover:!bg-crit/10 hover:!text-crit"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleAnalyze(repo.id)}
                          disabled={!isAnalyzable || createJob.isPending}
                          title={!isAnalyzable ? `Repository is ${repo.status}` : undefined}
                          className="btn btn-primary btn-sm ml-2"
                        >
                          {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          {isAnalyzing ? "Starting…" : latest ? "Re-analyse" : "Analyse"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </QueryState>
        </section>
      </div>
    </div>
  );
}
