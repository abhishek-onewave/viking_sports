'use client';

/**
 * CardAnalyzerV4Result.tsx — the V4 result: exact identity, decision, numbers.
 *
 * Unlike v3 there is NO match confirmation step: the user picked the exact
 * grade_uid themselves, so the identity is authoritative. Two rules carry over
 * unchanged from the v3 result:
 *   * REVIEW is a valid model result and is never converted to BUY or DO NOT BUY
 *   * the high-confidence accuracy (89.47%) applies only to the small automatic
 *     subset (2.46% coverage) and is never presented as overall accuracy
 */
import {
  AlertTriangle, ArrowLeft, BadgeCheck, CheckCircle2, HelpCircle, Info,
  TrendingUp, XCircle,
} from 'lucide-react';

import {
  formatPercent, formatRange, formatUSD,
  type AnalyzerMetadata, type PredictV4Response, type Recommendation,
} from '@/lib/cardAnalyzer';

const CARD =
  'relative rounded-2xl border border-viking-iron/30 bg-viking-charcoal/40';

const DECISION_STYLE: Record<Recommendation, {
  border: string; bg: string; text: string; Icon: typeof CheckCircle2;
}> = {
  BUY: {
    border: 'border-viking-buy/45', bg: 'bg-viking-buy/10',
    text: 'text-viking-buy', Icon: CheckCircle2,
  },
  'DO NOT BUY': {
    border: 'border-viking-sell/45', bg: 'bg-viking-sell/10',
    text: 'text-viking-sell', Icon: XCircle,
  },
  REVIEW: {
    border: 'border-viking-gold/45', bg: 'bg-viking-gold/10',
    text: 'text-viking-honey', Icon: AlertTriangle,
  },
};

function decisionExplanation(r: PredictV4Response): string {
  switch (r.recommendation) {
    case 'REVIEW':
      return 'The model does not have enough confidence to make an automatic investment decision. It requires manual review by the investment team.';
    case 'DO NOT BUY':
      return r.purchase_amount !== undefined &&
        r.maximum_recommended_purchase_price !== undefined &&
        r.purchase_amount > r.maximum_recommended_purchase_price
        ? 'The entered price is above the maximum recommended purchase price required to clear the required return after transaction costs.'
        : 'The model does not expect this purchase to clear the required return after transaction costs.';
    default:
      return 'The price is within the maximum recommended purchase price and the model has sufficient confidence to recommend proceeding.';
  }
}

function Row({ label, value, emphasis, hint }: {
  label: string; value: string; emphasis?: boolean; hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-viking-iron/30 py-3.5 last:border-b-0">
      <dt className="text-[13px] leading-snug text-viking-steel">
        {label}
        {hint && (
          <span className="mt-0.5 block text-[11px] text-viking-steel/60">{hint}</span>
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

export default function CardAnalyzerV4Result({
  result, metadata, onReset,
}: {
  result: PredictV4Response;
  metadata: AnalyzerMetadata | null;
  onReset: () => void;
}) {
  const decision = result.recommendation ?? null;
  const style = decision ? DECISION_STYLE[decision] : null;
  const changePct = result.expected_change_pct;
  const perf = metadata?.performance;

  return (
    <div className="space-y-6">
      {/* ───────────────────────── exact matched identity ───────────────── */}
      <div className={`${CARD} p-6 sm:p-8`} data-testid="match-panel">
        <div className="mb-4 flex items-center gap-3">
          <BadgeCheck className="h-[18px] w-[18px] shrink-0 text-viking-gold" strokeWidth={1.5} />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
            Exact matched card
          </span>
        </div>
        <p
          className="font-[family-name:var(--font-display)] text-[22px] leading-snug text-viking-snow sm:text-[26px]"
          data-testid="matched-card"
        >
          {result.matched_card}
        </p>
        <p className="mt-3 text-[11px] tracking-[0.08em] text-viking-steel/60">
          Identity {result.grade_uid} · data confidence {result.data_confidence} ·
          forecast week {result.forecast_week} · Model V{result.model_version}
        </p>
      </div>

      {/* ───────────────────────────── decision ─────────────────────────── */}
      {decision && style ? (
        <div
          className={`${CARD} ${style.border} ${style.bg} p-6 sm:p-8`}
          data-testid="decision-panel"
        >
          <div className="flex flex-wrap items-center gap-4">
            <style.Icon className={`h-7 w-7 shrink-0 ${style.text}`} strokeWidth={1.5} />
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
                Recommendation
              </span>
              <p
                className={`mt-1 font-[family-name:var(--font-display)] text-[34px] leading-none sm:text-[42px] ${style.text}`}
                data-testid="decision-badge"
              >
                {decision}
              </p>
            </div>
            {result.buy_probability !== undefined && (
              <p className="ml-auto text-[13px] text-viking-steel">
                Buy probability{' '}
                <span className="text-[16px] font-medium text-viking-mist">
                  {formatPercent(result.buy_probability, 2)}
                </span>
              </p>
            )}
          </div>
          <p className="mt-5 text-[14px] leading-[1.75] text-viking-mist"
             data-testid="decision-explanation">
            {decisionExplanation(result)}
          </p>
        </div>
      ) : (
        <div className={`${CARD} p-6 sm:p-8`} data-testid="valuation-only-panel">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-[18px] w-[18px] shrink-0 text-viking-gold" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
              Valuation only
            </span>
          </div>
          <p className="mt-4 text-[14px] leading-[1.75] text-viking-mist">
            No purchase price was entered, so this is a valuation-only forecast.
            Enter an expected purchase price to receive a BUY / DO NOT BUY /
            REVIEW recommendation and a maximum recommended purchase price.
          </p>
        </div>
      )}

      {/* ───────────────────────────── the numbers ──────────────────────── */}
      <div className={`${CARD} p-6 sm:p-8`}>
        <div className="mb-5 flex items-center gap-3">
          <Info className="h-[18px] w-[18px] shrink-0 text-viking-gold" strokeWidth={1.5} />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
            Seven-day forecast
          </span>
        </div>
        <dl>
          <Row label="Current estimated valuation"
               value={formatUSD(result.current_valuation)} emphasis />
          <Row label="Predicted next-week valuation"
               value={formatUSD(result.predicted_next_week_valuation)} emphasis />
          <Row label="90% prediction range"
               value={formatRange(result.prediction_90pct_range as number[])} />
          <Row label="Expected change"
               value={changePct === null || changePct === undefined
                 ? '—' : `${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%`} />
          {result.purchase_amount !== undefined && (
            <Row label="Entered purchase amount"
                 value={formatUSD(result.purchase_amount)} emphasis />
          )}
          {result.maximum_recommended_purchase_price !== undefined && (
            <Row label="Maximum recommended purchase price"
                 value={formatUSD(result.maximum_recommended_purchase_price)}
                 emphasis
                 hint="The most you can pay and still clear the required return after costs" />
          )}
          {result.buy_probability !== undefined && (
            <Row label="Buy probability"
                 value={formatPercent(result.buy_probability, 2)} />
          )}
          <Row label="Data confidence" value={result.data_confidence} />
          <Row label="Historical sales used"
               value={String(result.historical_sales_used)} />
          <Row label="Active sales weeks (last 13)"
               value={String(result.active_sales_weeks_last_13)} />
          <Row label="Weeks since last sale"
               value={String(result.weeks_since_last_sale)} />
          <Row label="Forecast week" value={result.forecast_week} />
          <Row label="Model version" value={`V${result.model_version}`} />
        </dl>

        <p className="mt-6 border-t border-viking-iron/30 pt-5 text-[12px] leading-[1.7] text-viking-steel/70"
           data-testid="forecast-disclosure">
          This forecast is based on historical market transactions and is not a
          guarantee of future performance. REVIEW indicates that the model does
          not have enough confidence to make an automatic investment decision.
        </p>
      </div>

      {/* ─────────────────── assumptions + performance ──────────────────── */}
      <details className={`${CARD} group open:pb-2`}>
        <summary className="cursor-pointer list-none p-6 sm:px-8">
          <span className="flex items-center gap-3">
            <HelpCircle className="h-[18px] w-[18px] shrink-0 text-viking-gold" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
              Return assumptions &amp; model performance
            </span>
            <span aria-hidden className="ml-auto text-viking-steel/60 transition-transform group-open:rotate-45">+</span>
          </span>
        </summary>
        <div className="px-6 pb-6 sm:px-8">
          <ul className="space-y-2.5 text-[13px] leading-[1.7] text-viking-steel">
            <li>Forecast horizon: <strong className="font-medium text-viking-mist">7 days</strong> (next calendar week).</li>
            <li>Required return: <strong className="font-medium text-viking-mist">10% annualized</strong>.</li>
            <li>Transaction-cost assumption: <strong className="font-medium text-viking-mist">12%</strong>.</li>
            <li>The required return is assessed <strong className="font-medium text-viking-mist">after</strong> the transaction-cost assumption.</li>
            <li>This is currently an asset-level underwriting hurdle, not the Fund&apos;s 20%+ net return objective.</li>
          </ul>

          {perf && (
            <div className="mt-6 border-t border-viking-iron/30 pt-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-viking-steel/70">
                Final chronological holdout: BUY decision
              </p>
              <dl>
                <Row label="Overall BUY accuracy" value={formatPercent(perf.buy_accuracy ?? NaN, 2)} />
                <Row label="Precision" value={formatPercent(perf.buy_precision ?? NaN, 2)} />
                <Row label="Recall" value={formatPercent(perf.buy_recall ?? NaN, 2)} />
                <Row label="F1" value={formatPercent(perf.buy_f1 ?? NaN, 2)} />
                <Row label="ROC-AUC" value={formatPercent(perf.buy_roc_auc ?? NaN, 2)} />
                <Row label="High-confidence accuracy"
                     value={formatPercent(perf.high_confidence_accuracy ?? NaN, 2)} />
                <Row label="High-confidence coverage"
                     value={formatPercent(perf.high_confidence_coverage ?? NaN, 2)} />
              </dl>
              <p className="mt-4 rounded-xl border border-viking-amber/40 bg-viking-amber/10 p-4 text-[12px] leading-[1.65] text-viking-mist">
                The {formatPercent(perf.high_confidence_accuracy ?? NaN, 2)} accuracy applies{' '}
                <strong className="font-medium">only</strong> to the small high-confidence automatic
                subset ({formatPercent(perf.high_confidence_coverage ?? NaN, 2)} of cases). It is
                not the overall accuracy of this model.
              </p>
            </div>
          )}
        </div>
      </details>

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
  );
}
