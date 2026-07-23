import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useRepository, useCallGraph } from "../hooks/useAtlas.js";
import CallGraphViewer from "../components/CallGraphViewer.jsx";

export default function CallGraph() {
  const { repositoryId } = useParams();
  const { data: repository } = useRepository(repositoryId);
  const { data: graph, isLoading } = useCallGraph(repositoryId);
  const [highCouplingOnly, setHighCouplingOnly] = useState(false);
  const [entryPointsOnly, setEntryPointsOnly] = useState(false);

  const nodes = entryPointsOnly ? (graph?.nodes || []).filter((n) => n.is_entry_point) : graph?.nodes || [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <Link to={repository ? `/projects/${repository.project_id}` : "/dashboard"} className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{repository?.name || "Repository"} -- Call Graph</h1>
          <p className="text-sm text-gray-500">
            Force-directed view of cross-file function calls. Node size = LOC, color = cyclomatic complexity.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setHighCouplingOnly((v) => !v)}
            className={`atlas-badge cursor-pointer ${highCouplingOnly ? "bg-amber-900 text-amber-300" : "bg-gray-800 text-gray-400"}`}
          >
            High coupling only
          </button>
          <button
            onClick={() => setEntryPointsOnly((v) => !v)}
            className={`atlas-badge cursor-pointer ${entryPointsOnly ? "bg-blue-900 text-blue-300" : "bg-gray-800 text-gray-400"}`}
          >
            Entry points only
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading call graph...</p>
      ) : (
        <CallGraphViewer nodes={nodes} edges={graph?.edges || []} filterHighCouplingOnly={highCouplingOnly} />
      )}
    </div>
  );
}
