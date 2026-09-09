/**
 * serviceProxy.ts — server-only forwarding to the Card Analyzer (V4) service.
 *
 * Same posture as the v3 predict route: the model service URL stays a
 * server-side secret (MODEL_API_URL), it is resolved PER REQUEST so a changed
 * env var always takes effect, and only whitelisted fields/params are ever
 * forwarded. Import this from route handlers only — never from client code.
 */
import { NextResponse } from 'next/server';

const API_PREFIX_V4 = '/api/v1/card-analyzer';
const TIMEOUT_MS = Number(process.env.MODEL_API_TIMEOUT_MS ?? 25_000);

function resolveService() {
  const raw = process.env.MODEL_API_URL;
  const isProd = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV !== 'development'
    : process.env.NODE_ENV === 'production';
  return {
    url: (raw ?? 'http://127.0.0.1:8000').replace(/\/$/, ''),
    configured: Boolean(raw) || !isProd,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    deployment: process.env.VERCEL_GIT_COMMIT_REF ?? null,
  };
}

function notConfigured(svc: ReturnType<typeof resolveService>) {
  console.warn('[card-analyzer] MODEL_API_URL is not set for env=%s branch=%s',
               svc.environment, svc.deployment);
  return NextResponse.json(
    {
      error: 'MODEL_UNAVAILABLE',
      detail:
        `MODEL_API_URL is not set for the "${svc.environment}" environment. ` +
        'On Vercel a variable must be enabled for the environment being ' +
        'viewed, and the deployment rebuilt afterwards.',
      environment: svc.environment,
      deployment: svc.deployment,
    },
    { status: 503 },
  );
}

async function forward(url: string, init: RequestInit): Promise<NextResponse> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal, cache: 'no-store' });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      console.error('[card-analyzer] non-JSON from model service', res.status);
      return NextResponse.json(
        { error: 'bad_gateway', detail: 'The analysis service returned an unexpected response.' },
        { status: 502 },
      );
    }
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    console.error('[card-analyzer] proxy error', aborted ? 'timeout' : err);
    return NextResponse.json(
      aborted
        ? { error: 'prediction_timeout', detail: 'The analysis timed out. Please try again.' }
        : { error: 'MODEL_UNAVAILABLE', detail: 'The analysis service is unavailable.' },
      { status: aborted ? 504 : 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}

/** GET pass-through with a WHITELIST of query params. */
export async function proxyAnalyzerGet(
  path: string,
  params: Record<string, string | null | undefined> = {},
): Promise<NextResponse> {
  const svc = resolveService();
  if (!svc.configured) return notConfigured(svc);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, value);
  }
  const qs = search.toString();
  return forward(`${svc.url}${API_PREFIX_V4}${path}${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

/** POST pass-through of an already-whitelisted body. */
export async function proxyAnalyzerPost(path: string, body: unknown): Promise<NextResponse> {
  const svc = resolveService();
  if (!svc.configured) return notConfigured(svc);
  return forward(`${svc.url}${API_PREFIX_V4}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
