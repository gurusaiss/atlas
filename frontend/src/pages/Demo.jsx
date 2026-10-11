import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useDemoRepositories, useLoadDemo } from "../hooks/useAtlas.js";
import { useAuth } from "../hooks/useAuth.js";
import { EmptyState, ErrorCard, SkeletonCards, describeError } from "../components/QueryState.jsx";
import Contour from "../components/Contour.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

export default function Demo() {
  usePageTitle("Live demo");
  const demoQuery = useDemoRepositories();
  const repos = demoQuery.data;
  const loadDemo = useLoadDemo();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loadingRepo, setLoadingRepo] = useState(null);
  const [error, setError] = useState("");

  async function handleLoad(repoName) {
    setError("");
    setLoadingRepo(repoName);
    try {
      // Results sit behind auth like everything else. For the demo the sign-in is
      // silent: the visitor never types a password, but the same authenticated
      // API (and ownership checks) apply.
      if (!isAuthenticated) {
        await login("demo@atlas.ai", "DemoAtlas2024!");
      }
      const result = await loadDemo.mutateAsync(repoName);
      navigate(`/jobs/${result.job_id}/results`);
    } catch (err) {
      setError(
        err.response?.status === 404
          ? "This demo isn't available right now. Please try again shortly."
          : describeError(err)
      );
    } finally {
      setLoadingRepo(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <header className="rise max-w-2xl">
        <p className="eyebrow mb-4">Live demo</p>
        <h1 className="display text-4xl sm:text-6xl">Three codebases, already surveyed.</h1>
        <p className="mt-5 text-lg leading-8 text-ink-2">
          Pick one and open its full report: architecture notes, service boundaries, generated tests, security findings and quality metrics.
        </p>
        <p className="mt-4 flex items-start gap-2.5 border-l-2 border-accent pl-3 text-sm leading-6 text-ink-2">
          Results are pre-computed and load instantly. Opening a card does not start a new analysis.
        </p>
      </header>

      {error && (
        <p role="alert" className="mt-8 border-l-2 border-crit bg-crit/10 px-3 py-2.5 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="mt-12">
        {demoQuery.isLoading ? (
          <SkeletonCards count={3} />
        ) : demoQuery.isError ? (
          <ErrorCard error={demoQuery.error} onRetry={() => demoQuery.refetch()} />
        ) : !repos?.length ? (
          <EmptyState title="The demo isn't loaded yet." message="No demo projects are available on this server right now. Check back soon." />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {repos.map((repo, i) => {
              const busy = loadingRepo === repo.name;
              return (
                <button
                  key={repo.repository_id}
                  onClick={() => handleLoad(repo.name)}
                  disabled={!!loadingRepo}
                  style={{ "--i": i }}
                  className="panel panel-hover group rise flex flex-col overflow-hidden text-left disabled:cursor-wait disabled:opacity-70"
                >
                  <div className="relative h-36 overflow-hidden border-b border-rule bg-sunk">
                    <Contour
                      seed={repo.name}
                      cols={44}
                      rows={16}
                      levels={11}
                      className="h-full w-full scale-105 text-ink/30 transition-transform duration-700 ease-out group-hover:scale-125"
                    />
                    <span className="num absolute left-4 top-3 text-xs text-ink-2">Plate {String(i + 1).padStart(2, "0")}</span>
                    <span className="chip absolute right-3 top-3 bg-card">{repo.language}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="text-2xl">{repo.name}</h2>
                    <p className="mt-2 flex-1 text-sm leading-6 text-ink-2">{repo.description}</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink">
                      {busy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Opening report…
                        </>
                      ) : (
                        <>
                          Open the report
                          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                        </>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
