/**
 * logic.test.ts — frontend unit tests for the Card Analyzer's client logic.
 *
 * Run: npm test
 *
 * The API contract itself (players, sorting, qualifier exclusion, error codes,
 * single model load) is covered by the backend suite against the real bundle
 * (backend/model_service/tests/test_card_analyzer_v4_api.py). These tests pin
 * the client-side rules: what may submit, what gets submitted, and how input
 * is validated before it ever reaches the service.
 */
import { describe, expect, it } from 'vitest';

import {
  ANALYZER_ERROR_MESSAGES, buildPredictPayload, canAnalyze, filterCards,
  HOLDING_PERIODS, SUPPORTED_HOLDING_PERIOD_DAYS, validatePurchasePrice,
} from './logic';
import type { CardIdentity } from './types';

function identity(over: Partial<CardIdentity> = {}): CardIdentity {
  return {
    grade_uid: 'uid-1',
    card_uid: 'card-1',
    player: 'Michael Jordan',
    year: 1986,
    set: 'Fleer',
    card_number: '57',
    parallel: 'Base',
    grader: 'PSA',
    grade: '9',
    display_name: '1986 — Fleer — #57 — Base — PSA 9',
    historical_sales_count: 287,
    prediction_available: true,
    ...over,
  };
}

// ---------------------------------------------------------- purchase amount
describe('validatePurchasePrice', () => {
  it('treats empty input as valid valuation-only', () => {
    for (const raw of ['', '   ']) {
      expect(validatePurchasePrice(raw)).toEqual({ valid: true, amount: null });
    }
  });

  it('accepts positive USD amounts with decimals and formatting', () => {
    expect(validatePurchasePrice('50000')).toEqual({ valid: true, amount: 50000 });
    expect(validatePurchasePrice('50,000.50')).toEqual({ valid: true, amount: 50000.5 });
    expect(validatePurchasePrice('$1,234.56')).toEqual({ valid: true, amount: 1234.56 });
    expect(validatePurchasePrice('0.01')).toEqual({ valid: true, amount: 0.01 });
  });

  it('rejects zero, negatives and non-numeric input with an inline error', () => {
    for (const raw of ['0', '-1', '-50000.5', 'abc', '12abc', '1e5', '--5']) {
      const check = validatePurchasePrice(raw);
      expect(check.valid, raw).toBe(false);
      expect(check.amount).toBeNull();
      expect(check.error).toBeTruthy();
    }
  });

  it('rejects implausibly large amounts', () => {
    expect(validatePurchasePrice('200000000').valid).toBe(false);
  });
});

// ------------------------------------------------------------ card filtering
describe('filterCards', () => {
  const cards = [
    identity({ grade_uid: 'a', display_name: '1986 — Fleer — #57 — Base — PSA 9' }),
    identity({ grade_uid: 'b', display_name: '1986 — Fleer — #57 — Base — PSA 10' }),
    identity({ grade_uid: 'c', display_name: '1997 — Metal Universe — #23 — PMG Green — BGS 8.5' }),
  ];

  it('returns everything for an empty query', () => {
    expect(filterCards(cards, '')).toHaveLength(3);
  });

  it('requires every typed token to match (AND, case-insensitive)', () => {
    expect(filterCards(cards, 'fleer psa 10').map((c) => c.grade_uid)).toEqual(['b']);
    expect(filterCards(cards, 'METAL bgs').map((c) => c.grade_uid)).toEqual(['c']);
    expect(filterCards(cards, 'fleer 1997')).toHaveLength(0);
  });
});

// -------------------------------------------------------- submission payload
describe('buildPredictPayload', () => {
  it('submits the exact grade_uid, never the title or an index', () => {
    const payload = buildPredictPayload(identity({ grade_uid: '8bccf7a00e6f5ec1819a' }), 50000, 7);
    expect(payload).toEqual({
      grade_uid: '8bccf7a00e6f5ec1819a',
      purchase_amount: 50000,
      holding_period_days: 7,
    });
    expect(Object.keys(payload)).toHaveLength(3);
  });

  it('sends null purchase_amount for valuation-only analyses', () => {
    expect(buildPredictPayload(identity(), null, 7).purchase_amount).toBeNull();
  });
});

// ------------------------------------------------------------- analyze gating
describe('canAnalyze', () => {
  const ok = {
    player: 'Michael Jordan',
    selectedCard: identity(),
    holdingPeriodDays: SUPPORTED_HOLDING_PERIOD_DAYS,
    purchaseValid: true,
    loading: false,
  };

  it('enables only with player + exact identity + 7 days + valid purchase', () => {
    expect(canAnalyze(ok)).toBe(true);
  });

  it('blocks without a player or without an exact identity', () => {
    expect(canAnalyze({ ...ok, player: '' })).toBe(false);
    expect(canAnalyze({ ...ok, selectedCard: null })).toBe(false);
  });

  it('blocks every unsupported holding period', () => {
    for (const days of [182, 365, 1095, 1825, 0, 30]) {
      expect(canAnalyze({ ...ok, holdingPeriodDays: days })).toBe(false);
    }
  });

  it('blocks invalid purchase amounts and in-flight requests', () => {
    expect(canAnalyze({ ...ok, purchaseValid: false })).toBe(false);
    expect(canAnalyze({ ...ok, loading: true })).toBe(false);
  });
});

// ----------------------------------------------------------- holding periods
describe('HOLDING_PERIODS', () => {
  it('supports exactly the seven-day horizon', () => {
    const supported = HOLDING_PERIODS.filter((h) => h.supported);
    expect(supported.map((h) => h.days)).toEqual([7]);
    expect(supported[0].note).toBe('Currently supported');
  });

  it('labels longer horizons honestly instead of annualizing', () => {
    for (const h of HOLDING_PERIODS.filter((x) => !x.supported)) {
      expect(h.note).toMatch(/validated only for seven-day forecasts/);
    }
  });
});

// ---------------------------------------------------------------- error copy
describe('ANALYZER_ERROR_MESSAGES', () => {
  it('covers every analyzer error code the service can return', () => {
    for (const code of ['NOT_FOUND', 'INSUFFICIENT_DATA', 'REJECTED_QUALIFIER',
                        'UNSUPPORTED_HOLDING_PERIOD', 'INVALID_PURCHASE_AMOUNT',
                        'MODEL_UNAVAILABLE']) {
      expect(ANALYZER_ERROR_MESSAGES[code], code).toBeTruthy();
    }
  });

  it('never converts a NOT_FOUND into a similar-card suggestion', () => {
    expect(ANALYZER_ERROR_MESSAGES.NOT_FOUND).toMatch(/No similar card was substituted/);
  });
});
