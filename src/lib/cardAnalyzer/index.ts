/**
 * cardAnalyzer — typed client for the Card Analyzer (Model V4) service.
 *
 * Same-origin by design, like the v3 client: the browser talks to this app's
 * own Next API routes under /api/card-analyzer, which forward to the model
 * service server-side. No scoring happens here.
 */

import { ANALYZER_ERROR_MESSAGES } from './logic';
import type {
  AnalyzerMetadata, CardIdentity, PlayerInfo, PredictV4Response,
} from './types';

export * from './types';
export * from './logic';
export { formatPercent, formatRange, formatUSD } from '@/lib/cardInvestment';

const ENDPOINT = '/api/card-analyzer';

export class AnalyzerApiError extends Error {
  status: number;
  code: string;
  requestId?: string;

  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message);
    this.name = 'AnalyzerApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/** Never render anything that looks like a server stack trace (see v3 client). */
function safeDetail(detail: unknown): string | null {
  if (typeof detail !== 'string') return null;
  const looksLikeTrace =
    /Traceback|File\s+"|\bline \d+|\bat [\w.]+\s+\(|\.py[:"]|\w+Error:/.test(detail);
  if (looksLikeTrace || detail.length > 300) return null;
  return detail;
}

async function parseAnalyzerError(res: Response): Promise<AnalyzerApiError> {
  let body: { error?: string; detail?: unknown; request_id?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  const code = body?.error ?? (res.status === 503 ? 'MODEL_UNAVAILABLE' : 'ERROR');
  const message =
    ANALYZER_ERROR_MESSAGES[code] ??
    safeDetail(body?.detail) ??
    (res.status >= 500
      ? 'The analysis service failed. Please try again.'
      : `Request failed (${res.status}).`);
  return new AnalyzerApiError(message, res.status, code, body?.request_id);
}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}${path}`, { signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new AnalyzerApiError(
      'Could not reach the analysis service. Check your connection and try again.',
      0, 'NETWORK_ERROR');
  }
  if (!res.ok) throw await parseAnalyzerError(res);
  return (await res.json()) as T;
}

export async function fetchPlayers(signal?: AbortSignal): Promise<PlayerInfo[]> {
  const body = await getJSON<{ players: PlayerInfo[] }>('/players', signal);
  return body.players;
}

export async function fetchYears(player: string, signal?: AbortSignal): Promise<number[]> {
  const body = await getJSON<{ years: number[] }>(
    `/years?player=${encodeURIComponent(player)}`, signal);
  return body.years;
}

export async function fetchCards(
  player: string, year: number | null, signal?: AbortSignal,
): Promise<CardIdentity[]> {
  const params = new URLSearchParams({ player });
  if (year !== null) params.set('year', String(year));
  const body = await getJSON<{ cards: CardIdentity[] }>(
    `/cards?${params.toString()}`, signal);
  return body.cards;
}

export async function fetchAnalyzerMetadata(signal?: AbortSignal): Promise<AnalyzerMetadata> {
  return getJSON<AnalyzerMetadata>('/metadata', signal);
}

export async function predictCardGrade(
  payload: { grade_uid: string; purchase_amount: number | null; holding_period_days: number },
  signal?: AbortSignal,
): Promise<PredictV4Response> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new AnalyzerApiError(
      'Could not reach the analysis service. Check your connection and try again.',
      0, 'NETWORK_ERROR');
  }
  if (!res.ok) throw await parseAnalyzerError(res);
  return (await res.json()) as PredictV4Response;
}
