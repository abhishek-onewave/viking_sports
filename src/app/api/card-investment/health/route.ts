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

const RAW_URL = process.env.MODEL_API_URL;
const MODEL_API_URL = (RAW_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const IS_CONFIGURED = Boolean(RAW_URL);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!IS_CONFIGURED) {
    // Deliberately not a 500: nothing is broken, the deploy is incomplete.
    console.warn('[card-investment] MODEL_API_URL is not set — the model ' +
                 'service cannot be reached from this deployment.');
    return NextResponse.json(
      {
        status: 'unhealthy',
        model_version: 'unknown',
        model_loaded: false,
        market_data_as_of: null,
        configured: false,
        detail: 'MODEL_API_URL is not set on this deployment.',
      },
      { status: 503 },
    );
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5_000);
  try {
    const res = await fetch(`${MODEL_API_URL}/api/v1/card-investment/health`, {
      signal: ac.signal,
      cache: 'no-store',
    });
    const json = await res.json();
    return NextResponse.json({ ...json, configured: true }, { status: res.status });
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
