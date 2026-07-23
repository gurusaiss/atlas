"""Post-call grounding check: verifies file paths/function names an LLM cited actually exist.

LLMs confidently cite line numbers and function names that don't exist in the
source. This scans an agent's output for `path/to/file.py` and
`function_name(` style references and cross-checks them against the real
parsed repository, so ungrounded claims can be flagged before they reach a
report.
"""

import re
from dataclasses import dataclass

FILE_PATH_PATTERN = re.compile(r"[\w./\\-]+\.(?:py|java|js|jsx|ts|tsx)\b")
FUNCTION_CALL_PATTERN = re.compile(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(")

# Common words that match the function-call regex but aren't real symbols.
STOPWORDS = {"if", "for", "while", "return", "print", "def", "class", "and", "or", "not", "in"}


@dataclass
class GroundingResult:
    grounded: bool
    ungrounded_file_paths: list[str]
    ungrounded_function_names: list[str]
    confidence: float


def check_grounding(
    llm_output: str, known_file_paths: set[str], known_function_names: set[str]
) -> GroundingResult:
    cited_paths = set(FILE_PATH_PATTERN.findall(llm_output))
    cited_functions = {
        m for m in FUNCTION_CALL_PATTERN.findall(llm_output) if m not in STOPWORDS
    }

    normalized_known_paths = {p.replace("\\", "/").lstrip("./") for p in known_file_paths}
    ungrounded_paths = [
        p for p in cited_paths if p.replace("\\", "/").lstrip("./") not in normalized_known_paths
    ]
    ungrounded_functions = [f for f in cited_functions if f not in known_function_names]

    total_citations = len(cited_paths) + len(cited_functions)
    total_ungrounded = len(ungrounded_paths) + len(ungrounded_functions)
    confidence = 1.0 if total_citations == 0 else round(1.0 - (total_ungrounded / total_citations), 4)

    return GroundingResult(
        grounded=total_ungrounded == 0,
        ungrounded_file_paths=ungrounded_paths,
        ungrounded_function_names=ungrounded_functions,
        confidence=confidence,
    )
