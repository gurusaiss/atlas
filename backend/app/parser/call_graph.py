"""Repository-wide call graph: resolves call sites to (file, function) pairs.

Used downstream by: the Decomposition Agent (coupling-based service
boundaries), dead-code detection (in-degree 0, not an entry point), and the
call-graph viewer in the frontend.
"""

from dataclasses import dataclass

from app.parser.ast_parser import FileParseResult

ENTRY_POINT_DECORATORS = {"app.route", "router.get", "router.post", "router.put", "router.delete", "route"}
ENTRY_POINT_NAMES = {"main", "__main__", "handler", "lambda_handler"}


@dataclass
class Edge:
    caller_file: str
    caller_function: str | None
    callee_file: str | None
    callee_function: str
    call_count: int = 1


def _function_index(parse_results: list[FileParseResult]) -> dict[str, list[str]]:
    """Map function name -> list of files that define a function with that name."""
    index: dict[str, list[str]] = {}
    for pr in parse_results:
        for fn in pr.functions:
            index.setdefault(fn.name, []).append(pr.file_path)
    return index


def build_call_graph(parse_results: list[FileParseResult]) -> list[Edge]:
    """Build a best-effort adjacency list across all parsed files in a repository.

    Resolution is name-based (no cross-module type inference), which is a
    deliberate simplification -- full whole-program call resolution is out of
    scope for a legacy-modernization triage tool; approximate call graphs are
    what real tools (e.g. Sourcegraph's basic code intel) also ship with.
    """
    function_locations = _function_index(parse_results)
    edge_counts: dict[tuple[str, str | None, str | None, str], int] = {}

    for pr in parse_results:
        for call in pr.call_sites:
            candidate_files = function_locations.get(call.callee_name)
            callee_file = None
            if candidate_files:
                callee_file = pr.file_path if pr.file_path in candidate_files else candidate_files[0]

            key = (pr.file_path, call.caller_function, callee_file, call.callee_name)
            edge_counts[key] = edge_counts.get(key, 0) + 1

    return [
        Edge(caller_file=cf, caller_function=caller, callee_file=callee_file, callee_function=callee, call_count=count)
        for (cf, caller, callee_file, callee), count in edge_counts.items()
    ]


def file_has_entry_point(parse_result) -> bool:
    """True if any function in this file is recognized as an entry point."""
    return any(is_entry_point(fn.name, fn.decorators) for fn in parse_result.functions)


def is_entry_point(fn_name: str, decorators: list[str]) -> bool:
    if fn_name in ENTRY_POINT_NAMES:
        return True
    return any(any(marker in d for marker in ENTRY_POINT_DECORATORS) for d in decorators)


def find_dead_code(parse_results: list[FileParseResult], edges: list[Edge]) -> list[tuple[str, str]]:
    """Functions with in-degree 0 that are not recognized entry points. Returns (file, function) pairs."""
    called = {(e.callee_file, e.callee_function) for e in edges if e.callee_file is not None}

    dead: list[tuple[str, str]] = []
    for pr in parse_results:
        for fn in pr.functions:
            if (pr.file_path, fn.name) in called:
                continue
            if is_entry_point(fn.name, fn.decorators):
                continue
            if fn.is_method:
                # Overridden/interface methods are frequently invoked polymorphically
                # (never a direct-name call site) -- too noisy to flag as dead.
                continue
            dead.append((pr.file_path, fn.name))
    return dead


def compute_module_coupling(parse_results: list[FileParseResult], edges: list[Edge]) -> dict[str, float]:
    """coupling = external_calls / total_calls per file. < 0.3 suggests a natural bounded context."""
    totals: dict[str, int] = {}
    external: dict[str, int] = {}

    for e in edges:
        totals[e.caller_file] = totals.get(e.caller_file, 0) + e.call_count
        if e.callee_file is not None and e.callee_file != e.caller_file:
            external[e.caller_file] = external.get(e.caller_file, 0) + e.call_count

    coupling: dict[str, float] = {}
    for pr in parse_results:
        total = totals.get(pr.file_path, 0)
        coupling[pr.file_path] = round(external.get(pr.file_path, 0) / total, 4) if total else 0.0
    return coupling
