import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coffee, Loader2, ShieldAlert } from "lucide-react";
import { useDemoRepositories, useLoadDemo } from "../hooks/useAtlas.js";
import { useAuth } from "../hooks/useAuth.js";
import { ErrorCard, SkeletonCards, describeError } from "../components/QueryState.jsx";

export default function Demo() {
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
      // The results dashboard sits behind auth (resource ownership checks apply
      // to every job/finding endpoint). For the demo flow this login is silent
      // and automatic -- the visitor never types a password -- which satisfies
      // "no login required" from their perspective while reusing the same
      // authenticated API the rest of the app uses.
      if (!isAuthenticated) {
        await login("demo@atlas.ai", "DemoAtlas2024!");
      }
      const result = await loadDemo.mutateAsync(repoName);
      navigate(`/jobs/${result.job_id}/results`);
    } catch (err) {
      setError(
        err.response?.status === 404
          ? "Could not load demo data. Has seed_demo_data.py been run against this database?"
          : describeError(err)
      );
    } finally {
      setLoadingRepo(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-start gap-3 atlas-card p-4 border-atlas-accent">
        <ShieldAlert className="w-5 h-5 text-atlas-accent mt-0.5 shrink-0" />
        <p className="text-sm text-gray-300">
          <strong>Demo Mode</strong> -- these are pre-computed results, loaded instantly. No live
          analysis runs when you click a card below.
        </p>
      </div>

      <h1 className="text-2xl font-semibold mb-6">Try Atlas</h1>

      {error && <p className="text-sm text-atlas-critical mb-4">{error}</p>}

      {demoQuery.isLoading ? (
        <SkeletonCards count={3} />
      ) : demoQuery.isError ? (
        <ErrorCard error={demoQuery.error} onRetry={() => demoQuery.refetch()} />
      ) : !repos?.length ? (
        <div className="atlas-card p-8 text-center text-gray-500">
          No demo data seeded yet. Run <code className="text-gray-300">python seed_demo_data.py</code> from the
          backend directory.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {repos.map((repo) => (
            <div key={repo.repository_id} className="atlas-card p-6 flex flex-col">
              <Coffee className="w-6 h-6 text-atlas-accent mb-3" />
              <h3 className="font-medium mb-1">{repo.name}</h3>
              <span className="atlas-badge bg-atlas-accent/20 text-atlas-accent w-fit mb-3">{repo.language}</span>
              <p className="text-sm text-gray-400 flex-1">{repo.description}</p>
              <button
                onClick={() => handleLoad(repo.name)}
                disabled={loadingRepo === repo.name}
                className="atlas-btn-primary mt-4 flex items-center justify-center gap-2"
              >
                {loadingRepo === repo.name ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </>
                ) : (
                  "View Results"
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
