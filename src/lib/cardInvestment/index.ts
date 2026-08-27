/**
 * cardInvestment.ts — typed client for the Card Investment Model v3 service.
 *
 * The model is a 9.5 MB Python joblib bundle. It lives behind an HTTPS service
 * and NOTHING about the scoring happens here: this file sends a request, parses
 * a response, and formats currency. Every threshold, probability and guardrail
 * decision is computed server-side, so the UI cannot reach a different
 * conclusion from the backend about the same numbers.
 */

// SAME-ORIGIN by design. The browser talks to this app's own Next API routes,
// which forward to the model service server-side. So there is no public model
// URL, no CORS to configure, and the existing Supabase auth gate can be applied
// in the route handler.
const ENDPOINT = '/api/card-investment';

export const ASSET_TYPES = [
  'Cards (Non-Rookie)',
  'Rookie Cards',
  'Stickers',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** Labels the model supports. Anything else is rejected by the API rather than
 *  silently snapped to the nearest horizon — answering a 24-month question when
 *  18 was asked would be worse than refusing. */
export const HOLD_PERIODS = [
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '2 years', months: 24 },
  { label: '3 years', months: 36 },
  { label: '5 years', months: 60 },
] as const;
export type HoldPeriodLabel = (typeof HOLD_PERIODS)[number]['label'];

export const DEAL_STATUSES = [
  { value: 'unreleased', label: 'Unreleased' },
  { value: 'sold', label: 'Sold' },
] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number]['value'];

export type Recommendation = 'BUY' | 'DO NOT BUY' | 'REVIEW';

export interface PredictRequest {
  asset_type: AssetType;
  card_name: string;
  hold_period: HoldPeriodLabel;
  purchase_amount: number;
  acquisition_year: number;
  deal_status: DealStatus;
}

export interface PredictResponse {
  matched_card: string | null;
  /** RANKING score, not a probability. Can exceed 1.0 — never render as a %. */
  match_score: number;
  identity_id: string | null;
  market_data_as_of: string;
  current_valuation: number | null;
  current_valuation_range: [number, number] | number[];
  current_valuation_method: string | null;
  hold_period_months: number;
  buy_probability: number;
  full_coverage_recommendation: Recommendation;
  high_confidence_action: Recommendation;
  final_recommendation_with_price_guardrail: Recommendation;
  predicted_future_sale_value: number;
  future_value_90pct_range: [number, number] | number[];
  maximum_recommended_purchase_price: number;
  entered_purchase_amount: number;
  deal_status: string;
  notes: string[];
  /** Derived server-side so front and back cannot disagree. */
  price_headroom: number;
  exceeds_maximum: boolean;
}

export interface HealthResponse {
  status: string;
  model_version: string;
  model_loaded: boolean;
  market_data_as_of?: string | null;
}

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  fieldErrors: FieldError[];
  requestId?: string;

  constructor(message: string, status: number, fieldErrors: FieldError[] = [], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.requestId = requestId;
  }
}

/**
 * Never display anything that looks like a server stack trace.
 *
 * The service is written not to emit one, but the client must not depend on
 * that: a proxy, a future handler, or a different deployment could put a
 * traceback in `detail`, and it would then be rendered straight into the page.
 * Cheap to guard, and a leaked traceback is an information-disclosure bug.
 */
function safeDetail(detail: unknown): string | null {
  if (typeof detail !== 'string') return null;
  const looksLikeTrace =
    /Traceback|File\s+"|\bline \d+|\bat [\w.]+\s+\(|\.py[:"]|\w+Error:/.test(detail);
  if (looksLikeTrace || detail.length > 300) return null;
  return detail;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  const fieldErrors: FieldError[] = Array.isArray(body?.detail)
    ? body.detail.filter((d: any) => d && typeof d.field === 'string')
    : [];
  const detail = safeDetail(body?.detail);
  const message =
    fieldErrors.length > 0
      ? 'Please correct the highlighted fields.'
      : detail
        ? detail
        : res.status === 503
          ? 'The analysis service is unavailable. Please try again shortly.'
          : res.status === 504
            ? 'The analysis timed out. Please try again.'
            : res.status >= 500
              ? 'The analysis service failed to score this input. Please try again.'
              : `Request failed (${res.status}).`;
  return new ApiError(message, res.status, fieldErrors, body?.request_id);
}

/** POST a prediction. `signal` lets the caller cancel on unmount. */
export async function predictCardInvestment(
  payload: PredictRequest,
  signal?: AbortSignal,
): Promise<PredictResponse> {
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
    // A network-level failure is indistinguishable from the service being down,
    // so say the useful thing rather than surfacing "Failed to fetch".
    throw new ApiError(
      'Could not reach the analysis service. Check your connection and try again.',
      0,
    );
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PredictResponse;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${ENDPOINT}/health`, { signal });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as HealthResponse;
}

// ────────────────────────────────────────────────────────────── formatting
/** USD, no cents above $1,000 — six-figure card prices do not need pennies. */
export function formatUSD(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: abs < 1000 ? 2 : 0,
    maximumFractionDigits: abs < 1000 ? 2 : 0,
  }).format(value);
}

/** Signed USD — used for headroom, where the sign is the whole point. */
export function formatUSDSigned(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const s = formatUSD(Math.abs(value));
  return value < 0 ? `−${s}` : `+${s}`;
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatRange(range: number[] | null | undefined): string {
  if (!range || range.length < 2) return '—';
  return `${formatUSD(range[0])} – ${formatUSD(range[1])}`;
}

/**
 * The decision the UI shows.
 *
 * Priority is fixed by the brief and encoded here so no component can invent
 * its own order:
 *   1. DO NOT BUY wins outright
 *   2. then BUY
 *   3. REVIEW means a human must look
 * `full_coverage_recommendation` is provisional only and must NEVER promote a
 * REVIEW to a BUY.
 */
export function primaryDecision(r: PredictResponse): Recommendation {
  const final = r.final_recommendation_with_price_guardrail;
  // Defence in depth: the API already enforces this, but a stale/oddly-built
  // bundle must not be able to show BUY above the maximum.
  if (r.exceeds_maximum && final === 'BUY') return 'DO NOT BUY';
  if (final === 'DO NOT BUY') return 'DO NOT BUY';
  if (final === 'BUY') return 'BUY';
  return 'REVIEW';
}

/** One sentence explaining WHY the primary decision is what it is. */
export function decisionExplanation(r: PredictResponse): string {
  const decision = primaryDecision(r);
  const provisional = r.full_coverage_recommendation;

  if (decision === 'DO NOT BUY' && r.exceeds_maximum) {
    return provisional === 'BUY'
      ? 'Although the provisional model signal is BUY, the entered price is above the maximum recommended purchase price required to achieve the target return. Final recommendation: DO NOT BUY.'
      : 'The entered price is above the maximum recommended purchase price required to achieve the target return.';
  }
  if (decision === 'DO NOT BUY') {
    return 'The model does not expect this purchase to clear the required return after transaction costs.';
  }
  if (decision === 'REVIEW') {
    return 'The model does not have enough confidence to act automatically on this opportunity. It requires manual review by the investment team.';
  }
  return 'The price is within the maximum recommended purchase price and the model has sufficient confidence to recommend proceeding.';
}
