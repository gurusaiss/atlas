"""Unit tests for the complexity/coupling/debt formulas in app.parser.metrics."""

from app.parser.metrics import (
    classify_complexity,
    compute_coupling_score,
    compute_cohesion_score,
    compute_function_complexity,
    compute_technical_debt_minutes,
)


def test_classify_complexity_thresholds():
    assert classify_complexity(1) == "simple"
    assert classify_complexity(5) == "simple"
    assert classify_complexity(6) == "moderate"
    assert classify_complexity(10) == "moderate"
    assert classify_complexity(11) == "complex"
    assert classify_complexity(20) == "complex"
    assert classify_complexity(21) == "untestable"


def test_compute_function_complexity_no_branches():
    source = "def foo():\n    return 1\n"
    assert compute_function_complexity(source, "python") == 1


def test_compute_function_complexity_single_if():
    source = "def foo(x):\n    if x:\n        return 1\n    return 2\n"
    assert compute_function_complexity(source, "python") == 2


def test_compute_function_complexity_if_elif_else():
    source = (
        "def foo(x):\n"
        "    if x == 1:\n"
        "        return 'a'\n"
        "    elif x == 2:\n"
        "        return 'b'\n"
        "    else:\n"
        "        return 'c'\n"
    )
    # 2 decision points (if, elif -- else is not a separate branch node) + 1
    assert compute_function_complexity(source, "python") == 3


def test_compute_coupling_score_isolated_module():
    assert compute_coupling_score("a.py", {}) == 0.0


def test_compute_coupling_score_fully_external():
    calls = {"a.py": [("b.py", "foo"), ("c.py", "bar")]}
    assert compute_coupling_score("a.py", calls) == 1.0


def test_compute_coupling_score_mixed():
    calls = {"a.py": [("a.py", "helper"), ("b.py", "foo")]}
    assert compute_coupling_score("a.py", calls) == 0.5


def test_compute_cohesion_score_no_pairs_defaults_to_one():
    assert compute_cohesion_score(0, 0) == 1.0


def test_compute_cohesion_score_caps_at_one():
    assert compute_cohesion_score(10, 5) == 1.0


def test_compute_technical_debt_minutes_formula():
    debt = compute_technical_debt_minutes(
        dead_code_functions=2,
        high_complexity_functions=1,
        uncovered_functions=3,
        security_critical_findings=1,
        missing_docstrings=4,
    )
    assert debt == 2 * 20 + 1 * 45 + 3 * 30 + 1 * 120 + 4 * 5
