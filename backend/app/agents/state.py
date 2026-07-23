"""Shared LangGraph state passed between all pipeline nodes (Part F).

Fields written by more than one node in the same superstep (the four
parallel agents: documentation, decomposition, test_generator, security) use
Annotated reducers -- LangGraph's default channel behavior is "last writer
wins" per key, which would silently drop three of the four branches' token
usage / timing / guardrail bookkeeping without an explicit merge function.
"""

import operator
from typing import Annotated, TypedDict


def _merge_dicts(left: dict, right: dict) -> dict:
    merged = dict(left or {})
    for key, value in (right or {}).items():
        if isinstance(value, (int, float)) and isinstance(merged.get(key), (int, float)):
            merged[key] = merged[key] + value
        else:
            merged[key] = value
    return merged


class AtlasState(TypedDict, total=False):
    # Job metadata
    job_id: str
    repository_id: str
    repository_path: str
    primary_language: str
    is_demo: bool
    token_budget: int

    # Private: hands parsed ASTs from parse_repository_node to embed_chunks_node
    # without re-parsing. Never read past that node.
    _parse_results: list

    # Parser outputs
    code_files: list[dict]
    call_graph: dict
    complexity_metrics: dict
    static_findings: list[dict]
    known_file_paths: list[str]
    known_function_names: list[str]

    # Agent outputs (each written by exactly one node -- safe to overwrite)
    planner_output: dict
    documentation_output: str
    decomposition_output: dict
    generated_tests: list[dict]
    security_output: list[dict]
    critic_output: dict
    evaluation_output: dict

    # Fields written concurrently by the 4 parallel agents -- must merge, not overwrite.
    guardrail_flags: Annotated[list[dict], operator.add]
    token_usage: Annotated[dict, _merge_dicts]
    execution_times: Annotated[dict, _merge_dicts]
    rate_limit_hits: Annotated[int, operator.add]

    # Final
    final_report: dict
    errors: Annotated[list[str], operator.add]
    status: str
