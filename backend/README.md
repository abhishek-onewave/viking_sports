# Card Investment Model v3 — service

FastAPI service serving the supplied v3 joblib bundle. The Valhalla frontend is a
static Vite SPA on Vercel with no Python runtime, so the model runs as a separate
service and the SPA calls it over HTTPS.

```
Browser (Vercel, static)                 This service (container)
  /analysis  ──fetch──►  POST /api/v1/card-investment/predict
                                  │
                                  ├─ schemas.py       validate
                                  ├─ model_manager.py bundle loaded ONCE
                                  └─ model/card_investment_inference_v3.py
                                            (supplied, unmodified)
```

**The bundle never leaves the server.** It is not in `public/`, not in `dist/`,
not importable from Node, and its path is never accepted from a request.

---

## Run locally

```bash
cd backend
python3.12 -m venv .venv                    # 3.13 also works
.venv/bin/pip install -r requirements-dev.txt

ALLOWED_ORIGINS="http://localhost:3000" \
  .venv/bin/python -m uvicorn model_service.app:app --port 8000 --reload
```

Then in the frontend root:

```bash
echo 'VITE_MODEL_API_URL=http://127.0.0.1:8000' > .env.local
npm run dev            # http://localhost:3000/analysis
```

## Verify

```bash
curl -s localhost:8000/api/v1/card-investment/health | python3 -m json.tool
# {"status":"healthy","model_version":"3.0","model_loaded":true,
#  "market_data_as_of":"2026-08-25"}

.venv/bin/python -m pytest model_service/tests -q      # 25 passed
```

## Environment variables

| variable | default | purpose |
|---|---|---|
| `MODEL_BUNDLE_PATH` | `./model_service/model/card_investment_bundle_v3.joblib` | **server-side only** |
| `MODEL_METADATA_PATH` | `./model_service/model/model_metadata_v3.json` | version for `/health` |
| `ALLOWED_ORIGINS` | localhost only | comma-separated exact origins, **no wildcard** |
| `PORT` | `8000` | |
| `WEB_CONCURRENCY` | `2` | workers — each loads its own bundle |
| `PREDICT_TIMEOUT_SECONDS` | `20` | |
| `LOG_LEVEL` | `INFO` | |
| `DOCS_URL` | unset | leave unset in production |

`ALLOWED_ORIGINS` deliberately has **no permissive default**: a deploy that
forgets it serves localhost only, which fails closed rather than open.

## Container

```bash
docker build -t valhalla-card-model:3.0 .
docker run -p 8000:8000 \
  -e ALLOWED_ORIGINS="https://valhalla-sports.com" \
  -e WEB_CONCURRENCY=2 \
  valhalla-card-model:3.0
```

Python 3.12, `libgomp1` for XGBoost/CatBoost, non-root user, and a `HEALTHCHECK`
that fails the container when the bundle is missing, the version is not 3.0, a
required component is absent, or the comparable-market date is unavailable.

Keep `WEB_CONCURRENCY` low. Each worker holds its own copy of the bundle plus
the deserialized boosters, so workers cost memory rather than sharing it.

## Why the loader is a shim, not a fork

`predict_card()` ends with `bundle_path` and calls `joblib.load()` on **every**
invocation. Reloading 9.5 MB per request would add ~1s of CPU to each prediction.

`model_manager.py` fixes that without touching the maths: it rebinds
`inference.joblib` — *that module's namespace only* — to a memoizing shim, so
`predict_card` still executes byte-for-byte identically and its `joblib.load()`
returns the already-deserialized bundle.

The alternative was forking the function to accept a bundle, which duplicates
~60 lines of scoring logic that would then need updating in lockstep with any
new bundle. That divergence is exactly how a model starts producing confidently
wrong numbers, so the shim is the safer trade.

`test_bundle_loads_only_once` asserts `load_count == 1` across five requests.

## Endpoints

| method | path | notes |
|---|---|---|
| `GET` | `/api/v1/card-investment/health` | 200 healthy / 503 with a `checks` breakdown |
| `POST` | `/api/v1/card-investment/predict` | full `predict_card()` output + `price_headroom`, `exceeds_maximum` |
| `GET` | `/api/v1/card-investment/metadata` | non-secret facts for the UI explanation panel |

### Validation

| field | rule |
|---|---|
| `asset_type` | one of `Cards (Non-Rookie)`, `Rookie Cards`, `Stickers` |
| `card_name` | required, non-blank after trimming |
| `purchase_amount` | `> 0`, `<= 100,000,000` |
| `acquisition_year` | 1900 … current year + 1 |
| `deal_status` | `unreleased` or `sold` |
| `hold_period` | must map to 6, 12, 24, 36 or 60 months |

`hold_period` is **rejected** rather than snapped. `_hold_months()` would quietly
turn "18 months" into 24; answering a different question from the one asked is
worse than refusing.

## Deployment

Any container host — Cloud Run, Fly, Render, ECS, a VM. Then:

1. Set `ALLOWED_ORIGINS` to the exact frontend origin.
2. Terminate TLS at the platform; the service speaks plain HTTP behind it.
3. Set `VITE_MODEL_API_URL` in the Vercel project to the service's HTTPS URL and
   redeploy the frontend (Vite inlines it at build time).
4. Confirm `/health` returns 200 with `model_version: "3.0"`.

Cloud Run needs `--min-instances 1`: a cold start pays the bundle load, and the
90-second `start-period` in the healthcheck exists for that reason.

## Known limitations

**`match_score` is a ranking score, not a probability.** It exceeds 1.0 in
practice (1.1457 for the Jordan example). The frontend never renders it as a
percentage, and it must not be used as a confidence figure.

**Deal status is recorded but is not a trained feature** — training outcomes are
completed sales.

**Valuation quality should not be quoted as "95.16% accuracy."** The log R² is
0.9516; the honest figure for a reader is the **~18.37% median absolute
percentage error**.

**REVIEW covers most cases.** High-confidence automatic decisions reached 87.58%
accuracy but on only **9.57%** of cases. Across all cases accuracy is 64.04%.
Most opportunities will land in REVIEW, and that is the model working as
designed rather than failing.
