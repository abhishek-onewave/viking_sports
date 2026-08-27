"""
app.py — FastAPI service for Card Investment Model v3.

Runs as a SEPARATE service because the Valhalla frontend is a static Vite SPA on
Vercel with no Python runtime, and the model is a 9.5 MB XGBoost + CatBoost
joblib bundle. It cannot go in the browser, cannot be imported by Node, and must
never be served from a static directory.

    GET  /api/v1/card-investment/health
    POST /api/v1/card-investment/predict

SECURITY POSTURE
----------------
  * the bundle path comes from MODEL_BUNDLE_PATH (server-side env) and is never
    read from a request — a client-supplied path would be both an arbitrary-file
    read and a pickle deserialization sink
  * CORS is restricted to explicitly configured origins; the default is
    localhost only, so a misconfigured deploy fails closed rather than open
  * no Python traceback ever reaches a client; errors carry a request id and the
    detail goes to the log
  * request logging records shape and timing, not card names or amounts
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:                                     # package or flat import
    from .model_manager import manager
    from .schemas import (ErrorResponse, HealthResponse, PredictRequest,
                          PredictResponse)
except ImportError:                      # pragma: no cover
    from model_manager import manager
    from schemas import (ErrorResponse, HealthResponse, PredictRequest,
                         PredictResponse)

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)-7s %(name)s %(message)s")
log = logging.getLogger("model_service")

API_PREFIX = "/api/v1/card-investment"
PREDICT_TIMEOUT_SECONDS = float(os.environ.get("PREDICT_TIMEOUT_SECONDS", "20"))

# Fail CLOSED: no env var means localhost dev only, never "*".
_origins_raw = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [o.strip() for o in _origins_raw.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the bundle ONCE at startup.

    Loading here rather than lazily means a bad bundle fails the deploy instead
    of the first user's request, and the container health check catches it.
    """
    try:
        manager.load()
        log.info("model ready: version=%s as_of=%s loads=%d",
                 manager.model_version(), manager.market_data_as_of(),
                 manager.load_count)
    except Exception:                                     # noqa: BLE001
        # Do not crash: /health must stay reachable to report WHY it is unhealthy.
        log.exception("startup model load failed — service will report unhealthy")
    yield


app = FastAPI(
    title="Valhalla Card Investment Model",
    version="3.0",
    description="Serves Card Investment Model v3. Not a public API.",
    lifespan=lifespan,
    docs_url=os.environ.get("DOCS_URL") or None,   # off unless explicitly enabled
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Attach a request id and log timing — never the payload.

    Card names and purchase amounts are business-sensitive, so the log records
    the route, status and duration only.
    """
    rid = str(uuid.uuid4())[:8]
    request.state.request_id = rid
    t0 = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:                                     # noqa: BLE001
        log.exception("[%s] unhandled error on %s", rid, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                error="internal_error",
                detail="An unexpected error occurred.",
                request_id=rid).model_dump())
    dur = (time.perf_counter() - t0) * 1000
    response.headers["X-Request-ID"] = rid
    log.info("[%s] %s %s -> %d in %.0fms", rid, request.method,
             request.url.path, response.status_code, dur)
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Structured field-level errors, so the form can point at the right input."""
    fields = []
    for e in exc.errors():
        loc = [str(p) for p in e.get("loc", []) if p != "body"]
        fields.append({"field": ".".join(loc) or "body",
                       "message": e.get("msg", "invalid value")})
    rid = getattr(request.state, "request_id", None)
    log.info("[%s] validation rejected: %s", rid,
             [f["field"] for f in fields])
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ErrorResponse(error="validation_error", detail=fields,
                              request_id=rid).model_dump())


# ------------------------------------------------------------------- routes
@app.get(f"{API_PREFIX}/health", response_model=HealthResponse)
async def health():
    h = manager.health()
    code = (status.HTTP_200_OK if h["status"] == "healthy"
            else status.HTTP_503_SERVICE_UNAVAILABLE)
    return JSONResponse(status_code=code, content=h)


@app.post(f"{API_PREFIX}/predict")
async def predict(payload: PredictRequest, request: Request):
    rid = getattr(request.state, "request_id", None)

    if not manager.loaded:
        try:
            manager.load()
        except Exception:                                 # noqa: BLE001
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content=ErrorResponse(
                    error="model_unavailable",
                    detail="The model is not loaded. Check /health.",
                    request_id=rid).model_dump())

    try:
        # Off the event loop: the prediction is synchronous CPU work, and running
        # it inline would block every other request on this worker.
        result = await asyncio.wait_for(
            asyncio.to_thread(
                manager.predict,
                asset_type=payload.asset_type,
                card_name=payload.card_name,
                hold_period=payload.hold_period,
                purchase_amount=payload.purchase_amount,
                acquisition_year=payload.acquisition_year,
                deal_status=payload.deal_status),
            timeout=PREDICT_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        log.warning("[%s] prediction timed out after %.0fs", rid,
                    PREDICT_TIMEOUT_SECONDS)
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content=ErrorResponse(
                error="prediction_timeout",
                detail="The prediction took too long. Please retry.",
                request_id=rid).model_dump())
    except ValueError as e:
        # predict_card raises this for a non-positive amount; schemas should have
        # caught it first, so this is a backstop rather than the main path.
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(error="invalid_input", detail=str(e),
                                  request_id=rid).model_dump())
    except Exception:                                     # noqa: BLE001
        log.exception("[%s] prediction failed", rid)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                error="prediction_failed",
                detail="The model could not score this input.",
                request_id=rid).model_dump())

    # Derive the guardrail comparison SERVER-side so the UI cannot reach a
    # different conclusion from the backend about the same numbers.
    entered = float(result["entered_purchase_amount"])
    max_price = float(result["maximum_recommended_purchase_price"])
    result["price_headroom"] = round(max_price - entered, 2)
    result["exceeds_maximum"] = entered > max_price

    # Belt and braces on the brief's hard rule: never surface BUY when the price
    # is above the maximum. predict_card already enforces it; this asserts it
    # rather than trusting it, because a future bundle could change the order.
    if result["exceeds_maximum"] and \
            result["final_recommendation_with_price_guardrail"] == "BUY":
        log.error("[%s] guardrail inconsistency — forcing DO NOT BUY", rid)
        result["final_recommendation_with_price_guardrail"] = "DO NOT BUY"

    return JSONResponse(status_code=status.HTTP_200_OK,
                        content=PredictResponse(**result).model_dump())


@app.get(f"{API_PREFIX}/metadata")
async def metadata():
    """Non-secret model facts for the UI's explanation panel."""
    return {
        "model_version": manager.model_version(),
        "market_data_as_of": manager.market_data_as_of(),
        "transaction_cost_rate": 0.12,
        "required_annual_return": 0.10,
        "supported_horizons_months": [6, 12, 24, 36, 60],
        "high_confidence_accuracy": 0.8758,
        "high_confidence_coverage": 0.0957,
        "full_coverage_accuracy": 0.6404,
        "median_absolute_percentage_valuation_error": 0.1837,
        "thresholds": manager.thresholds(),
    }
