'use client';

/**
 * CardAnalyzerV4.tsx — the /card-analyzer page: exact identity -> forecast.
 *
 * V4's contract is different from the v3 analyser beside it: instead of fuzzy
 * matching a typed title, the user selects an EXACT card-grade identity
 * (player -> year -> searchable identity list) and the model forecasts next
 * week's valuation for precisely that identity. All scoring is server-side;
 * this component collects a selection and renders what the service returns.
 *
 * Hard rules encoded in this UI:
 *   * only the three supported players are offered
 *   * changing the player resets the year and the selected identity
 *   * the submitted identifier is the selected grade_uid, nothing else
 *   * only the seven-day holding period can submit; longer horizons are shown
 *     disabled with an honest "under development" note, never annualized
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, AlertTriangle, ServerCrash } from 'lucide-react';

import {
  AnalyzerApiError, buildPredictPayload, canAnalyze, fetchAnalyzerMetadata,
  fetchCards, fetchPlayers, fetchYears, predictCardGrade,
  SUPPORTED_HOLDING_PERIOD_DAYS, validatePurchasePrice,
  HOLDING_PERIODS,
  type AnalyzerMetadata, type CardIdentity, type PlayerInfo,
  type PredictV4Response,
} from '@/lib/cardAnalyzer';
import { SelectField, SubmitButton, TextField } from '@/components/predictor/v3fields';
import CardCombobox from './CardCombobox';
import CardAnalyzerV4Result from './CardAnalyzerV4Result';

const ALL_YEARS = '';

export default function CardAnalyzerV4() {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [metadata, setMetadata] = useState<AnalyzerMetadata | null>(null);
  const [serviceDown, setServiceDown] = useState(false);

  const [player, setPlayer] = useState('');
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<string>(ALL_YEARS);
  const [cards, setCards] = useState<CardIdentity[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardIdentity | null>(null);

  const [purchase, setPurchase] = useState('');
  const purchaseCheck = validatePurchasePrice(purchase);
  const [holdingDays, setHoldingDays] = useState(SUPPORTED_HOLDING_PERIOD_DAYS);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictV4Response | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cardsAbortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Players + model metadata once, so the freshness banner appears BEFORE the
  // user builds a selection on a stale snapshot.
  useEffect(() => {
    const ac = new AbortController();
    fetchPlayers(ac.signal)
      .then(setPlayers)
      .catch(() => setServiceDown(true));
    fetchAnalyzerMetadata(ac.signal)
      .then(setMetadata)
      .catch(() => { /* panels simply omit metadata */ });
    return () => ac.abort();
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    cardsAbortRef.current?.abort();
  }, []);

  const loadCards = useCallback((forPlayer: string, forYear: string) => {
    cardsAbortRef.current?.abort();
    const ac = new AbortController();
    cardsAbortRef.current = ac;
    setCardsLoading(true);
    fetchCards(forPlayer, forYear === ALL_YEARS ? null : Number(forYear), ac.signal)
      .then((list) => { setCards(list); setServiceDown(false); })
      .catch((e) => {
        if ((e as Error)?.name !== 'AbortError') setServiceDown(true);
      })
      .finally(() => setCardsLoading(false));
  }, []);

  function onPlayerChange(next: string) {
    setPlayer(next);
    // Reset the year and the card identity whenever the player changes.
    setYear(ALL_YEARS);
    setSelectedCard(null);
    setCards([]);
    setYears([]);
    setApiError(null);
    if (!next) return;
    fetchYears(next).then(setYears).catch(() => setServiceDown(true));
    loadCards(next, ALL_YEARS);
  }

  function onYearChange(next: string) {
    setYear(next);
    setSelectedCard(null);
    setApiError(null);
    if (player) loadCards(player, next);
  }

  const ready = canAnalyze({
    player,
    selectedCard,
    holdingPeriodDays: holdingDays,
    purchaseValid: purchaseCheck.valid,
    loading,
  });

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!ready || !selectedCard) return;   // also blocks duplicate submissions
    setApiError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setResult(null);
    try {
      const r = await predictCardGrade(
        buildPredictPayload(selectedCard, purchaseCheck.amount, holdingDays),
        ac.signal,
      );
      setResult(r);
      setServiceDown(false);
      window.setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        80,
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      if (err instanceof AnalyzerApiError) {
        setApiError(err.message);
        if (err.status === 0 || err.status === 503) setServiceDown(true);
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setApiError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="relative px-6 pb-28 pt-32 md:px-12 md:pt-40 lg:px-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
            Card analyzer · Model V{metadata?.model_version ?? '4.0'}
          </span>
        </div>

        <h1 className="mb-6 font-[family-name:var(--font-display)] text-[40px] font-light leading-[1.05] tracking-normal text-viking-snow md:text-[56px]">
          Exact card <em className="text-viking-gold">forecast</em>.
        </h1>

        <p className="mb-8 max-w-2xl text-[16px] leading-[1.75] text-viking-steel">
          Select an exact card-grade identity (player, year, set, card number,
          parallel, grader and grade) and the model forecasts next week&apos;s
          market valuation for precisely that asset. Add an expected purchase
          price to receive a BUY, DO NOT BUY or REVIEW recommendation.
        </p>

        {/* model freshness */}
        {metadata && (
          <p className="mb-8 text-[12px] tracking-[0.04em] text-viking-steel/70"
             data-testid="model-freshness">
            Model V{metadata.model_version} · created{' '}
            {(metadata.created_utc ?? '').slice(0, 10)} · latest sale{' '}
            {metadata.latest_sale_date} · forecast week {metadata.forecast_week}
          </p>
        )}

        {metadata?.is_stale && (
          <div
            role="alert"
            data-testid="stale-warning"
            className="mb-8 flex gap-3 rounded-2xl border border-viking-amber/40 bg-viking-amber/10 p-5"
          >
            <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-viking-amber" strokeWidth={1.5} />
            <p className="text-[13px] leading-[1.65] text-viking-mist">
              {metadata.stale_message}
            </p>
          </div>
        )}

        {serviceDown && !result && (
          <div
            role="status"
            data-testid="service-warning"
            className="mb-8 flex gap-3 rounded-2xl border border-viking-amber/40 bg-viking-amber/10 p-5"
          >
            <ServerCrash className="mt-0.5 h-[18px] w-[18px] shrink-0 text-viking-amber" strokeWidth={1.5} />
            <p className="text-[13px] leading-[1.65] text-viking-steel">
              The analysis service is not responding. The analyzer needs it to
              list predictable cards and to run forecasts.
            </p>
          </div>
        )}

        {!result && (
          <form
            onSubmit={onSubmit}
            noValidate
            aria-label="Card analyzer"
            className="relative space-y-8 border border-viking-iron/30 bg-viking-charcoal/40 p-6 backdrop-blur-xl sm:p-10"
          >
            <div className="grid gap-8 sm:grid-cols-2">
              <SelectField
                id="player"
                label="Player *"
                value={player}
                onChange={onPlayerChange}
                options={[
                  { value: '', label: 'Select a player…' },
                  ...players.map((p) => ({
                    value: p.player,
                    label: `${p.player} (${p.predictable_grade_identities.toLocaleString()} identities)`,
                  })),
                ]}
              />
              <SelectField
                id="year"
                label="Card year"
                value={year}
                onChange={onYearChange}
                options={[
                  { value: ALL_YEARS, label: 'All Years' },
                  ...years.map((y) => ({ value: String(y), label: String(y) })),
                ]}
              />
            </div>

            <CardCombobox
              id="card"
              label="Available card *"
              cards={cards}
              selected={selectedCard}
              onSelect={setSelectedCard}
              disabled={!player || cardsLoading}
              hint={
                player
                  ? `${cards.length.toLocaleString()} predictable identities${
                      year ? ` in ${year}` : ''
                    } for ${player} · YEAR · SET · #CARD NUMBER · PARALLEL · GRADER GRADE`
                  : 'Only Michael Jordan, Mickey Mantle and Tom Brady are supported by this model.'
              }
            />

            <div className="grid gap-8 sm:grid-cols-2">
              <TextField
                id="purchase_amount"
                label="Expected purchase price"
                value={purchase}
                onChange={setPurchase}
                placeholder="Optional, e.g. 50,000.00"
                inputMode="decimal"
                prefix="$"
                hint="Leave empty for a valuation-only forecast. Positive USD amounts only."
                error={purchaseCheck.error}
              />

              <fieldset>
                <legend className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
                  Holding period
                </legend>
                <div className="flex flex-wrap gap-2.5">
                  {HOLDING_PERIODS.map((h) => {
                    const on = holdingDays === h.days;
                    return (
                      <label
                        key={h.days}
                        title={h.note}
                        className={`rounded-xl border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] transition-all
                          ${h.supported
                            ? on
                              ? 'cursor-pointer border-viking-gold/70 bg-viking-gold/10 text-viking-snow'
                              : 'cursor-pointer border-viking-iron/40 bg-viking-slate/20 text-viking-steel hover:border-viking-steel/50'
                            : 'cursor-not-allowed border-viking-iron/30 bg-viking-slate/10 text-viking-steel/40'}`}
                      >
                        <input
                          type="radio"
                          name="holding_period"
                          value={h.days}
                          checked={on}
                          disabled={!h.supported}
                          onChange={() => h.supported && setHoldingDays(h.days)}
                          className="sr-only"
                        />
                        {h.label}
                        <span className="mt-0.5 block text-[9px] font-medium normal-case tracking-normal opacity-70">
                          {h.supported ? 'Currently supported' : 'Under development'}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-viking-steel/60" data-testid="holding-note">
                  This model is currently validated only for seven-day forecasts.
                  Longer-horizon models are under development.
                </p>
              </fieldset>
            </div>

            {apiError && (
              <div
                role="alert"
                data-testid="api-error"
                className="flex gap-3 border border-viking-sell/40 bg-viking-sell/10 p-4"
              >
                <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-viking-sell" strokeWidth={1.5} />
                <p className="text-[13px] leading-[1.6] text-viking-mist">{apiError}</p>
              </div>
            )}

            <div className="border-t border-viking-iron/30 pt-8">
              {/* Disabled until a player, an exact identity, the seven-day
                  horizon and a valid (or empty) purchase amount are in place.
                  The loading state also blocks duplicate submissions. */}
              <SubmitButton loading={loading} disabled={!ready}>
                {loading ? 'Analysing…' : 'Analyze card'}
              </SubmitButton>
              <p className="mt-4 text-[11px] leading-[1.6] text-viking-steel/60">
                Decision support only. Not an offer, solicitation, or investment advice.
              </p>
            </div>
          </form>
        )}

        <div ref={resultRef}>
          {result && (
            <CardAnalyzerV4Result result={result} metadata={metadata} onReset={reset} />
          )}
        </div>
      </div>
    </main>
  );
}
