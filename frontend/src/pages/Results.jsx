import { useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useDecomposition,
  useDocumentation,
  useJob,
  useMarkFalsePositive,
  useQuality,
  useRepository,
  useSecurityFindings,
  useTestFile,
  useTests,
} from "../hooks/useAtlas.js";
import MermaidRenderer from "../components/MermaidRenderer.jsx";
import MicroservicesGraph from "../components/MicroservicesGraph.jsx";
import SecurityFindingCard from "../components/SecurityFindingCard.jsx";
import CodeViewer from "../components/CodeViewer.jsx";
import ComplexityHeatmap from "../components/ComplexityHeatmap.jsx";

const TABS = ["Overview", "Architecture", "Decomposition", "Security", "Tests", "Metrics"];

function extractMermaid(markdown = "") {
  const match = markdown.match(/```mermaid\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function TestFileViewer({ jobId, test }) {
  const { data, isLoading } = useTestFile(jobId, test.test_file);
  return (
    <div>
      <p className="text-sm text-gray-400 mb-1">
        {test.source_file} &rarr; <span className="font-mono">{test.test_file}</span> ({test.framework})
      </p>
      {isLoading ? (
        <div className="atlas-card p-6 text-sm text-gray-500">Loading test content...</div>
      ) : (
        <CodeViewer code={data?.test_code} filePath={test.test_file} height="300px" />
      )}
    </div>
  );
}

function SeverityCount({ findings, severity, colorClass }) {
  const count = findings?.filter((f) => f.severity === severity).length || 0;
  return (
    <div className="atlas-card p-4 text-center">
      <p className={`text-2xl font-semibold ${colorClass}`}>{count}</p>
      <p className="text-xs text-gray-500 uppercase mt-1">{severity}</p>
    </div>
  );
}

export default function Results() {
  const { jobId } = useParams();
  const [activeTab, setActiveTab] = useState("Overview");

  const { data: job } = useJob(jobId);
  const { data: docs } = useDocumentation(jobId);
  const { data: decomposition } = useDecomposition(jobId);
  const { data: findings } = useSecurityFindings(jobId);
  const { data: tests } = useTests(jobId);
  const { data: quality } = useQuality(jobId);
  const { data: repository } = useRepository(job?.repository_id);
  const markFalsePositive = useMarkFalsePositive();

  const evaluation = quality?.evaluation || {};
  const architectureDiagram = extractMermaid(docs?.markdown);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold mb-1">Analysis Results</h1>
      <p className="text-gray-500 text-sm mb-6">Job {jobId}</p>

      <div className="flex gap-1 border-b border-atlas-border mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? "border-atlas-accent text-atlas-accent"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SeverityCount findings={findings} severity="critical" colorClass="text-atlas-critical" />
            <SeverityCount findings={findings} severity="high" colorClass="text-orange-400" />
            <SeverityCount findings={findings} severity="medium" colorClass="text-atlas-warning" />
            <SeverityCount findings={findings} severity="low" colorClass="text-blue-400" />
            <div className="atlas-card p-4 text-center">
              <p className="text-2xl font-semibold text-atlas-success">
                {Math.round((evaluation.overall_quality_score || 0) * 100)}%
              </p>
              <p className="text-xs text-gray-500 uppercase mt-1">Quality Score</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="atlas-card p-5">
              <p className="text-xs text-gray-500 uppercase mb-2">Test Coverage Estimate</p>
              <p className="text-xl font-semibold">{Math.round((evaluation.test_coverage_estimate || 0) * 100)}%</p>
            </div>
            <div className="atlas-card p-5">
              <p className="text-xs text-gray-500 uppercase mb-2">Faithfulness</p>
              <p className="text-xl font-semibold">{Math.round((evaluation.faithfulness || 0) * 100)}%</p>
            </div>
            <div className="atlas-card p-5">
              <p className="text-xs text-gray-500 uppercase mb-2">Decomposition Validity</p>
              <p className="text-xl font-semibold">{Math.round((evaluation.decomposition_validity || 0) * 100)}%</p>
            </div>
          </div>

          {evaluation.improvement_suggestions?.length > 0 && (
            <div className="atlas-card p-5">
              <h3 className="text-sm font-medium mb-2">Improvement Suggestions</h3>
              <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                {evaluation.improvement_suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === "Architecture" && (
        <div className="space-y-4">
          {architectureDiagram && <MermaidRenderer chart={architectureDiagram} />}
          <div className="atlas-card p-6 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{docs?.markdown || "_No documentation generated yet._"}</ReactMarkdown>
          </div>
        </div>
      )}

      {activeTab === "Decomposition" && (
        <div className="space-y-4">
          {decomposition?.services ? (
            <>
              <MicroservicesGraph services={decomposition.services} />
              {decomposition.risks?.length > 0 && (
                <div className="atlas-card p-5">
                  <h3 className="text-sm font-medium mb-2 text-atlas-warning">Migration Risks</h3>
                  <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                    {decomposition.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-sm text-gray-500">
                Recommended first extraction: <strong className="text-gray-300">{decomposition.recommended_first_extraction}</strong>{" "}
                &middot; Estimated effort: {decomposition.estimated_total_effort_weeks} weeks
              </p>
            </>
          ) : (
            <p className="text-gray-500">No decomposition plan generated yet.</p>
          )}
        </div>
      )}

      {activeTab === "Security" && (
        <div className="space-y-3">
          {!findings?.length ? (
            <p className="text-gray-500">No security findings.</p>
          ) : (
            findings.map((f) => (
              <SecurityFindingCard
                key={f.id || f.title}
                finding={f}
                onMarkFalsePositive={
                  f.id ? (id) => markFalsePositive.mutate({ findingId: id, reason: "Reviewed by user" }) : undefined
                }
              />
            ))
          )}
        </div>
      )}

      {activeTab === "Tests" && (
        <div className="space-y-4">
          {!tests?.length ? (
            <p className="text-gray-500">No tests generated yet.</p>
          ) : (
            tests.map((t) => <TestFileViewer key={t.test_file} jobId={jobId} test={t} />)
          )}
        </div>
      )}

      {activeTab === "Metrics" && <ComplexityHeatmap files={repository?.code_files || []} />}
    </div>
  );
}
