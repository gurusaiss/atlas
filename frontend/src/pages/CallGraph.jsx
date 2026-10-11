import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useRepository, useCallGraph } from "../hooks/useAtlas.js";
import CallGraphViewer from "../components/CallGraphViewer.jsx";
import { ErrorCard, SkeletonList } from "../components/QueryState.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

function Toggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`chip cursor-pointer !px-3 !py-1.5 transition-colors ${active ? "!border-ink bg-ink !text-paper" : "hover:border-ink-3 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

export default function CallGraph() {
  const { repositoryId } = useParams();
  const { data: repository } = useRepository(repositoryId);
  const graphQuery = useCallGraph(repositoryId);
  const graph = graphQuery.data;
  const [highCouplingOnly, setHighCouplingOnly] = useState(false);
  const [entryPointsOnly, setEntryPointsOnly] = useState(false);

  usePageTitle(repository?.name ? `${repository.name} call graph` : "Call graph");

  const nodes = entryPointsOnly ? (graph?.nodes || []).filter((n) => n.is_entry_point) : graph?.nodes || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link to={repository ? `/projects/${repository.project_id}` : "/dashboard"} className="navlink inline-flex items-center gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Link>

      <header className="rise mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">Call graph</p>
          <h1 className="display text-4xl sm:text-5xl">{repository?.name || "Repository"}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-2">
            Every file that calls into another. Block width reflects lines of code; the outline shows cyclomatic complexity.
          </p>
        </div>
        <div className="flex gap-2">
          <Toggle active={highCouplingOnly} onClick={() => setHighCouplingOnly((v) => !v)}>
            High coupling
          </Toggle>
          <Toggle active={entryPointsOnly} onClick={() => setEntryPointsOnly((v) => !v)}>
            Entry points
          </Toggle>
        </div>
      </header>

      <div className="mt-8">
        {graphQuery.isLoading ? (
          <SkeletonList rows={3} />
        ) : graphQuery.isError ? (
          <ErrorCard error={graphQuery.error} onRetry={() => graphQuery.refetch()} />
        ) : (
          <CallGraphViewer nodes={nodes} edges={graph?.edges || []} filterHighCouplingOnly={highCouplingOnly} />
        )}
      </div>
    </div>
  );
}
