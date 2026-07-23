# Atlas — Interview Guide

## 60-Second Pitch

"I built Atlas — an agentic AI legacy-modernization platform directly aligned
with Infosys's Agentic Legacy Modernization value pool, one of six named AI
value pools targeting a $300-400 billion incremental opportunity by 2030.
Given a legacy codebase, it runs 6 coordinated AI agents — Planner,
Documentation, Decomposition, Test Generation, Security, and a Critic that
independently re-verifies the other agents' claims against the real source
code — to produce architecture docs, a microservices migration plan,
generated tests, and an OWASP-mapped security report, all wrapped in a
Responsible-AI guardrail gateway modeled on Infosys's own Scan-Shield-Steer
framework. It's the same class of problem Infosys solved for Hertz, migrating
roughly 3 million lines of legacy code — I built a working prototype of that
system, on 100% free-tier infrastructure."

## Whiteboard Guide

If asked to draw the architecture from memory, this is the shape to draw,
in order:

1. **Client** box: React dashboard.
2. **API** box: FastAPI, with an arrow labeled "REST + SSE" from the client.
3. **Guardrail Gateway** as a small box the API routes *through* before
   reaching a **Multi-LLM Client** box (draw Gemini/Groq/Mistral/Ollama as
   four small circles in a fallback chain under that box).
4. **LangGraph Pipeline**: Parse -> Embed -> Static Analysis -> Planner, then
   Planner fans out to 4 boxes (Documentation, Decomposition, Test Gen,
   Security) drawn side by side, which all converge into Critic -> Evaluator.
5. **Storage**: three cylinders — PostgreSQL (relational + JSONB), ChromaDB
   (vectors), Redis (cache/queue). Draw arrows from the pipeline into each,
   explaining *why* three stores instead of one (see Q&A below).
6. **Observability**: Prometheus -> Grafana, and OpenTelemetry traces, as a
   sidebar off the API box.

## Talking Points (verified true in the actual code — not aspirational)

**On tree-sitter**: "I used tree-sitter because it's the same incremental
parser GitHub Copilot, VS Code, and Neovim use. It tolerates malformed or
incomplete code, which matters for real legacy codebases." —
`app/parser/ast_parser.py`, `app/parser/languages.py`.

**On static-analysis-first security**: "I run Semgrep and Bandit *before*
any LLM call for security analysis. Static analyzers find exact line
numbers deterministically; LLMs hallucinate line numbers. The LLM only
explains and enriches what the static tools already found — it never invents
new findings." — `app/static_analysis/{semgrep_runner,bandit_runner}.py`,
`app/agents/security.py`. I verified this with a test that asserts the
Security Agent never returns more findings than static analysis provided
(`tests/test_agents.py::test_security_enriches_static_findings_without_inventing_new_ones`).

**On the Critic Agent (chain-of-verification)**: "The Critic doesn't just
review other agents' self-reported confidence — it independently re-queries
ChromaDB for source code relevant to the documentation/decomposition/security
claims and asks the LLM to verify against that retrieved code, not against
what the other agent said about itself." — `app/agents/critic.py`'s
`_verification_context()` re-retrieves source before scoring.

**On multi-LLM fallback**: "LiteLLM gives me one interface across Gemini,
Groq, and Mistral. On a rate limit, I back off exponentially and after 3
consecutive 429s on one provider, I move to the next. If literally every
provider fails — no keys configured, or a genuine outage — the pipeline
degrades to deterministic fallback outputs instead of crashing the job."
— `app/llm/client.py`, `app/agents/base.py`'s `guarded_complete()`. I found
this exact failure mode while testing without API keys configured, and fixed
it so agents never crash a job outright.

**On the Guardrail Gateway (Scan-Shield-Steer)**: "Every LLM call — no
exceptions — goes through Scan (prompt-injection + PII detection on the
outbound prompt, budget check), Shield (the call itself), Steer (grounding
check + PII scan on the response). This mirrors Infosys's own AI3S
(Scan-Shield-Steer) framework for Responsible AI." — `app/guardrails/gateway.py`.
One subtlety I found the hard way: PII redaction on a *JSON* response must
never break the JSON structure the calling agent needs to parse. Presidio's
URL recognizer false-positives on a bare filename like `app.py`
(it looks like a domain) — I added a check that skips redaction rather than
silently corrupting a good response into a broken fallback.

**On LangGraph over a plain loop**: "LangGraph gives explicit state
persistence and checkpointing (`MemorySaver`, keyed by job ID as the thread
ID). If a job dies mid-Decomposition, it resumes from that checkpoint, not
from scratch." — `app/agents/graph.py::build_graph_for_job()`. A real bug I
found and fixed here: the four parallel agents (Documentation, Decomposition,
Test Gen, Security) all write to shared bookkeeping fields (token usage,
timings, guardrail events). Naively returning the full inherited state from
each parallel branch would have summed the *inherited* portion once per
branch — quadruple-counting shared history. Fixed by having each node return
only its own delta and using explicit merge reducers (`app/agents/state.py`).

**On cyclomatic complexity**: "M = decision_points + 1, computed by walking
the tree-sitter AST and counting branch/loop/boolean nodes per function.
Above 20 is essentially untestable." — `app/parser/metrics.py`. Verified with
an exact-value test: a function with an if/elif/elif/else chain plus 4 more
independent `if`s computes to exactly 8
(`tests/test_parser.py::test_calculate_discount_cyclomatic_complexity_is_eight`).

**On coupling-based decomposition**: "Coupling = external_calls / total_calls
per file, from the repository-wide call graph. Below ~0.3 suggests a natural
bounded context — the same seam-finding heuristic Michael Feathers describes
in *Working Effectively with Legacy Code*." — `app/parser/call_graph.py`'s
`compute_module_coupling()`, consumed by `app/agents/decomposition.py`.

**On the evaluation harness**: "I built the Evaluator Agent — LLM-as-judge
scoring faithfulness, completeness, actionability, test coverage estimate,
and decomposition validity — alongside the other agents, not as an
afterthought. I can tell you exactly how confident each agent's output is,
with numbers, not just 'it seemed to work.'" — `app/agents/evaluator.py`.

**On why three data stores, not one**: "Postgres for anything relational or
transactional (foreign keys, cascade deletes, account-lockout counters that
need atomicity) with JSONB for agent-specific structured output. ChromaDB
specifically for vector similarity search — wrong tool for Postgres to do
natively at this scale. Redis for the LLM response cache and the Celery
broker. Three purpose-built stores, not indecision."

## Anticipated Q&A

**"Why not just use one big LLM call instead of 6 agents?"** A single call
has to trade off depth for breadth across documentation, decomposition,
tests, and security simultaneously, and gives no way to independently verify
one output against another. Splitting into a Planner-Executor-Critic pipeline
lets each agent get a focused prompt and budget, and lets the Critic check
claims against retrieved source rather than trusting self-reported quality.

**"What happens if the codebase is huge — won't this blow the free-tier
token budget?"** The Planner triages first and allocates a token budget per
downstream agent, prioritizing the highest-coupling/highest-complexity files.
Static analysis (Semgrep/Bandit) runs before any LLM call and costs zero
tokens. The Redis LLM cache means identical prompts (e.g., re-running a demo)
never re-spend tokens.

**"How do you know your agents aren't hallucinating?"** Three layers: (1)
static analysis grounds the Security Agent's findings in real line numbers
before any LLM touches them; (2) the guardrail gateway's post-call grounding
check cross-references every file path and function name an LLM cites
against the actually-parsed repository; (3) the Critic Agent independently
re-retrieves source and re-verifies claims rather than trusting self-reports.

**"What would you do differently at real enterprise scale?"** Whole-program
call-graph resolution (currently name-based, not type-aware — a deliberate
simplification, not a scale-driven one) would need real cross-module
resolution for languages with more indirection than Python/Java. I'd also
move the LangGraph checkpointer from in-memory to a persistent backend
(Postgres or Redis-backed) so checkpoints survive a process restart, not just
an in-process retry.

## DSA / DBMS / System Design Bridge

If the interview pivots from project discussion to core CS: the Postgres
schema (`backend/alembic/versions/001_initial_schema.py`) is a real 5-table-deep
foreign-key chain with cascade deletes and composite query patterns — good
grounding for SQL/normalization questions. The call-graph builder
(`app/parser/call_graph.py`) is literally a graph adjacency-list problem
(dead-code detection is unreachable-node detection). The cyclomatic
complexity calculator is a direct application of graph theory (`M = E - N + 2P`).
The Celery + Redis + LangGraph checkpointing setup is a real distributed-systems
talking point (idempotent task resumption, at-least-once delivery semantics).
