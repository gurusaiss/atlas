#!/bin/sh
# Runs on every boot of the web service (not the Celery worker -- see
# Dockerfile.worker, which skips this to avoid two services racing to
# migrate the same database simultaneously).
#
# Demo seeding is NOT run here. seed_demo_data.py's small_demo_app seed runs
# the full live LangGraph pipeline (loads sentence-transformers + chromadb,
# calls the LLM providers), which needs far more than the 512Mi a Render
# free-tier instance gets -- running it before the port binds causes an OOM
# kill, and since the port never opens Render restarts the container and
# reruns it forever. Run it manually once instead, e.g. from Render's Shell
# tab: `python seed_demo_data.py` (it is idempotent -- safe to re-run).
set -e

echo "Running database migrations..."
alembic upgrade head

exec "$@"
