"""Per-job token budget enforcement -- the "Shield" step of Scan-Shield-Steer."""

from dataclasses import dataclass


@dataclass
class BudgetCheckResult:
    allowed: bool
    tokens_spent: int
    tokens_remaining: int
    budget: int


def check_budget(tokens_spent: int, budget: int, estimated_next_call_tokens: int) -> BudgetCheckResult:
    remaining = budget - tokens_spent
    allowed = estimated_next_call_tokens <= remaining
    return BudgetCheckResult(
        allowed=allowed, tokens_spent=tokens_spent, tokens_remaining=remaining, budget=budget
    )
