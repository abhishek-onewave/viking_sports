/**
 * Server-side proxy to the Card Investment Model v3 service.
 *
 * WHY PROXY INSTEAD OF CALLING THE SERVICE FROM THE BROWSER
 * ---------------------------------------------------------
 * Next.js gives us a Node runtime, so the model service URL can stay a
 * server-only secret (`MODEL_API_URL`, not `NEXT_PUBLIC_*`). That matters here
 * for three reasons:
 *
 *   1. The service is internal. Publishing its URL to every visitor invites
 *      direct traffic that bypasses this app entirely.
 *   2. CORS collapses to a single origin — the service only ever needs to trust
 *      this server, not a list of browser origins.
 *   3. The existing Deal Analyzer is already gated behind Supabase auth. A
 *      server route is where that gate belongs; a browser calling the model
 *      directly could not be gated at all.
 *
 * The model itself is never imported here. This route forwards JSON and returns
 * JSON — no scoring, no thresholds, no recalculation.
 */
import { NextRequest, NextResponse } from 'next/server';

const MODEL_API_URL = (process.env.MODEL_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const ENDPOINT = '/api/v1/card-investment/predict';
const TIMEOUT_MS = Number(process.env.MODEL_API_TIMEOUT_MS ?? 25_000);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', detail: 'Request body must be JSON.' },
      { status: 400 },
    );
  }

  // Forward ONLY the six known fields. A pass-through of the raw body would let
  // a caller smuggle extra keys (a bundle_path, say) toward the service.
  const body = payload as Record<string, unknown>;
  const forwarded = {
    asset_type: body.asset_type,
    card_name: body.card_name,
    hold_period: body.hold_period,
    purchase_amount: body.purchase_amount,
    acquisition_year: body.acquisition_year,
    deal_status: body.deal_status,
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${MODEL_API_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwarded),
      signal: ac.signal,
      cache: 'no-store',
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // The service always speaks JSON; anything else means a proxy or gateway
      // answered instead, and its HTML must not reach the client.
      console.error('[card-investment] non-JSON from model service', res.status);
      return NextResponse.json(
        { error: 'bad_gateway', detail: 'The analysis service returned an unexpected response.' },
        { status: 502 },
      );
    }
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    console.error('[card-investment] proxy error', aborted ? 'timeout' : err);
    return NextResponse.json(
      aborted
        ? { error: 'prediction_timeout', detail: 'The analysis timed out. Please try again.' }
        : { error: 'model_unavailable', detail: 'The analysis service is unavailable.' },
      { status: aborted ? 504 : 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}
