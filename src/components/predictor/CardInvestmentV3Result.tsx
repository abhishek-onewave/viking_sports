'use client';

/**
 * CardInvestmentResult.tsx — match confirmation, decision, and the numbers.
 *
 * TWO RULES DRIVE THIS WHOLE FILE
 * -------------------------------
 * 1. The match is confirmed BEFORE the recommendation is treated as final.
 *    An exact card identity is the model's foundation: a 1986 Fleer Jordan PSA 10
 *    and a PSA 5 are different assets by an order of magnitude in price. So the
 *    matched title is shown first, and if the user rejects it the recommendation
 *    is visibly demoted to provisional.
 *
 * 2. `final_recommendation_with_price_guardrail` is the ONLY primary signal.
 *    `full_coverage_recommendation` is provisional and can never promote a
 *    REVIEW to a BUY. `match_score` is a ranking score that exceeds 1.0 in
 *    practice and is never rendered as a percentage.
 */
import { useState } from 'react';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, CheckCircle2, HelpCircle, Info, XCircle,
} from 'lucide-react';


import {
  decisionExplanation, formatPercent, formatRange, formatUSD, formatUSDSigned,
  primaryDecision, type PredictResponse, type Recommendation,
} from '@/lib/cardInvestment';

const CARD =
  'relative rounded-2xl border border-viking-iron/30 bg-viking-charcoal/40';

const DECISION_STYLE: Record<Recommendation, {
  border: string; bg: string; text: string; Icon: typeof CheckCircle2; label: string;
}> = {
  BUY: {
    border: 'border-viking-buy/45', bg: 'bg-viking-buy/10',
    text: 'text-viking-buy', Icon: CheckCircle2, label: 'Buy',
  },
  'DO NOT BUY': {
    border: 'border-viking-sell/45', bg: 'bg-viking-sell/10',
    text: 'text-viking-sell', Icon: XCircle, label: 'Do not buy',
  },
  REVIEW: {
    border: 'border-viking-gold/45', bg: 'bg-viking-gold/10',
    text: 'text-viking-honey', Icon: AlertTriangle, label: 'Review',
  },
};

function Row({ label, value, emphasis, hint }: {
  label: string; value: string; emphasis?: boolean; hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-viking-iron/30 py-3.5 last:border-b-0">
      <dt className="text-[13px] leading-snug text-viking-steel">
        {label}
        {hint && (
          <span className="mt-0.5 block text-[11px] text-viking-steel/60">
            {hint}
          </span>
        )}
      </dt>
      <dd
        className={
          emphasis
            ? 'shrink-0 font-[family-name:var(--font-display)] text-[22px] leading-none text-viking-snow'
            : 'shrink-0 text-[14px] text-viking-mist'
        }
      >
        {value}
      </dd>
    </div>
  );
}

export default function CardInvestmentResult({
  result, onReset,
}: { result: PredictResponse; onReset: () => void }) {
  // null = not yet answered. The recommendation is provisional until confirmed.
  const [matchConfirmed, setMatchConfirmed] = useState<boolean | null>(null);
  const decision = primaryDecision(result);
  const style = DECISION_STYLE[decision];
  const { Icon } = style;
  const rejected = matchConfirmed === false;

  return (
    <div className="space-y-6">
      {/* ─────────────────────────── match confirmation, first ─────────── */}
      <div>
        <div className={`${CARD} p-6 sm:p-8`} data-testid="match-panel">
          <div className="mb-4 flex items-center gap-3">
            <BadgeCheck className="h-[18px] w-[18px] shrink-0 text-viking-gold" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">Card match</span>
          </div>

          <p className="text-[13px] text-viking-steel">
            We matched your input to:
          </p>
          <p
            className="mt-2 font-[family-name:var(--font-display)] text-[22px] leading-snug text-viking-snow sm:text-[26px]"
            data-testid="matched-card"
          >
            {result.matched_card ?? 'No comparable card found'}
          </p>

          {result.identity_id && (
            <p className="mt-3 text-[11px] tracking-[0.08em] text-viking-steel/60">
              Identity {result.identity_id} · comparable market data as of {result.market_data_as_of}
            </p>
          )}

          {matchConfirmed === null && (
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => setMatchConfirmed(true)}
                className="flex-1 border border-viking-gold/60 bg-viking-gold/10 px-5 py-3
                           text-[11px] font-medium uppercase tracking-[0.18em] text-viking-snow
                           transition-colors hover:bg-viking-gold/20
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viking-gold/50"
              >
                Confirm matched card
              </button>
              <button
                type="button"
                onClick={() => setMatchConfirmed(false)}
                className="flex-1 border border-viking-iron/40 px-5 py-3 text-[11px] font-medium
                           uppercase tracking-[0.18em] text-viking-steel
                           transition-colors hover:border-viking-steel/50 hover:text-viking-snow
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viking-gold/50"
              >
                This is not my card
              </button>
            </div>
          )}

          {matchConfirmed === true && (
            <p className="mt-5 flex items-center gap-2 text-[12px] text-viking-buy">
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} /> Match confirmed.
            </p>
          )}
        </div>
      </div>

      {/* ── rejected match: the analysis is NOT final, and we say what to add ── */}
      {rejected && (
        <div>
          <div
            className={`${CARD} border-viking-amber/40 bg-viking-amber/10 p-6 sm:p-8`}
            role="alert"
            data-testid="match-rejected"
          >
            <div className="mb-3 flex items-center gap-3">
              <AlertTriangle className="h-[18px] w-[18px] shrink-0 text-viking-amber" strokeWidth={1.5} />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">Analysis not final</span>
            </div>
            <p className="text-[14px] leading-[1.7] text-viking-mist">
              Because the matched card is not the asset you meant, the figures below
              describe a different card and must not be treated as a recommendation.
              Re-run the analysis with a more precise title including:
            </p>
            <ul className="mt-4 grid gap-1.5 text-[13px] text-viking-steel sm:grid-cols-2">
              {['Year', 'Set', 'Player', 'Card number', 'Grader', 'Grade',
                'Parallel or variant', 'Autograph or serial number'].map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-viking-gold/50">·</span>{f}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] italic text-viking-steel/70">
              For example: “1986 Fleer #57 Michael Jordan PSA 10”
            </p>
            <button
              type="button"
              onClick={onReset}
              className="mt-6 inline-flex items-center gap-2 border border-viking-iron/40 px-5 py-3
                         text-[11px] font-medium uppercase tracking-[0.18em]
                         text-viking-mist transition-colors hover:border-viking-steel/50
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viking-gold/50"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Refine the card title
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────── primary decision ─────────────────── */}
      <div>
        <div
          className={`${CARD} ${style.border} ${style.bg} p-6 sm:p-8 ${rejected ? 'opacity-55' : ''}`}
          data-testid="decision-panel"
        >
          <div className="flex flex-wrap items-center gap-4">
            <Icon className={`h-7 w-7 shrink-0 ${style.text}`} strokeWidth={1.5} />
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">{rejected ? 'Provisional only — match rejected' : 'Recommendation'}</span>
              <p
                className={`mt-1 font-[family-name:var(--font-display)] text-[34px] leading-none sm:text-[42px] ${style.text}`}
                data-testid="decision-badge"
              >
                {decision}
              </p>
            </div>
          </div>

          <p className="mt-5 text-[14px] leading-[1.75] text-viking-mist"
             data-testid="decision-explanation">
            {decisionExplanation(result)}
          </p>

          {/* provisional vs automatic, kept clearly secondary */}
          <dl className="mt-6 grid gap-x-8 gap-y-3 border-t border-viking-iron/30 pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.18em] text-viking-steel/70">
                Automatic-decision confidence
              </dt>
              <dd className="mt-1 text-[14px] text-viking-mist"
                  data-testid="high-confidence-action">
                {result.high_confidence_action === 'REVIEW'
                  ? 'Not sufficient — manual review required'
                  : `Sufficient — ${result.high_confidence_action}`}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.18em] text-viking-steel/70">
                Provisional model signal
              </dt>
              <dd className="mt-1 text-[14px] text-viking-steel"
                  data-testid="full-coverage">
                {result.full_coverage_recommendation}
                <span className="ml-2 text-viking-steel/60">(secondary)</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ───────────────────────────── investment summary ───────────────── */}
      <div>
        <div className={`${CARD} p-6 sm:p-8 ${rejected ? 'opacity-55' : ''}`}>
          <div className="mb-5 flex items-center gap-3">
            <Info className="h-[18px] w-[18px] shrink-0 text-viking-gold" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">Investment summary</span>
          </div>

          <dl>
            <Row label="Buy probability"
                 value={formatPercent(result.buy_probability)}
                 data-testid="buy-probability" />
            <Row label="Entered purchase amount"
                 value={formatUSD(result.entered_purchase_amount)} emphasis />
            <Row label="Maximum recommended purchase price"
                 value={formatUSD(result.maximum_recommended_purchase_price)}
                 emphasis
                 hint="The most you can pay and still clear the required return after costs" />
            <Row
              label={result.exceeds_maximum ? 'Amount over the maximum' : 'Headroom below the maximum'}
              value={formatUSDSigned(result.price_headroom)}
            />
            <Row label="Current market valuation"
                 value={formatUSD(result.current_valuation)} emphasis />
            <Row label="Current valuation range"
                 value={formatRange(result.current_valuation_range as number[])} />
            <Row label="Valuation method"
                 value={result.current_valuation_method ?? '—'} />
            <Row label="Predicted future sale value"
                 value={formatUSD(result.predicted_future_sale_value)} emphasis />
            <Row label="Future value, 90% range"
                 value={formatRange(result.future_value_90pct_range as number[])} />
            <Row label="Requested holding period"
                 value={`${result.hold_period_months} months`} />
            <Row label="Deal status"
                 value={result.deal_status === 'sold' ? 'Sold' : 'Unreleased'}
                 hint="Recorded, but not a trained input" />
            <Row label="Market data as of" value={result.market_data_as_of} />
          </dl>
        </div>
      </div>

      {/* ───────────────────────── model notes + how to read it ─────────── */}
      <div>
        <div className={`${CARD} p-6 sm:p-8`}>
          <div className="mb-5 flex items-center gap-3">
            <HelpCircle className="h-[18px] w-[18px] shrink-0 text-viking-gold" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">How to read this</span>
          </div>

          <ul className="space-y-2.5 text-[13px] leading-[1.7] text-viking-steel">
            <li>Assumes a <strong className="font-medium text-viking-mist">12% estimated transaction cost</strong> and a <strong className="font-medium text-viking-mist">10% required annual return</strong>.</li>
            <li><strong className="font-medium text-viking-mist">REVIEW</strong> means the model does not have enough confidence for automatic action — it is not a soft no.</li>
            <li>High-confidence automatic decisions reached <strong className="font-medium text-viking-mist">87.58% accuracy</strong> on the untouched 2026 test subset, covering <strong className="font-medium text-viking-mist">9.57%</strong> of cases.</li>
            <li>Across all cases, test accuracy was <strong className="font-medium text-viking-mist">64.04%</strong>.</li>
            <li>Typical valuation error was approximately <strong className="font-medium text-viking-mist">18.37%</strong>.</li>
            <li>Deal status is recorded but is not currently a trained feature.</li>
          </ul>

          {result.notes?.length > 0 && (
            <ul className="mt-6 space-y-2 border-t border-viking-iron/30 pt-5 text-[12px] leading-[1.65] text-viking-steel/70">
              {result.notes.map((n) => (
                <li key={n} className="flex gap-2">
                  <span aria-hidden className="text-viking-gold/40">·</span>{n}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-6 text-[11px] leading-[1.6] text-viking-steel/60">
            Decision support only. Not an offer, solicitation, or investment advice.
            Sports collectibles are illiquid and speculative and produce no income.
          </p>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 border border-viking-iron/40 px-6 py-3.5
                     text-[11px] font-medium uppercase tracking-[0.18em]
                     text-viking-steel transition-colors
                     hover:border-viking-steel/50 hover:text-viking-snow
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viking-gold/50"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Analyse another card
        </button>
      </div>
    </div>
  );
}
