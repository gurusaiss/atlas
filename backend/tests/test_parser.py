"""Parser tests against samples/small_demo_app -- verifies exact complexity
values on known code, not just "it doesn't crash"."""

import os

from app.parser.ast_parser import parse_file
from app.parser.metrics import compute_file_metrics

SAMPLE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "samples", "small_demo_app", "app.py")


def _parse_sample():
    with open(SAMPLE_PATH, encoding="utf-8") as f:
        source = f.read()
    return parse_file("app.py", source)


def test_parses_all_functions():
    result = parse_file
    result = _parse_sample()
    function_names = {fn.name for fn in result.functions}
    assert function_names == {
        "get_db",
        "init_db",
        "health",
        "get_user",
        "create_user",
        "ping",
        "config",
        "calculate_discount",
    }


def test_parses_imports():
    result = _parse_sample()
    modules = {imp.module for imp in result.imports}
    assert {"os", "sqlite3", "subprocess", "flask"}.issubset(modules)


def test_no_parse_errors():
    result = _parse_sample()
    assert result.parse_error is None
    assert result.language == "python"


def test_calculate_discount_cyclomatic_complexity_is_eight():
    """calculate_discount has 7 decision points (if/elif chain of 3 + 4 other
    ifs) -- McCabe complexity is decision_points + 1 = 8."""
    result = _parse_sample()
    metrics = compute_file_metrics(result)
    complexities = {fc.name: fc.cyclomatic_complexity for fc in metrics.function_complexities}
    assert complexities["calculate_discount"] == 8
    assert metrics.function_complexities[
        [fc.name for fc in metrics.function_complexities].index("calculate_discount")
    ].classification == "moderate"


def test_simple_functions_have_complexity_one_or_two():
    result = _parse_sample()
    metrics = compute_file_metrics(result)
    complexities = {fc.name: fc.cyclomatic_complexity for fc in metrics.function_complexities}
    assert complexities["get_db"] == 1
    assert complexities["health"] == 1
    assert complexities["get_user"] == 2  # one `if row is None` branch


def test_technical_debt_counts_missing_docstrings_and_uncovered_functions():
    result = _parse_sample()
    metrics = compute_file_metrics(result, has_tests=False)
    # 8 functions, no docstrings, none covered by tests, none over the high-complexity threshold
    assert metrics.technical_debt_minutes == 8 * 30 + 8 * 5
