"""Prometheus metric definitions, per Part J of the spec.

Imported by agents/tasks/guardrails to increment counters as work happens;
exposed at /metrics via prometheus-fastapi-instrumentator in main.py.
"""

from prometheus_client import Counter, Gauge, Histogram

jobs_total = Counter("atlas_jobs_total", "Total jobs by final status", ["status"])
job_duration_seconds = Histogram("atlas_job_duration_seconds", "Job execution time", ["job_type"])
agent_duration_seconds = Histogram(
    "atlas_agent_duration_seconds", "Per-agent execution time", ["agent_type"]
)
llm_tokens_total = Counter("atlas_llm_tokens_total", "Tokens consumed", ["model", "agent"])
llm_requests_total = Counter(
    "atlas_llm_requests_total", "LLM call outcomes", ["model", "status"]
)  # status: success | failed | cached
llm_cache_hits_total = Counter("atlas_llm_cache_hits_total", "LLM cache hits")
guardrail_events_total = Counter(
    "atlas_guardrail_events_total", "Guardrail events", ["type", "action"]
)
findings_total = Counter("atlas_findings_total", "Findings created", ["severity", "category"])
rate_limit_hits_total = Counter("atlas_rate_limit_hits_total", "Rate limit events", ["model"])
active_jobs = Gauge("atlas_active_jobs", "Currently running jobs")
