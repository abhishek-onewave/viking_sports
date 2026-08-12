'use client';

/**
 * Deal Analyzer — the five-field buy/pass form.
 *
 * Asset type · hold period · purchase price · acquisition year · deal status.
 * Same inputs as v1, but the model behind it is trained on 260 real repeat
 * sales rather than 12,000 synthetically generated ones, and every number is
 * rendered with the evidence supporting it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  isPortfolioOutOfScope,
  loadPortfolioModel,
  portfolioSignal,
  supportedAssetTypes,
  type PortfolioOutOfScope,
  type PortfolioResult,
} from '@/lib/valuation/portfolioSignal';
import type { BuySignalModel } from '@/lib/valuation/buySignal';

const ALL_ASSET_TYPES = [
  'Rookie Cards', 'Cards (Non-Rookie)', 'Publications', 'Memorabilia',
  'Game-Worn Jerseys', 'Game-Worn Shoes', 'Game-Used Equipment',
  'Tickets & Passes', 'Complete Sets', 'Coins & Currency', 'Stickers',
  'Sealed Wax',
];

const FIELD =
  'w-full rounded-lg border border-viking-charcoal/60 bg-viking-deep/60 px-4 py-3 ' +
  'text-viking-parchment placeholder:text-viking-steel/50 focus:border-viking-gold/60 ' +
  'focus:outline-none focus:ring-1 focus:ring-viking-gold/40 transition-colors';
const LABEL = 'block text-sm font-medium text-viking-steel mb-2';

function holdLabel(y: number) {
  if (y <= 3) return 'Short (1-3 yr)';
  if (y <= 10) return 'Medium (4-10 yr)';
  if (y <= 20) return 'Long (11-20 yr)';
  return 'Very Long (20+ yr)';
}

export default function DealAnalyzer() {
  const [model, setModel] = useState<BuySignalModel | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [assetType, setAssetType] = useState('Rookie Cards');
  const [holdYears, setHoldYears] = useState(5);
  const [price, setPrice] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [realized, setRealized] = useState(false);

  const [result, setResult] = useState<PortfolioResult | PortfolioOutOfScope | null>(null);

  useEffect(() => {
    loadPortfolioModel().then(setModel).catch((e: Error) => setErr(e.message));
  }, []);

  const supported = useMemo(() => (model ? supportedAssetTypes(model) : []), [model]);

  const analyze = useCallback(() => {
    if (!model) return;
    setResult(
      portfolioSignal(model, {
        assetType,
        holdYears,
        purchasePrice: Number(price.replace(/[^0-9.]/g, '')) || 0,
        acquisitionYear: Number(year) || new Date().getFullYear(),
        isRealized: realized,
      }),
    );
  }, [model, assetType, holdYears, price, year, realized]);

  if (err) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
        Could not load the deal model: {err}
        <p className="mt-2 text-sm text-red-200/70">
          Run <code>npm run export-buy-model</code> to regenerate
          <code className="mx-1">public/model/portfolio-signal.json</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      {/* ------------------------------------------------------------ form */}
      <motion.div
        className="rounded-2xl border border-viking-charcoal/60 bg-viking-charcoal/20 p-6 backdrop-blur-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-viking-parchment">
          Deal parameters
        </h3>
        <p className="mt-1 mb-6 text-sm text-viking-steel">
          Estimates how often deals of this shape have beaten the market.
        </p>

        <div className="space-y-5">
          <div>
            <label className={LABEL} htmlFor="assetType">Asset type</label>
            <select
              id="assetType"
              className={FIELD}
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
            >
              {ALL_ASSET_TYPES.map((t) => {
                const ok = supported.includes(t);
                return (
                  <option key={t} value={t} className="bg-viking-deep">
                    {t}{ok ? '' : '  — no data'}
                  </option>
                );
              })}
            </select>
            {model && !supported.includes(assetType) && (
              <p className="mt-2 text-xs leading-relaxed text-orange-300/90">
                No repeat sales for this category yet. Supported:{' '}
                {supported.join(', ')}.
              </p>
            )}
          </div>

          <div>
            <label className={LABEL} htmlFor="hold">
              Hold period — <span className="text-viking-gold">{holdYears} yr</span>
              <span className="ml-2 text-viking-steel/60">{holdLabel(holdYears)}</span>
            </label>
            <input
              id="hold"
              type="range"
              min={1}
              max={30}
              value={holdYears}
              onChange={(e) => setHoldYears(Number(e.target.value))}
              className="w-full accent-viking-gold"
            />
            <p className="mt-1 text-xs text-viking-steel/70">
              A scenario, not a prediction — &ldquo;if I hold for {holdYears} years&rdquo;.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="price">Purchase price</label>
              <input
                id="price"
                className={FIELD}
                value={price}
                placeholder="$5,000"
                inputMode="decimal"
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="year">Acquisition year</label>
              <input
                id="year"
                className={FIELD}
                value={year}
                inputMode="numeric"
                onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
          </div>

          <div>
            <span className={LABEL}>Deal status</span>
            <div className="flex gap-3">
              {[
                { v: false, l: 'Unrealized (holding)' },
                { v: true, l: 'Realized (sold)' },
              ].map(({ v, l }) => (
                <button
                  key={l}
                  onClick={() => setRealized(v)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    realized === v
                      ? 'border-viking-gold/60 bg-viking-gold/10 text-viking-gold'
                      : 'border-viking-charcoal/60 text-viking-steel hover:border-viking-charcoal'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-viking-steel/70">
              Recorded, but not a model input — see the note with the result.
            </p>
          </div>

          <button
            onClick={analyze}
            disabled={!model}
            className="w-full rounded-lg bg-viking-gold px-6 py-3 font-semibold text-viking-deep
                       transition-all hover:bg-viking-gold/90 disabled:cursor-not-allowed
                       disabled:opacity-40"
          >
            {model ? 'Analyze deal' : 'Loading model…'}
          </button>
        </div>
      </motion.div>

      {/* --------------------------------------------------------- result */}
      <div>
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-full min-h-[320px] items-center justify-center rounded-2xl
                         border border-dashed border-viking-charcoal/60 p-8 text-center"
            >
              <p className="max-w-sm text-viking-steel">
                Enter deal parameters to see how often comparable deals have
                outperformed the market.
              </p>
            </motion.div>
          ) : isPortfolioOutOfScope(result) ? (
            <motion.div
              key="oos"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-orange-500/40 bg-orange-500/5 p-6"
            >
              <p className="text-sm uppercase tracking-wide text-orange-300">
                No estimate available
              </p>
              <p className="mt-2 text-sm leading-relaxed text-viking-parchment">
                {result.reason}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="res"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div
                className={`rounded-2xl border p-6 ${
                  result.verdict === 'buy'
                    ? 'border-green-500/40 bg-green-500/5'
                    : result.verdict === 'pass'
                      ? 'border-red-500/40 bg-red-500/5'
                      : 'border-viking-gold/30 bg-viking-gold/5'
                }`}
              >
                <p className="text-sm uppercase tracking-wide text-viking-steel">
                  Signal
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-4">
                  <span
                    className={`font-[family-name:var(--font-display)] text-4xl font-bold ${
                      result.verdict === 'buy'
                        ? 'text-green-400'
                        : result.verdict === 'pass'
                          ? 'text-red-400'
                          : 'text-viking-gold'
                    }`}
                  >
                    {result.verdict === 'buy' ? 'BUY' : result.verdict === 'pass' ? 'PASS' : 'MARGINAL'}
                  </span>
                  <span className="text-2xl font-semibold text-viking-parchment">
                    {(result.probability * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-2 text-sm text-viking-steel">
                  probability of beating the market over a {holdYears}-year hold
                </p>

                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-viking-charcoal/50 pt-4 sm:grid-cols-4">
                  {[
                    ['Flagged deals beat market',
                     `${(result.evidence.precision_out_of_fold * 100).toFixed(0)}%`],
                    ['Baseline (any deal)',
                     `${(result.evidence.base_rate * 100).toFixed(0)}%`],
                    ['Improvement', `+${result.evidence.lift_points.toFixed(0)} pts`],
                    ['Confidence', `±${result.evidence.precision_ci_points} pts`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs uppercase tracking-wide text-viking-steel/70">{k}</p>
                      <p className="mt-0.5 text-sm font-medium text-viking-parchment">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-viking-steel/80">
                  Validated on {result.evidence.n_pairs} verified repeat sales
                  across {result.evidence.n_items} items
                  (ROC-AUC {result.evidence.roc_auc.toFixed(2)}). Predicts
                  performance relative to the market, not an absolute return
                  multiple.
                </p>
              </div>

              {/* the limitation that matters most */}
              <div className="rounded-xl border border-viking-gold/25 bg-viking-gold/5 p-4">
                <p className="text-sm font-medium text-viking-gold">
                  This is a category estimate, not an item judgement
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-viking-parchment/80">
                  These five inputs describe a <em>type</em> of deal. In our data,
                  one identical input combination contained 94 real deals whose
                  outcomes ranged from losing 64% to gaining 412%. Use this for
                  portfolio shape; use the Item Lookup to judge a specific lot.
                </p>
              </div>

              {result.caveats.length > 0 && (
                <ul className="space-y-2 rounded-xl border border-viking-charcoal/60 p-4">
                  {result.caveats.map((c) => (
                    <li key={c} className="text-xs leading-relaxed text-viking-steel/80">
                      · {c}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
