# Deploying the model service to Railway

## Why Railway rather than Vercel

Vercel runs the frontend well and cannot run this service at all. A Vercel
serverless function is capped at 250 MB unzipped; the model's runtime —
scikit-learn, XGBoost and CatBoost with their native libraries — is around
536 MB. The 9.5 MB model bundle was never the problem, the libraries are, and
no amount of trimming closes a 286 MB gap.

Railway runs a container instead, so the cap does not apply. The split is the
normal one for this shape of app and is worth keeping even if Vercel's limit
were to rise:

    Vercel   Next.js frontend + /api route handlers   (fast, edge-ish, tiny)
    Railway  FastAPI + the model in a container       (heavy, long-lived, warm)

Keeping the model in a long-lived container also avoids reloading a 9.5 MB
bundle on every cold start, which is what makes the first prediction slow.

## One-time setup

### 1. Create the service

On railway.app: **New Project → Deploy from GitHub repo →
`abhishek-onewave/viking_sports`**.

Then, in **Settings → Source**, set:

| field | value |
|---|---|
| Branch | `version3` |
| **Root Directory** | **`backend`** |

The root directory is the step people miss. The repo root is the Next.js app;
without it Railway tries to build the frontend and fails. Setting it to
`backend` makes that folder the Docker build context, which is what the
Dockerfile's `COPY requirements.txt ./` expects.

`railway.json` in this folder is then picked up automatically and selects the
Dockerfile builder and the health check.

### 2. Set the environment variables

**Variables** tab:

    ALLOWED_ORIGINS=https://<your-vercel-domain>.vercel.app,https://valhalla-sports.com
    WEB_CONCURRENCY=2
    LOG_LEVEL=INFO

Do NOT set `PORT`. Railway injects it, and the Dockerfile already binds
`0.0.0.0:${PORT}`. Setting it by hand is the usual cause of a container that
builds fine and then fails its health check.

`MODEL_BUNDLE_PATH` and `MODEL_METADATA_PATH` are already baked into the image
and should be left alone.

On `ALLOWED_ORIGINS`: the browser never calls this service directly — the
Next.js route handler proxies server-to-server, where CORS does not apply. Set
it correctly anyway, so that a future direct browser call fails loudly rather
than silently depending on a proxy that might be removed.

### 3. Generate a public URL

**Settings → Networking → Generate Domain.** You get something like
`viking-model-production.up.railway.app`.

Verify it before touching the frontend:

```bash
curl -s https://<your-railway-domain>/api/v1/card-investment/health | jq
```

Expect `"status": "healthy"`. A 503 means the bundle did not load — check the
deploy logs; the health endpoint deliberately reports 503 rather than 200 when
the bundle is missing, stale or incomplete, so this check is meaningful.

### 4. Point Vercel at it

Vercel project → **Settings → Environment Variables**:

    MODEL_API_URL = https://<your-railway-domain>

Set it for **Production, Preview and Development**. Note there is no
`NEXT_PUBLIC_` prefix, and that is deliberate — the URL stays server-side so
the model service is never addressable from the browser.

**Redeploy the Vercel app.** `MODEL_API_URL` is read at request time by
`resolveService()`, but a redeploy is still needed for the new variable to be
present in the environment at all.

### 5. Confirm end to end

```bash
curl -s https://<your-vercel-domain>/api/card-investment/health | jq
```

This exercises the whole chain: browser → Vercel route handler → Railway
container → model. If step 3 was healthy and this is not, the problem is
`MODEL_API_URL`, not the model.

## Cost and sizing

The image is roughly 1.2 GB and each Gunicorn worker holds its own copy of the
bundle, so memory scales with `WEB_CONCURRENCY`. Two workers sit comfortably
inside 1 GB. Railway's usage-based pricing puts a service this size in the few
dollars a month range at low traffic.

Leave `numReplicas` at 1. Horizontal scaling multiplies memory without helping
latency until you are actually CPU-bound on predictions.

## If the deploy fails

| symptom | cause |
|---|---|
| Build runs `npm install` | Root Directory not set to `backend` |
| Health check times out | `PORT` set manually — remove it |
| 503 from `/health` | Bundle missing from image; check `.dockerignore` |
| Frontend says "not configured" | `MODEL_API_URL` unset, or set but not redeployed |
| CORS error in the browser | A direct browser call; it should go via the route handler |

## Alternatives already configured

`render.yaml` and `fly.toml` are in the repo from earlier work. Any of the
three will run this container; Railway is the least configuration. Pick one —
running the same service on two hosts just doubles the cost and gives you two
URLs to keep in sync.
