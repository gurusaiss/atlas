# Atlas Deployment Guide

Atlas is designed to run entirely on free tiers (Constraint 3). This guide
covers both local Docker development and the free-tier production stack
(Railway + Vercel + Neon + Upstash).

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
| Backend API + Celery worker | Railway | Free tier, easy multi-service deploys, Docker-native |
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

### 3. Deploy the backend + Celery worker to Railway

1. Create a new Railway project, add two services from the same repo
   (`backend/Dockerfile`): `atlas-backend` and `atlas-celery-worker`.
2. Set environment variables on both services (from `backend/.env.example`):
   `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`,
   `MISTRAL_API_KEY`, `CORS_ORIGINS` (your Vercel URL).
3. `atlas-backend`'s start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4`
4. `atlas-celery-worker`'s start command: `celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2`
5. Run migrations once: `railway run --service atlas-backend alembic upgrade head`
6. Seed demo data once: `railway run --service atlas-backend python seed_demo_data.py`

### 4. Deploy the frontend to Vercel

1. Import the repo into Vercel, set the root directory to `frontend/`.
2. Set the build command to `npm run build`, output directory `dist`.
3. Set `VITE_API_BASE_URL` to the Railway backend's public URL.

### 5. Wire up GitHub Actions secrets

For `.github/workflows/deploy.yml` to deploy automatically on push to `main`,
set these repository secrets: `RAILWAY_TOKEN`, `VERCEL_TOKEN`,
`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

### 6. Observability (optional but recommended)

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to your Grafana Cloud Tempo endpoint, and
import `grafana/dashboard.json` into a Grafana Cloud instance pointed at
Railway's `/metrics` endpoint (via a Prometheus remote-write agent, or
Grafana Cloud's hosted Prometheus scrape).

## Free-tier limits to plan around

- **Neon**: compute autosuspends after a few minutes idle (~1-2s cold start on
  next query). Pre-warm before a live demo by hitting `/health/ready` first.
- **Railway**: free tier has a monthly usage credit, not unlimited uptime --
  fine for a portfolio/interview project, not for sustained production traffic.
- **Upstash**: free tier caps daily commands; the 24h LLM response cache TTL
  keeps this well within limits for demo-scale usage.
- **Gemini/Groq/Mistral free tiers**: see `backend/.env.example` for current
  rate limits; the multi-provider fallback in `app/llm/client.py` exists
  specifically so hitting one provider's limit doesn't fail a job.
