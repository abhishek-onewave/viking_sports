# Card Investment Model v3 — production image
#
# Python 3.12 per the brief. Locally the service runs on 3.13 (3.12 was not
# installed) and the test suite passes on both; the container pins 3.12 so the
# deployed runtime is the specified one.
#
# Everything the model needs — the 9.5 MB bundle AND the wheels — is baked in.
# Nothing is fetched at request time.

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# libgomp is required by both XGBoost and CatBoost. curl is only for HEALTHCHECK.
RUN apt-get update && apt-get install --no-install-recommends -y \
        libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- dependency layer (cached unless requirements change) -------------------
COPY requirements.txt ./
COPY model_service/model/requirements_v3.txt ./model_service/model/
RUN pip install -r requirements.txt

# ---- application + model ---------------------------------------------------
# The bundle is copied INTO the image, never mounted from a public path and
# never downloaded at runtime.
COPY model_service/ ./model_service/

# Non-root. The service only ever reads the bundle.
RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

ENV MODEL_BUNDLE_PATH=/app/model_service/model/card_investment_bundle_v3.joblib \
    MODEL_METADATA_PATH=/app/model_service/model/model_metadata_v3.json \
    PORT=8000 \
    WEB_CONCURRENCY=2 \
    PREDICT_TIMEOUT_SECONDS=20 \
    LOG_LEVEL=INFO
# ALLOWED_ORIGINS is intentionally NOT defaulted here: the service falls back to
# localhost only, so a deploy that forgets it fails closed rather than open.

EXPOSE 8000

# Fails the container if the bundle is missing, stale or incomplete — the health
# endpoint returns 503 in every one of those cases.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/v1/card-investment/health" \
      | grep -q '"status": *"healthy"' || exit 1

# Gunicorn supervises N uvicorn workers. Each worker loads its OWN copy of the
# bundle once at startup (~9.5 MB + boosters resident), which is why
# WEB_CONCURRENCY is deliberately low rather than tied to core count.
CMD ["sh", "-c", "exec gunicorn model_service.app:app \
     --worker-class uvicorn.workers.UvicornWorker \
     --workers ${WEB_CONCURRENCY} \
     --bind 0.0.0.0:${PORT} \
     --timeout 60 \
     --graceful-timeout 30 \
     --access-logfile - \
     --error-logfile -"]
