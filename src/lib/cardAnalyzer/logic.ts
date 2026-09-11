/**
 * logic.ts — pure client-side logic for the Card Analyzer (Model V4).
 *
 * Kept free of React and fetch so it can be unit-tested directly. Nothing in
 * this file computes a recommendation, a valuation or a threshold — that is
 * all server-side. This is input validation and list filtering only.
 */

import type { CardIdentity } from './types';

export const SUPPORTED_HOLDING_PERIOD_DAYS = 7;

export const HOLDING_PERIOD_MESSAGE =
  'This model is currently validated only for seven-day forecasts. ' +
  'Longer-horizon models are under development.';

/** The picker mirrors the service's metadata: only seven days is real. */
export const HOLDING_PERIODS = [
  { days: 7, label: '7 Days', supported: true, note: 'Currently supported' },
  { days: 182, label: '6 Months', supported: false, note: HOLDING_PERIOD_MESSAGE },
  { days: 365, label: '1 Year', supported: false, note: HOLDING_PERIOD_MESSAGE },
  { days: 1095, label: '3 Years', supported: false, note: HOLDING_PERIOD_MESSAGE },
  { days: 1825, label: '5 Years', supported: false, note: HOLDING_PERIOD_MESSAGE },
] as const;

export interface PurchaseValidation {
  valid: boolean;
  /** null when the field is empty (valuation-only) or invalid. */
  amount: number | null;
  error?: string;
}

/**
 * Validate the optional "Expected Purchase Price" input.
 * Empty is VALID (valuation-only analysis). Otherwise: a positive USD number,
 * decimals allowed, "$" "," and spaces tolerated, zero and negatives rejected.
 */
export function validatePurchasePrice(raw: string): PurchaseValidation {
  const trimmed = raw.trim();
  if (trimmed === '') return { valid: true, amount: null };
  const normalized = trimmed.replace(/[$,\s]/g, '');
  const isNumeric = /^\d*\.?\d+$/.test(normalized);
  const amount = isNumeric ? Number.parseFloat(normalized) : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      valid: false,
      amount: null,
      error:
        'Enter a positive USD amount (e.g. 50,000.00). Zero and negative values are not allowed.',
    };
  }
  if (amount > 100_000_000) {
    return { valid: false, amount: null, error: 'That amount is implausibly large.' };
  }
  return { valid: true, amount };
}

/** Token AND-match over the display name — every typed token must appear. */
export function filterCards(cards: CardIdentity[], query: string): CardIdentity[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return cards;
  return cards.filter((c) => {
    const haystack = c.display_name.toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });
}

/**
 * The prediction payload. The ONLY identifier that ever leaves the client is
 * the exact selected grade_uid — never the display title, never a list index.
 */
export function buildPredictPayload(
  card: Pick<CardIdentity, 'grade_uid'>,
  purchaseAmount: number | null,
  holdingPeriodDays: number,
): { grade_uid: string; purchase_amount: number | null; holding_period_days: number } {
  return {
    grade_uid: card.grade_uid,
    purchase_amount: purchaseAmount,
    holding_period_days: holdingPeriodDays,
  };
}

/** Everything the Analyze button needs to be enabled. */
export function canAnalyze(state: {
  player: string;
  selectedCard: CardIdentity | null;
  holdingPeriodDays: number;
  purchaseValid: boolean;
  loading: boolean;
}): boolean {
  return (
    Boolean(state.player) &&
    Boolean(state.selectedCard) &&
    state.holdingPeriodDays === SUPPORTED_HOLDING_PERIOD_DAYS &&
    state.purchaseValid &&
    !state.loading
  );
}

/** Friendly copy for the analyzer's error codes. */
export const ANALYZER_ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND:
    'This exact card-grade identity was not found. No similar card was substituted.',
  INSUFFICIENT_DATA:
    'This identity exists in the clean catalog but has no usable exact sales history, so the model cannot forecast it.',
  REJECTED_QUALIFIER:
    'Qualifier identities (OC, MC, MK, ST, PD, OF) are excluded from this model.',
  UNSUPPORTED_HOLDING_PERIOD: HOLDING_PERIOD_MESSAGE,
  INVALID_PURCHASE_AMOUNT: 'The purchase amount must be a positive USD number.',
  MODEL_UNAVAILABLE:
    'The analysis service is unavailable. Please try again shortly.',
};

/**
 * The service builds display_name with em-dash separators
 * ("1986 — Fleer — #8 — Sticker — PSA 4.0"). Normalise them to middots for
 * display.
 *
 * Done here rather than in the model service on purpose: the separator is a
 * presentation choice, the API contract is not, and changing the backend would
 * mean a redeploy plus a version skew where an older frontend renders the new
 * string. Search still runs against the original text, so a user typing a dash
 * is unaffected.
 */
export function formatDisplayName(name: string): string {
  return name.replace(/\s*\u2014\s*/g, ' · ');
}
