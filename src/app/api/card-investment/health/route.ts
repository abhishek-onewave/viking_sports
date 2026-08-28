/**
 * Health proxy. Lets the UI warn that analysis is unavailable BEFORE the user
 * fills six fields, without exposing the model service URL to the browser.
 *
 * Also distinguishes NOT CONFIGURED from CONFIGURED-BUT-DOWN. On Vercel with
 * MODEL_API_URL unset, the fetch below targets 127.0.0.1 on Vercel's own host
 * and fails — which reads to a user as "the model is broken" when in fact the
 * service was simply never pointed at. `configured: false` says which.
 */
import { NextResponse } from 'next/server';

/**
 * Resolve the model service PER REQUEST, never at module scope.
 *
 * A module-level `const X = process.env.Y` is evaluated once, when the module
 * is first loaded. That is fine locally but fragile on a serverless platform:
 * the value gets captured into a warm instance and, depending on how the
 * bundler treats server env access, can be baked at build time. Reading inside
 * the handler means setting the variable and redeploying ALWAYS takes effect,
 * and removes a whole class of "I set it and nothing changed".
 */
function resolveService() {
  const raw = process.env.MODEL_API_URL;
  const isProd = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV !== 'development'
    : process.env.NODE_ENV === 'production';
  return {
    url: (raw ?? 'http://127.0.0.1:8000').replace(/\/$/, ''),
    // In development an unset value is normal: the service runs on localhost
    // beside `npm run dev`. In production 127.0.0.1 is nothing.
    configured: Boolean(raw) || !isProd,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    deployment: process.env.VERCEL_GIT_COMMIT_REF ?? null,
  };
}


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const svc = resolveService();
  if (!svc.configured) {
    // Deliberately not a 500: nothing is broken, the deploy is incomplete.
    // Reporting WHICH environment is running is the difference between a
    // five-minute fix and an afternoon: a Vercel env var scoped to Production
    // only is invisible to a branch (Preview) deploy, and the symptom is
    // identical to never having set it at all.
    console.warn('[card-investment] MODEL_API_URL is not set — the model ' +
                 'service cannot be reached from this deployment.');
    return NextResponse.json(
      {
        status: 'unhealthy',
        model_version: 'unknown',
        model_loaded: false,
        market_data_as_of: null,
        configured: false,
        environment: svc.environment,
        deployment: svc.deployment,
        detail:
          'MODEL_API_URL is not set for this environment. On Vercel an ' +
          'environment variable must be enabled for the environment being ' +
          'viewed (Preview for a branch deploy), and the deployment must be ' +
          'rebuilt after adding it.',
      },
      { status: 503 },
    );
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5_000);
  try {
    const res = await fetch(`${svc.url}/api/v1/card-investment/health`, {
      signal: ac.signal,
      cache: 'no-store',
    });
    const json = await res.json();
    return NextResponse.json(
      { ...json, configured: true, environment: svc.environment,
        deployment: svc.deployment, service_url_host: new URL(svc.url).host },
      { status: res.status },
    );
  } catch {
    // Shaped like the service's own unhealthy response so the client needs only
    // one code path.
    return NextResponse.json(
      {
        status: 'unhealthy',
        model_version: 'unknown',
        model_loaded: false,
        market_data_as_of: null,
        configured: true,
        detail: 'The model service did not respond.',
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}
