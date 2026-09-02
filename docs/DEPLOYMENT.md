# Atlas Deployment Guide

Atlas is designed to run entirely on free tiers (Constraint 3). This guide
covers both local Docker development and the free-tier production stack
(Render + Vercel + Neon + Upstash).

## Local development (Docker)

```bash
git clone <repo-url>
cd atlas
cp backend/.env.example backend/.env   # fill in free-tier API keys
docker compose up --build
python backend/seed_demo_data.py       # populates demo data + runs a live analysis
```

- Backend: http://localhost:8000 (docs at `/docs`)
- Frontend: http://localhost:5173
- Postgres: localhost:5432 (used only for local dev; production uses Neon)
- Redis: localhost:6379

## Production stack

| Component | Provider | Why |
|---|---|---|
| Backend API + Celery worker | Render | Free tier, Docker-native web service + background worker |
| Frontend (static build) | Vercel | Free tier, zero-config Vite/React hosting |
| Postgres | Neon | Free serverless Postgres, same wire protocol as local Docker Postgres |
| Redis (cache + Celery broker) | Upstash | Free tier, serverless Redis |
| Observability | Grafana Cloud | Free tier: 10K metrics/month, 50GB logs |

### 1. Provision Neon (Postgres)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string; convert it to the async form Atlas expects:
   `postgresql+asyncpg://user:pass@host/dbname?sslmode=require`

### 2. Provision Upstash (Redis)

1. Create a database at [upstash.com](https://upstash.com).
2. Copy the `rediss://` connection URL (Upstash uses TLS).

### 3. Deploy the backend + Celery worker to Render

Render's Docker environment has no "Start Command" field -- it just runs
whatever `CMD` is in the Dockerfile. Since the web service and the worker need
different commands, they use two different Dockerfiles (`Dockerfile` for
uvicorn, `Dockerfile.worker` for Celery), selected via each service's
**Dockerfile Path** setting.

1. Create a new Render **Web Service** from this repo. Root Directory: `backend`.
   Environment: Docker. Dockerfile Path: `Dockerfile` (the default). Name it `atlas-backend`.
2. Create a Render **Background Worker** from the same repo. Root Directory: `backend`.
   Environment: Docker. Dockerfile Path: `Dockerfile.worker`. Name it `atlas-celery-worker`.
3. Set environment variables on both services (from `backend/.env.example`):
   `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `GROQ_API_KEY` (and `GEMINI_API_KEY`
   / `MISTRAL_API_KEY` once you have them), `CORS_ORIGINS` (your Vercel URL), and
   **`APP_ENV=production`**. That last one is not cosmetic -- `app/config.py`
   refuses to boot in production with the default `SECRET_KEY`, an empty
   `CORS_ORIGINS`, or a wildcard `CORS_ORIGINS=*`, but that check only runs when
   `APP_ENV` is actually set to `production`. Generate a real `SECRET_KEY` with:
   `python -c "import secrets; print(secrets.token_urlsafe(64))"`. Also set
   `DEBUG=false` (defaults to `true`, which is fine locally but has no reason
   to be on in production -- it only controls tracing log verbosity here, not
   error detail leakage, but there's no reason to leave it on).
4. Neither service needs a Start Command set -- each Dockerfile's `CMD` handles it.
5. Migrations run automatically on every `atlas-backend` boot (via
   `entrypoint.sh` running `alembic upgrade head` before uvicorn starts) --
   no Shell access needed, which matters because Render's free tier doesn't
   include Shell.
6. To seed demo data (also Shell-free): on `atlas-backend`, add the environment
   variable `RUN_SEED_ON_START=true` and save -- Render redeploys, and
   `entrypoint.sh` runs `python seed_demo_data.py` once before starting the
   server. Watch the deploy logs for "Demo data loaded." Afterward, set
   `RUN_SEED_ON_START` back to `false` (seeding is idempotent and safe to leave
   on, but turning it off skips the existence-check queries on every future boot).
7. Render auto-deploys both services on every push to `main` once connected to
   the GitHub repo -- no extra CI wiring needed for the backend/worker.

### 4. Deploy the frontend to Vercel

1. Import the repo into Vercel, set the root directory to `frontend/`.
2. Set the build command to `npm run build`, output directory `dist`.
3. Set `VITE_API_BASE_URL` to the Render backend's public URL.

### 5. Wire up GitHub Actions secrets (frontend + optional explicit redeploy)

For `.github/workflows/deploy.yml` to deploy the frontend automatically on
push to `main`, set these repository secrets: `VERCEL_TOKEN`,
`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. If you want the workflow to also
trigger an explicit backend redeploy (instead of relying on Render's native
auto-deploy), set `RENDER_BACKEND_DEPLOY_HOOK_URL` and
`RENDER_WORKER_DEPLOY_HOOK_URL` (from each service's Settings -> Deploy Hook).

### 6. Observability (optional but recommended)

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to your Grafana Cloud Tempo endpoint, and
import `grafana/dashboard.json` into a Grafana Cloud instance pointed at
Render's `/metrics` endpoint (via a Prometheus remote-write agent, or
Grafana Cloud's hosted Prometheus scrape).

## Free-tier limits to plan around

- **Neon**: compute autosuspends after a few minutes idle (~1-2s cold start on
  next query). Pre-warm before a live demo by hitting `/health/ready` first.
- **Render**: free web services spin down after ~15 minutes of inactivity and
  take up to ~50s to cold-start the next request -- worse than Neon's cold
  start, so pre-warm the backend itself (not just the DB) a minute or two
  before a live interview demo. Free tier is fine for a portfolio project,
  not for sustained production traffic.
- **Upstash**: free tier caps daily commands; the 24h LLM response cache TTL
  keeps this well within limits for demo-scale usage.
- **Gemini/Groq/Mistral free tiers**: see `backend/.env.example` for current
  rate limits; the multi-provider fallback in `app/llm/client.py` exists
  specifically so hitting one provider's limit doesn't fail a job.
