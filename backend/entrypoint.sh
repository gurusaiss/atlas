#!/bin/sh
# Runs on every boot of the web service (not the Celery worker -- see
# Dockerfile.worker, which skips this to avoid two services racing to
# migrate the same database simultaneously).
set -e

echo "Running database migrations..."
alembic upgrade head

if [ "$RUN_SEED_ON_START" = "true" ]; then
  echo "RUN_SEED_ON_START=true -- seeding demo data (safe to re-run, checks existence first)..."
  python seed_demo_data.py || echo "Seeding failed or already seeded; continuing startup."
fi

exec "$@"
