import { Link } from "react-router-dom";
import { FileText, GitBranch, ShieldCheck, FlaskConical, BarChart3, Gauge } from "lucide-react";
import MermaidRenderer from "../components/MermaidRenderer.jsx";

const FEATURES = [
  {
    icon: FileText,
    title: "Architecture Documentation",
    body: "Auto-generated markdown covering system overview, component responsibilities, data flows, and API surface.",
  },
  {
    icon: GitBranch,
    title: "Microservices Decomposition",
    body: "AI-suggested bounded-context service boundaries from dependency-graph coupling analysis, with migration effort scoring.",
  },
  {
    icon: FlaskConical,
    title: "Unit Test Generation",
    body: "Working pytest/JUnit tests for uncovered functions, covering happy path, edge cases, and error handling.",
  },
  {
    icon: ShieldCheck,
    title: "Security Vulnerability Report",
    body: "OWASP Top 10 findings with line-level citations, severity scoring, and concrete fixes -- static analysis first, LLM explanation second.",
  },
  {
    icon: BarChart3,
    title: "Quality & Risk Dashboard",
    body: "Cyclomatic complexity heatmaps, coupling/cohesion metrics, dead-code detection, and a technical debt score.",
  },
  {
    icon: Gauge,
    title: "Evaluation Report",
    body: "LLM-as-judge scoring of every agent's output, with confidence scores and false-positive flags.",
  },
];

const ARCHITECTURE_DIAGRAM = `graph TB
  User[Developer/Architect] --> FE[React Dashboard]
  FE --> API[FastAPI Backend]
  API --> GW[Guardrail Gateway]
  GW --> LLM[Multi-LLM Gateway: Gemini/Groq/Mistral/Ollama]
  API --> Graph[LangGraph Agent Pipeline]
  Graph --> Planner --> Parallel
  subgraph Parallel[Parallel Agents]
    Docs[Documentation]
    Decomp[Decomposition]
    Test[Test Generation]
    Sec[Security]
  end
  Parallel --> Critic --> Evaluator
  API --> PG[(PostgreSQL)]
  API --> Chroma[(ChromaDB)]
  API --> Redis[(Redis Cache/Queue)]`;

export default function Landing() {
  return (
    <div>
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Atlas <span className="text-atlas-accent">-- Agentic AI Legacy Modernization Platform</span>
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto mb-2">
          Powered by an architecture pattern matching Infosys's Agentic Foundry: LangGraph orchestration,
          multi-LLM fallback, and a Responsible-AI guardrail gateway.
        </p>
        <p className="text-sm text-gray-500 max-w-2xl mx-auto mb-8">
          Technical debt costs enterprises $1.52T annually (CAST Research). Atlas automates a 6-month
          manual modernization assessment into a 3-hour agentic pipeline.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/demo" className="atlas-btn-primary">
            Try Demo
          </Link>
          <Link to="/register" className="atlas-btn-secondary">
            Create Account
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-5">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="atlas-card p-5">
            <Icon className="w-6 h-6 text-atlas-accent mb-3" />
            <h3 className="font-medium mb-1.5">{title}</h3>
            <p className="text-sm text-gray-400">{body}</p>
          </div>
        ))}
      </section>

      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-xl font-semibold mb-4 text-center">Architecture</h2>
        <MermaidRenderer chart={ARCHITECTURE_DIAGRAM} />
      </section>

      <section className="max-w-5xl mx-auto px-6 py-10 text-center">
        <p className="text-xs text-gray-600 mb-3">Built with</p>
        <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
          {[
            "LangGraph",
            "FastAPI",
            "React",
            "PostgreSQL",
            "ChromaDB",
            "Redis",
            "Celery",
            "tree-sitter",
            "Semgrep",
            "Bandit",
            "Docker",
          ].map((tech) => (
            <span key={tech} className="atlas-badge bg-atlas-panel border border-atlas-border text-gray-400">
              {tech}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
