"""Complexity and technical-debt metrics computed from parsed source.

Cyclomatic complexity is McCabe's M = decision_points + 1, counted per
function by walking its tree-sitter subtree and counting branch/loop/boolean
nodes. Coupling and cohesion are computed at the file level from the call
graph, per Michael Feathers' notion of "seams" for legacy decomposition.
"""

from dataclasses import dataclass

from app.parser.ast_parser import FileParseResult
from app.parser.languages import get_parser

# Node types that each represent one decision point (branch) in a control-flow graph.
DECISION_NODE_TYPES = {
    "python": {
        "if_statement",
        "elif_clause",
        "for_statement",
        "while_statement",
        "try_statement",
        "except_clause",
        "with_statement",
        "boolean_operator",
        "conditional_expression",
        "match_statement",
        "case_clause",
    },
    "java": {
        "if_statement",
        "for_statement",
        "while_statement",
        "do_statement",
        "catch_clause",
        "switch_expression",
        "switch_block_statement_group",
        "ternary_expression",
        "binary_expression",  # over-counts && / || vs plain arithmetic; acceptable approximation
    },
    "javascript": {
        "if_statement",
        "for_statement",
        "for_in_statement",
        "while_statement",
        "do_statement",
        "catch_clause",
        "switch_case",
        "ternary_expression",
    },
}

COMPLEXITY_THRESHOLDS = [(5, "simple"), (10, "moderate"), (20, "complex")]  # else "untestable"

# Technical debt weights, in minutes, per Part G.
DEBT_WEIGHT_DEAD_CODE_FN = 20
DEBT_WEIGHT_HIGH_COMPLEXITY_FN = 45
DEBT_WEIGHT_UNCOVERED_FN = 30
DEBT_WEIGHT_SECURITY_CRITICAL = 120
DEBT_WEIGHT_MISSING_DOCSTRING = 5
HIGH_COMPLEXITY_THRESHOLD = 15


@dataclass
class FunctionComplexity:
    name: str
    cyclomatic_complexity: int
    classification: str


@dataclass
class FileMetrics:
    file_path: str
    cyclomatic_complexity: float  # average across functions
    max_function_complexity: int
    coupling_score: float
    cohesion_score: float
    technical_debt_minutes: float
    function_complexities: list[FunctionComplexity]


def classify_complexity(value: int) -> str:
    for threshold, label in COMPLEXITY_THRESHOLDS:
        if value <= threshold:
            return label
    return "untestable"


def _count_decision_nodes(node, decision_types: set[str]) -> int:
    count = 1 if node.type in decision_types else 0
    for child in node.children:
        count += _count_decision_nodes(child, decision_types)
    return count


def compute_function_complexity(function_source: str, language: str) -> int:
    """M = decision_points + 1, per McCabe (1976)."""
    decision_types = DECISION_NODE_TYPES.get(language, DECISION_NODE_TYPES["python"])
    parser = get_parser(language)
    tree = parser.parse(function_source.encode("utf-8"))
    decision_points = _count_decision_nodes(tree.root_node, decision_types)
    return decision_points + 1


def compute_coupling_score(
    file_path: str, call_sites_by_file: dict[str, list[tuple[str, str]]]
) -> float:
    """coupling = external_calls / total_calls. 0.0 = isolated, 1.0 = fully dependent on others."""
    calls = call_sites_by_file.get(file_path, [])
    if not calls:
        return 0.0
    external = sum(1 for callee_file, _ in calls if callee_file != file_path and callee_file is not None)
    return round(external / len(calls), 4)


def compute_cohesion_score(functions_sharing_attrs: int, total_function_pairs: int) -> float:
    """Proxy: fraction of function pairs that share a class attribute reference."""
    if total_function_pairs <= 0:
        return 1.0
    return round(min(functions_sharing_attrs / total_function_pairs, 1.0), 4)


def compute_technical_debt_minutes(
    dead_code_functions: int,
    high_complexity_functions: int,
    uncovered_functions: int,
    security_critical_findings: int,
    missing_docstrings: int,
) -> float:
    return (
        dead_code_functions * DEBT_WEIGHT_DEAD_CODE_FN
        + high_complexity_functions * DEBT_WEIGHT_HIGH_COMPLEXITY_FN
        + uncovered_functions * DEBT_WEIGHT_UNCOVERED_FN
        + security_critical_findings * DEBT_WEIGHT_SECURITY_CRITICAL
        + missing_docstrings * DEBT_WEIGHT_MISSING_DOCSTRING
    )


def compute_file_metrics(
    parse_result: FileParseResult,
    coupling_score: float = 0.0,
    cohesion_score: float = 1.0,
    has_tests: bool = False,
) -> FileMetrics:
    function_complexities = []
    for fn in parse_result.functions:
        complexity = compute_function_complexity(fn.body_text, parse_result.language)
        function_complexities.append(
            FunctionComplexity(
                name=fn.name,
                cyclomatic_complexity=complexity,
                classification=classify_complexity(complexity),
            )
        )

    if function_complexities:
        avg_complexity = sum(f.cyclomatic_complexity for f in function_complexities) / len(
            function_complexities
        )
        max_complexity = max(f.cyclomatic_complexity for f in function_complexities)
    else:
        avg_complexity = 0.0
        max_complexity = 0

    high_complexity_count = sum(
        1 for f in function_complexities if f.cyclomatic_complexity > HIGH_COMPLEXITY_THRESHOLD
    )
    missing_docstrings = sum(1 for fn in parse_result.functions if not fn.docstring)
    uncovered_functions = len(parse_result.functions) if not has_tests else 0

    debt_minutes = compute_technical_debt_minutes(
        dead_code_functions=0,  # populated later once the repo-wide call graph is built
        high_complexity_functions=high_complexity_count,
        uncovered_functions=uncovered_functions,
        security_critical_findings=0,  # populated once static analysis findings are joined in
        missing_docstrings=missing_docstrings,
    )

    return FileMetrics(
        file_path=parse_result.file_path,
        cyclomatic_complexity=round(avg_complexity, 2),
        max_function_complexity=max_complexity,
        coupling_score=coupling_score,
        cohesion_score=cohesion_score,
        technical_debt_minutes=debt_minutes,
        function_complexities=function_complexities,
    )
