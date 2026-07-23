# Atlas API Reference

Interactive docs (Swagger UI) are always available at `/docs` when the
backend is running, generated directly from the FastAPI route definitions --
this file is a human-readable summary of the same surface, per Part H.

Base URL: `http://localhost:8000` (local) or your deployed backend URL.

All endpoints except `/health`, `/health/ready`, `/api/v1/auth/register`,
`/api/v1/auth/login`, and `/api/v1/demo/*` require a JWT access token:
`Authorization: Bearer <access_token>`.

## Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create an account |
| POST | `/api/v1/auth/login` | Get access + refresh tokens (refresh set as httpOnly cookie) |
| POST | `/api/v1/auth/refresh` | Rotate refresh token, issue a new access token |
| POST | `/api/v1/auth/logout` | Revoke the current refresh token |
| GET | `/api/v1/auth/me` | Current authenticated user |

## Projects

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/projects` | List your projects (paginated) |
| POST | `/api/v1/projects` | Create a project |
| GET | `/api/v1/projects/{id}` | Project detail + stats (repo/job/finding counts) |
| PUT | `/api/v1/projects/{id}` | Update name/description |
| DELETE | `/api/v1/projects/{id}` | Soft delete |

## Repositories

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/projects/{id}/repositories` | List a project's repositories |
| POST | `/api/v1/projects/{id}/repositories/upload` | Upload a ZIP (multipart, max 50MB) |
| POST | `/api/v1/projects/{id}/repositories/github` | Clone a public GitHub repo (github.com URLs only) |
| GET | `/api/v1/repositories/{id}` | Repository detail + per-file metrics |
| DELETE | `/api/v1/repositories/{id}` | Delete a repository |

## Jobs

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/jobs` | Start an analysis job for a ready repository |
| GET | `/api/v1/jobs` | List your jobs (filterable by `status_filter`) |
| GET | `/api/v1/jobs/{id}` | Job status/progress |
| GET | `/api/v1/jobs/{id}/stream` | SSE stream of live progress (`progress`, `agent_complete`, `complete`, `error` events) |
| DELETE | `/api/v1/jobs/{id}` | Cancel a queued/running job |

## Results

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/jobs/{id}/results` | Summary of all agent results |
| GET | `/api/v1/jobs/{id}/documentation` | Architecture documentation (Markdown) |
| GET | `/api/v1/jobs/{id}/decomposition` | Microservices decomposition plan (JSON + Mermaid) |
| GET | `/api/v1/jobs/{id}/tests` | List of generated test files |
| GET | `/api/v1/jobs/{id}/tests/{test_file}` | One generated test file's content |
| GET | `/api/v1/jobs/{id}/security` | Security findings (filterable by `severity`) |
| GET | `/api/v1/jobs/{id}/quality` | Critic + Evaluator scores |

## Findings

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/findings` | List findings (filter by `job_id`, `repository_id`, `severity`, `finding_type`, `category`) |
| GET | `/api/v1/findings/stats` | Counts grouped by severity/type/category |
| PATCH | `/api/v1/findings/{id}` | Mark a finding as a false positive |

## Reports

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/reports/{job_id}` | List reports for a job |
| GET | `/api/v1/reports/{job_id}/markdown` | Download the full report as Markdown |
| GET | `/api/v1/reports/{job_id}/pdf` | Download the full report as PDF (reportlab-generated) |

## Demo (no auth required)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/demo/repositories` | List the 3 pre-seeded demo repositories |
| POST | `/api/v1/demo/load/{repo_name}` | Get the completed demo job ID for a repo (`legacy_bank_app`, `ecommerce_api`, `small_demo_app`) |
| GET | `/api/v1/demo/status` | Whether demo data has been seeded |

## Analytics

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/analytics/dashboard` | Aggregate stats across your projects |
| GET | `/api/v1/analytics/guardrails` | Guardrail event counts by check type/action |
| GET | `/api/v1/analytics/tokens` | Daily token usage by model |

## Health & Metrics

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/health/ready` | Readiness check (verifies DB + Redis connectivity) |
| GET | `/metrics` | Prometheus metrics |
