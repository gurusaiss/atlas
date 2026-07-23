"""Documentation Agent -- generates grounded architecture docs via RAG.

Retrieves the most relevant code chunks per component from ChromaDB (function-
level semantic chunks, so retrieval respects code boundaries) and asks the LLM
to write architecture documentation grounded in that retrieved context.
"""

import logging

from app.agents.base import GuardedLLMResult, guarded_complete
from app.agents.state import AtlasState
from app.guardrails.gateway import GuardrailGateway
from app.llm.client import AtlasLLMClient
from app.parser.embedder import query_similar_chunks

logger = logging.getLogger("atlas.agents.documentation")

SYSTEM_PROMPT = """You are the Documentation Agent in a legacy-modernization pipeline.
You write accurate, grounded architecture documentation in Markdown.
Only describe code that appears in the provided context. Never invent functions,
files, or endpoints that are not shown. Use Mermaid diagrams for data flows."""

RETRIEVAL_QUERIES = [
    "main entry point and application setup",
    "data models and database schema",
    "API endpoints and routes",
    "business logic and services",
    "external integrations and dependencies",
]

USER_PROMPT_TEMPLATE = """Write comprehensive architecture documentation for this {language} system.

Repository summary:
- Files: {file_count}
- Total LOC: {total_loc}
- Business domain (from planner): {domain}

Relevant code context (retrieved via semantic search):
{context}

Produce Markdown documentation with these sections:
1. System Overview (what the system does, what business problem it solves)
2. Component Inventory (each major class/module and its responsibility)
3. Data Flow (include at least one Mermaid `graph` or `sequenceDiagram`)
4. API Surface (endpoints / public interfaces found in the context)
5. External Dependencies & Integrations
6. Identified Design Patterns
7. Business Domain Entities

Write at least 800 words. Ground every claim in the provided context."""


def _gather_context(repository_id: str) -> str:
    blocks = []
    for query in RETRIEVAL_QUERIES:
        hits = query_similar_chunks(repository_id, query, top_k=3)
        if not hits:
            continue
        blocks.append(f"### Context for: {query}")
        for hit in hits:
            meta = hit["metadata"]
            blocks.append(
                f"File `{meta.get('file_path')}` "
                f"(lines {meta.get('start_line')}-{meta.get('end_line')}, "
                f"symbol `{meta.get('symbol_name')}`):\n```\n{hit['content'][:1200]}\n```"
            )
    return "\n\n".join(blocks) if blocks else "No indexed code context available."


async def run_documentation(
    state: AtlasState, llm_client: AtlasLLMClient, gateway: GuardrailGateway
) -> tuple[str, GuardedLLMResult | None]:
    code_files = state.get("code_files", [])
    planner = state.get("planner_output", {})

    context = _gather_context(state.get("repository_id", ""))
    user_prompt = USER_PROMPT_TEMPLATE.format(
        language=state.get("primary_language", "unknown"),
        file_count=len(code_files),
        total_loc=sum(f.get("loc", 0) for f in code_files),
        domain=planner.get("domain", "generic"),
        context=context[:12000],
    )

    result = await guarded_complete(
        llm_client=llm_client,
        gateway=gateway,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        agent_type="documentation",
        known_file_paths=set(state.get("known_file_paths", [])),
        known_function_names=set(state.get("known_function_names", [])),
        max_tokens=3000,
        job_id=state.get("job_id"),
    )

    if result.blocked:
        return f"_Documentation generation blocked by guardrail: {result.block_reason}_", result

    return result.content, result
