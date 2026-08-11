'use client';

/**
 * Fair-value + comparable-sales analyzer.
 *
 * Replaces the buy/not-buy gauge. The old form asked for asset type, price
 * bracket, decade, hold period and status — a description of a CATEGORY. Tested
 * against 256 real repeat-sale pairs, one such combination held 94 deals whose
 * outcomes ran from 0.36x to 5.12x, so those inputs cannot discriminate. This
 * form identifies the ITEM instead, and reports observed sales rather than a
 * predicted verdict.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  formatUSD,
  loadComps,
  loadCompsMeta,
  playerOptions,
  setOptions,
  valuate,
} from '@/lib/valuation/comps';
import {
  GRADERS,
  MATCH_TIER_LABEL,
  MATCH_TIER_QUALITY,
  type AssetQuery,
  type CompLot,
  type CompsMeta,
  type ValuationResult,
} from '@/lib/valuation/types';
import {
  buySignal,
  isOutOfScope,
  loadBuyModel,
  type BuySignal,
  type BuySignalModel,
  type OutOfScope,
} from '@/lib/valuation/buySignal';

const FIELD =
  'w-full rounded-lg border border-viking-charcoal/60 bg-viking-deep/60 px-4 py-3 ' +
  'text-viking-parchment placeholder:text-viking-steel/50 focus:border-viking-gold/60 ' +
  'focus:outline-none focus:ring-1 focus:ring-viking-gold/40 transition-colors';
const LABEL = 'block text-sm font-medium text-viking-steel mb-2';

const TIER_STYLE: Record<string, string> = {
  high: 'bg-green-500/15 text-green-300 border-green-500/40',
  medium: 'bg-viking-gold/15 text-viking-gold border-viking-gold/40',
  low: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  none: 'bg-red-500/15 text-red-300 border-red-500/40',
};

export default function ValuationForm() {
  const [lots, setLots] = useState<CompLot[] | null>(null);
  const [meta, setMeta] = useState<CompsMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [player, setPlayer] = useState('');
  const [itemYear, setItemYear] = useState('');
  const [setName, setSetName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [grader, setGrader] = useState<string>('PSA');
  const [grade, setGrade] = useState('');
  const [askingPrice, setAskingPrice] = useState('');

  const [result, setResult] = useState<ValuationResult | null>(null);
  const [signal, setSignal] = useState<BuySignal | OutOfScope | null>(null);
  const [buyModel, setBuyModel] = useState<BuySignalModel | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    Promise.all([loadComps(), loadCompsMeta()])
      .then(([l, m]) => {
        setLots(l);
        setMeta(m);
      })
      .catch((e: Error) => setLoadError(e.message));
    // the signal is optional — if it fails to load the comps still work
    loadBuyModel().then(setBuyModel).catch(() => setBuyModel(null));
  }, []);

  const playerSuggestions = useMemo(
    () => (lots ? playerOptions(lots, player) : []),
    [lots, player],
  );
  const setSuggestions = useMemo(
    () => (lots && player ? setOptions(lots, player) : []),
    [lots, player],
  );

  const analyze = useCallback(() => {
    if (!lots) return;
    const q: AssetQuery = {
      player: player.trim(),
      itemYear: itemYear ? Number(itemYear) : null,
      setName: setName.trim(),
      cardNumber: cardNumber.trim(),
      grader,
      grade: grade ? Number(grade) : null,
      askingPrice: askingPrice ? Number(askingPrice.replace(/[^0-9.]/g, '')) : null,
    };
    const res = valuate(lots, q);
    setResult(res);
    setShowAll(false);

    setSignal(
      buyModel
        ? buySignal(buyModel, {
            askingPrice: q.askingPrice ?? 0,
            grade: q.grade,
            grader: q.grader,
            itemYear: q.itemYear,
            // the comps decide the asset class, falling back to a card
            assetType: res.comps[0]?.a ?? 'Cards (Non-Rookie)',
            comps: res.comps,
            stats: res.stats,
          })
        : null,
    );
  }, [lots, buyModel, player, itemYear, setName, cardNumber, grader, grade, askingPrice]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
        Could not load the sales dataset: {loadError}
        <p className="mt-2 text-sm text-red-200/70">
          Run <code>python3 scripts/export_comps.py</code> to regenerate
          <code className="mx-1">public/data/comps.json</code>.
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
          Identify the item
        </h3>
        <p className="mt-1 mb-6 text-sm text-viking-steel">
          Comparable sales are matched on the specific card, so the more of this
          you fill in, the tighter the match.
        </p>

        <div className="space-y-5">
          <div>
            <label className={LABEL} htmlFor="player">
              Player <span className="text-viking-gold">*</span>
            </label>
            <input
              id="player"
              className={FIELD}
              value={player}
              placeholder="e.g. Mickey Mantle"
              onChange={(e) => setPlayer(e.target.value)}
              list="player-suggestions"
              autoComplete="off"
            />
            <datalist id="player-suggestions">
              {playerSuggestions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="itemYear">Year</label>
              <input
                id="itemYear"
                className={FIELD}
                value={itemYear}
                placeholder="1952"
                inputMode="numeric"
                onChange={(e) => setItemYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="cardNumber">Card #</label>
              <input
                id="cardNumber"
                className={FIELD}
                value={cardNumber}
                placeholder="311"
                onChange={(e) => setCardNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="setName">Set</label>
            <input
              id="setName"
              className={FIELD}
              value={setName}
              placeholder="Topps"
              onChange={(e) => setSetName(e.target.value)}
              list="set-suggestions"
              autoComplete="off"
            />
            <datalist id="set-suggestions">
              {setSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="grader">Grader</label>
              <select
                id="grader"
                className={FIELD}
                value={grader}
                onChange={(e) => setGrader(e.target.value)}
              >
                {GRADERS.map((g) => (
                  <option key={g} value={g} className="bg-viking-deep">
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="grade">Grade</label>
              <input
                id="grade"
                className={FIELD}
                value={grade}
                placeholder="5"
                inputMode="decimal"
                onChange={(e) => setGrade(e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="asking">
              Asking price <span className="text-viking-steel/60">(optional)</span>
            </label>
            <input
              id="asking"
              className={FIELD}
              value={askingPrice}
              placeholder="$52,000"
              inputMode="decimal"
              onChange={(e) => setAskingPrice(e.target.value)}
            />
          </div>

          <button
            onClick={analyze}
            disabled={!lots || player.trim().length < 2}
            className="w-full rounded-lg bg-viking-gold px-6 py-3 font-semibold text-viking-deep
                       transition-all hover:bg-viking-gold/90 disabled:cursor-not-allowed
                       disabled:opacity-40"
          >
            {lots ? 'Find comparable sales' : 'Loading sales data…'}
          </button>
        </div>

        {meta && (
          <p className="mt-5 border-t border-viking-charcoal/60 pt-4 text-xs leading-relaxed text-viking-steel/70">
            {meta.n_sales.toLocaleString()} real auction results
            {meta.date_range && <> · {meta.date_range[0]} to {meta.date_range[1]}</>}
            <br />
            Sources: {Object.entries(meta.by_source)
              .sort((a, b) => b[1] - a[1])
              .map(([s, n]) => `${s} (${n.toLocaleString()})`)
              .join(' · ')}
          </p>
        )}
      </motion.div>

      {/* --------------------------------------------------------- results */}
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
                Enter an item to see what comparable examples have actually sold
                for, and how an asking price compares.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* match quality */}
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm
                            ${TIER_STYLE[MATCH_TIER_QUALITY[result.tier]]}`}
              >
                {MATCH_TIER_LABEL[result.tier]}
                {result.stats && <span className="opacity-70">· {result.stats.count} sales</span>}
              </div>

              {/* fair value */}
              <div className="rounded-2xl border border-viking-charcoal/60 bg-viking-charcoal/20 p-6">
                {result.fairValue != null && result.stats ? (
                  <>
                    <p className="text-sm uppercase tracking-wide text-viking-steel">
                      Estimated fair value
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-gold">
                      {formatUSD(result.fairValue)}
                    </p>
                    <p className="mt-2 text-sm text-viking-steel">
                      median of {result.stats.count12m >= 3
                        ? `${result.stats.count12m} sales in the last 12 months`
                        : `${result.stats.count} comparable sale${result.stats.count === 1 ? '' : 's'}`}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {[
                        ['Range', `${formatUSD(result.stats.min)} – ${formatUSD(result.stats.max)}`],
                        ['Middle 50%', `${formatUSD(result.stats.p25)} – ${formatUSD(result.stats.p75)}`],
                        ['Last sale', result.stats.last
                          ? `${formatUSD(result.stats.last.price)}`
                          : '—'],
                        ['Last sold', result.stats.last?.date ?? '—'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-xs uppercase tracking-wide text-viking-steel/70">{k}</p>
                          <p className="mt-0.5 text-sm font-medium text-viking-parchment">{v}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm uppercase tracking-wide text-viking-steel">
                      No fair-value estimate
                    </p>
                    <p className="mt-2 text-viking-parchment">
                      The available sales aren&apos;t close enough to this item to
                      support a number. Showing the nearest sales instead.
                    </p>
                  </>
                )}
              </div>

              {/* ---------------------------------------- buy / pass signal
                  Every number here ships with its evidence: the lift over the
                  base rate, the sample it was validated on, and the confidence
                  interval. A bare "68%" reads as accuracy; "68% — flagged items
                  beat the market 74% of the time vs a 52% baseline, ±8pts on
                  260 pairs" is a claim someone can actually check. */}
              {signal && (
                isOutOfScope(signal) ? (
                  <div className="rounded-2xl border border-viking-charcoal/60 bg-viking-charcoal/10 p-5">
                    <p className="text-sm uppercase tracking-wide text-viking-steel">
                      Outperformance signal
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-viking-steel">
                      {signal.reason}
                    </p>
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl border p-6 ${
                      signal.verdict === 'favourable'
                        ? 'border-green-500/40 bg-green-500/5'
                        : signal.verdict === 'unfavourable'
                          ? 'border-red-500/40 bg-red-500/5'
                          : 'border-viking-gold/30 bg-viking-gold/5'
                    }`}
                  >
                    <p className="text-sm uppercase tracking-wide text-viking-steel">
                      Outperformance signal
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                      <span
                        className={`font-[family-name:var(--font-display)] text-3xl font-bold ${
                          signal.verdict === 'favourable'
                            ? 'text-green-400'
                            : signal.verdict === 'unfavourable'
                              ? 'text-red-400'
                              : 'text-viking-gold'
                        }`}
                      >
                        {(signal.probability * 100).toFixed(0)}%
                      </span>
                      <span className="text-sm text-viking-parchment">
                        probability of beating the market over the hold
                      </span>
                    </div>

                    {/* the evidence, never separated from the number */}
                    <div className="mt-4 grid grid-cols-2 gap-4 border-t border-viking-charcoal/50 pt-4 sm:grid-cols-4">
                      {[
                        ['Flagged items beat market',
                         `${(signal.evidence.precision_out_of_fold * 100).toFixed(0)}%`],
                        ['Baseline (any item)',
                         `${(signal.evidence.base_rate * 100).toFixed(0)}%`],
                        ['Improvement',
                         `+${signal.evidence.lift_points.toFixed(0)} pts`],
                        ['Confidence',
                         `±${signal.evidence.precision_ci_points} pts`],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-xs uppercase tracking-wide text-viking-steel/70">{k}</p>
                          <p className="mt-0.5 text-sm font-medium text-viking-parchment">{v}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-viking-steel/80">
                      Validated on {signal.evidence.n_pairs} verified repeat sales
                      across {signal.evidence.n_items} graded cards
                      (ROC-AUC {signal.evidence.roc_auc.toFixed(2)}). Predicts
                      relative performance versus the market, not an absolute
                      return multiple. Roughly 1 in 4 flagged items still
                      underperforms.
                    </p>
                    {signal.caveats.length > 0 && (
                      <ul className="mt-3 space-y-1.5 border-t border-viking-charcoal/50 pt-3">
                        {signal.caveats.map((cv) => (
                          <li key={cv} className="text-xs leading-relaxed text-viking-steel/80">
                            · {cv}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              )}

              {/* asking price comparison */}
              {result.relative && (
                <div className="rounded-2xl border border-viking-charcoal/60 bg-viking-charcoal/20 p-6">
                  <p className="text-sm uppercase tracking-wide text-viking-steel">
                    Asking price vs comparables
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-2xl font-bold text-viking-parchment">
                      {formatUSD(result.relative.askingPrice)}
                    </span>
                    <span
                      className={
                        result.relative.verdict === 'below-comps'
                          ? 'text-green-400'
                          : result.relative.verdict === 'above-comps'
                            ? 'text-red-400'
                            : 'text-viking-gold'
                      }
                    >
                      {result.relative.percentDiff >= 0 ? '+' : ''}
                      {result.relative.percentDiff.toFixed(0)}% vs comps
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-viking-steel">
                    {result.relative.verdict === 'below-comps' &&
                      'Priced below where comparable examples have sold.'}
                    {result.relative.verdict === 'in-line' &&
                      'Roughly in line with comparable sales.'}
                    {result.relative.verdict === 'above-comps' &&
                      'Priced above where comparable examples have sold.'}
                  </p>
                  {/* Deliberately NOT framed as a buy signal. Tested against
                      130 real repeat sales, discount-to-comps did not predict
                      returns: Spearman correlation -0.03, and as a classifier
                      it scored 0.539 ROC-AUC — chance. Deep discounts beat the
                      market 54% of the time versus 45% for premiums, with no
                      monotonic trend in between. Useful context about price
                      level; not evidence of future performance. */}
                  <p className="mt-2 text-xs leading-relaxed text-viking-steel/70">
                    Price level only. In our repeat-sales data, buying below
                    comparables did not by itself predict better returns — a
                    discount usually reflects something about the specific lot.
                    Use the outperformance signal above for that question.
                  </p>
                </div>
              )}

              {/* caveats */}
              {result.notes.length > 0 && (
                <ul className="space-y-2 rounded-xl border border-viking-gold/25 bg-viking-gold/5 p-4">
                  {result.notes.map((n) => (
                    <li key={n} className="text-sm leading-relaxed text-viking-parchment/80">
                      {n}
                    </li>
                  ))}
                </ul>
              )}

              {/* the comps themselves */}
              {result.comps.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-viking-charcoal/60">
                  <div className="flex items-center justify-between bg-viking-charcoal/40 px-5 py-3">
                    <h4 className="text-sm font-semibold text-viking-parchment">
                      Comparable sales
                    </h4>
                    <span className="text-xs text-viking-steel">
                      {result.comps.length} found
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-viking-charcoal/60 text-left text-xs uppercase tracking-wide text-viking-steel/70">
                          <th className="px-5 py-2 font-medium">Date</th>
                          <th className="px-5 py-2 font-medium">Item</th>
                          <th className="px-5 py-2 font-medium">Grade</th>
                          <th className="px-5 py-2 text-right font-medium">Price</th>
                          <th className="px-5 py-2 font-medium">House</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showAll ? result.comps : result.comps.slice(0, 12)).map((c, i) => (
                          <tr
                            key={`${c.u ?? c.t}-${i}`}
                            className="border-b border-viking-charcoal/30 last:border-0"
                          >
                            <td className="whitespace-nowrap px-5 py-2.5 text-viking-steel">{c.d}</td>
                            <td className="max-w-xs px-5 py-2.5">
                              {c.u ? (
                                <a
                                  href={c.u}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-viking-parchment hover:text-viking-gold hover:underline"
                                >
                                  {c.t}
                                </a>
                              ) : (
                                <span className="text-viking-parchment">{c.t}</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-5 py-2.5 text-viking-steel">
                              {c.g ? `${c.g} ${c.gr ?? ''}`.trim() : '—'}
                            </td>
                            <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium text-viking-parchment">
                              {formatUSD(c.pr)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-2.5 text-viking-steel">{c.src}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.comps.length > 12 && (
                    <button
                      onClick={() => setShowAll((s) => !s)}
                      className="w-full bg-viking-charcoal/30 py-2.5 text-sm text-viking-gold hover:bg-viking-charcoal/50"
                    >
                      {showAll ? 'Show fewer' : `Show all ${result.comps.length}`}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
