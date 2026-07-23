# --- Build stage ---
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
# Pre-bake the small spaCy model at build time so PII scanning never triggers a
# ~400MB runtime auto-download the first time a guardrail check runs.
RUN python -m spacy download en_core_web_sm

# --- Runtime stage ---
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r atlas && useradd -r -g atlas -m atlas

WORKDIR /app

COPY --from=builder /root/.local /home/atlas/.local
COPY . .

RUN mkdir -p /app/chroma_data /app/tmp_uploads && chown -R atlas:atlas /app \
    && chmod +x /app/entrypoint.sh

ENV PATH=/home/atlas/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

USER atlas

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
