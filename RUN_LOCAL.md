# Run the Card Investment analyser locally

Two processes. **No environment variables needed** — the app defaults to
`http://127.0.0.1:8000` in development, which is where the service runs.

## Terminal 1 — model service

```bash
cd "backend"
python3 -m venv .venv                       # first time only
.venv/bin/pip install -r requirements-dev.txt   # first time only

.venv/bin/python -m uvicorn model_service.app:app --port 8000 --reload
```

Wait for `model ready: version=3.0` in the log (~5s: that is the 9.5 MB bundle
deserializing). Then:

```bash
curl -s localhost:8000/api/v1/card-investment/health
# {"status":"healthy","model_version":"3.0","model_loaded":true,
#  "market_data_as_of":"2026-08-25"}
```

## Terminal 2 — the app

```bash
npm install        # first time only
npm run dev
```

## Open it

**http://localhost:3000/analysis**

Also reachable from the landing page: scroll to **Deal Analyzer** → the gold
panel *"Analysing a specific card?"* → **Open card analysis**.

## Try it

| field | value |
|---|---|
| Asset type | Cards (Non-Rookie) |
| Card name | `1986 Fleer Michael Jordan #57 PSA 10 Rookie Card` |
| Holding period | 2 years |
| Purchase amount | 150000 |
| Acquisition year | 2026 |
| Deal status | Unreleased |

Expected: matches **1986 Fleer #57 Michael Jordan - PSA GEM MINT 10** and returns
**DO NOT BUY** — the provisional signal is BUY, but $150,000 exceeds the $127,459
maximum, so the price guardrail overrides it. That is the guardrail working.

Enter **100000** instead and the same card returns **REVIEW**: the price now
clears the maximum, but the model's confidence falls between the selective
cutoffs, so it will not act automatically.

## Check it from the terminal

```bash
# is the app able to reach the service?
curl -s localhost:3000/api/card-investment/health

# a full prediction, straight through the app
curl -s -X POST localhost:3000/api/card-investment/predict \
  -H 'Content-Type: application/json' \
  -d '{"asset_type":"Cards (Non-Rookie)",
       "card_name":"1986 Fleer Michael Jordan #57 PSA 10",
       "hold_period":"2 years","purchase_amount":150000,
       "acquisition_year":2026,"deal_status":"unreleased"}'
```

## Run the tests

```bash
cd backend && .venv/bin/python -m pytest model_service/tests -v   # 25 tests
```

## Troubleshooting

| symptom | cause | fix |
|---|---|---|
| `"configured": false` | you are running a **production** build without `MODEL_API_URL` | set it, or use `npm run dev` |
| `"status":"unhealthy"` | the service is not running | start Terminal 1 |
| `Address already in use` on :8000 | an old service is still up | `pkill -f "uvicorn model_service"` |
| Health hangs ~5s then fails | the service is still loading the bundle | wait for `model ready` in its log |
| `ModuleNotFoundError: xgboost` | wrong interpreter | use `.venv/bin/python`, not `python3` |

The service must be running **before** you submit the form. The page probes
health on load and shows an amber warning if analysis is unavailable, so you will
see the problem before filling six fields.
