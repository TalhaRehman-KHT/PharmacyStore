# Production image for medassist-api (two stages: build the venv, then copy only what runs).
# Base pinned to a Python patch release; bump it on purpose, not by accident.
ARG PYTHON_IMAGE=python:3.12.15-slim-bookworm
# true = also install FlashRank (~180 MB) and bake its model in, for RERANK_ENABLED=true.
ARG WITH_RERANK=false
# Must match RERANK_MODEL in the runtime env (config.py default).
ARG RERANK_MODEL=ms-marco-MiniLM-L-12-v2

# ---------- builder: install the dependencies into a venv ----------
FROM ${PYTHON_IMAGE} AS builder
ARG WITH_RERANK
ARG RERANK_MODEL

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt requirements-rerank.txt /tmp/
RUN pip install -r /tmp/requirements.txt \
    && if [ "$WITH_RERANK" = "true" ]; then pip install -r /tmp/requirements-rerank.txt; fi \
    # pip itself is not needed at runtime
    && pip uninstall -y pip

# Download the reranker model at build time (rerank.py loads it from /srv/data/flashrank).
# Without WITH_RERANK the folder stays empty and is not copied into the final image.
RUN mkdir -p /srv/data/flashrank \
    && if [ "$WITH_RERANK" = "true" ]; then \
        python -c "import sys; from flashrank import Ranker; Ranker(model_name=sys.argv[1], cache_dir='/srv/data/flashrank')" "$RERANK_MODEL"; \
    fi

# ---------- runtime: venv + app/ only, non-root ----------
FROM ${PYTHON_IMAGE}
ARG WITH_RERANK

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Fixed uid so file ownership is the same on every host; no home dir and no login shell needed.
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin app

WORKDIR /srv
COPY --from=builder /opt/venv /opt/venv
# app/ includes prompts/*.txt and safety/keywords.yaml, which the app reads at runtime.
COPY app/ ./app/
# Only with WITH_RERANK=true: ship the baked model, owned by the app user (FlashRank can write its cache there).
RUN --mount=type=bind,from=builder,source=/srv/data,target=/tmp/data \
    if [ "$WITH_RERANK" = "true" ]; then \
        cp -r /tmp/data /srv/data && chown -R app:app /srv/data; \
    fi

USER app
EXPOSE 8000

# Liveness only (no DB call); honours API_PREFIX. The slim image has no curl, so plain urllib.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; p = os.environ.get('API_PREFIX', '').strip().strip('/'); urllib.request.urlopen('http://127.0.0.1:8000' + ('/' + p if p else '') + '/health', timeout=4)"]

# --proxy-headers: client IP and https scheme from the load balancer's X-Forwarded-* headers,
# trusted only from FORWARDED_ALLOW_IPS (uvicorn reads that env variable; default 127.0.0.1).
# --workers 1: one process per container; scale with more tasks, not more workers.
# --no-access-log: the app writes its own JSON access line (app/observability.py).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--workers", "1", "--no-access-log"]
