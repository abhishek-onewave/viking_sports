/**
 * Health proxy. Lets the UI warn that analysis is unavailable BEFORE the user
 * fills six fields, without exposing the model service URL to the browser.
 */
import { NextResponse } from 'next/server';

const MODEL_API_URL = (process.env.MODEL_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5_000);
  try {
    const res = await fetch(`${MODEL_API_URL}/api/v1/card-investment/health`, {
      signal: ac.signal,
      cache: 'no-store',
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    // Deliberately shaped like the service's own unhealthy response so the
    // client needs only one code path.
    return NextResponse.json(
      { status: 'unhealthy', model_version: 'unknown', model_loaded: false,
        market_data_as_of: null },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}
