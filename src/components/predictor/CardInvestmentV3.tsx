'use client';

/**
 * CardInvestment.tsx — the /analysis page: form -> prediction -> result.
 *
 * All scoring is server-side. This component collects six inputs, validates them
 * client-side for fast feedback (the API re-validates authoritatively), and
 * renders whatever the service returns. It never computes a recommendation, a
 * threshold or a maximum price of its own.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, ServerCrash, Sparkles } from 'lucide-react';

import {
  ApiError, ASSET_TYPES, DEAL_STATUSES, HOLD_PERIODS, fetchHealth,
  predictCardInvestment, type AssetType, type DealStatus, type HoldPeriodLabel,
  type PredictResponse,
} from '@/lib/cardInvestment';
import CardInvestmentResult from './CardInvestmentV3Result';
import { RadioGroup, SelectField, SubmitButton, TextField } from './v3fields';

const CURRENT_YEAR = new Date().getFullYear();
type Errors = Partial<Record<string, string>>;

interface FormState {
  asset_type: AssetType;
  card_name: string;
  hold_period: HoldPeriodLabel;
  purchase_amount: string;      // string so the field can be empty mid-typing
  acquisition_year: string;
  deal_status: DealStatus;
}

const INITIAL: FormState = {
  asset_type: 'Cards (Non-Rookie)',
  card_name: '',
  hold_period: '2 years',
  purchase_amount: '',
  acquisition_year: String(CURRENT_YEAR),
  deal_status: 'unreleased',
};

/** Client-side mirror of the API rules — fast feedback, not the authority. */
export function validate(form: FormState): Errors {
  const e: Errors = {};
  if (!form.card_name.trim()) e.card_name = 'Enter the card title.';
  else if (form.card_name.trim().length < 4)
    e.card_name = 'Add more detail — year, set, player, number and grade.';

  const amount = Number(form.purchase_amount);
  if (!form.purchase_amount.trim()) e.purchase_amount = 'Enter the purchase amount.';
  else if (!Number.isFinite(amount)) e.purchase_amount = 'Enter a valid number.';
  else if (amount <= 0) e.purchase_amount = 'Purchase amount must be greater than zero.';
  else if (amount > 100_000_000) e.purchase_amount = 'That amount is implausibly large.';

  const year = Number(form.acquisition_year);
  if (!form.acquisition_year.trim()) e.acquisition_year = 'Enter the acquisition year.';
  else if (!Number.isInteger(year)) e.acquisition_year = 'Enter a four-digit year.';
  else if (year < 1900 || year > CURRENT_YEAR + 1)
    e.acquisition_year = `Year must be between 1900 and ${CURRENT_YEAR + 1}.`;

  if (!ASSET_TYPES.includes(form.asset_type)) e.asset_type = 'Select an asset type.';
  if (!DEAL_STATUSES.some((d) => d.value === form.deal_status))
    e.deal_status = 'Select a deal status.';
  return e;
}

export default function CardInvestmentV3() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [serviceDown, setServiceDown] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Probe health once so we can warn BEFORE the user fills six fields.
  useEffect(() => {
    const ac = new AbortController();
    fetchHealth(ac.signal)
      .then((h) => setServiceDown(h.status !== 'healthy' || !h.model_loaded))
      .catch(() => setServiceDown(true));
    return () => ac.abort();
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const set = useCallback(<K extends keyof FormState>(key: K) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v as FormState[K] }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setApiError(null);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).some((k) => found[k])) {
      // Move focus to the first offending control — a keyboard user should not
      // have to hunt for what failed.
      const first = Object.keys(found).find((k) => found[k]);
      if (first) document.getElementById(first)?.focus();
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setResult(null);
    try {
      const r = await predictCardInvestment(
        {
          asset_type: form.asset_type,
          card_name: form.card_name.trim(),
          hold_period: form.hold_period,
          purchase_amount: Number(form.purchase_amount),
          acquisition_year: Number(form.acquisition_year),
          deal_status: form.deal_status,
        },
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
      if (err instanceof ApiError) {
        // Field errors from the server land on the right inputs.
        if (err.fieldErrors.length) {
          const mapped: Errors = {};
          for (const fe of err.fieldErrors) mapped[fe.field] = fe.message;
          setErrors((e) => ({ ...e, ...mapped }));
        }
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
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="relative px-6 pb-28 pt-32 md:px-12 md:pt-40 lg:px-20">
      <div className="mx-auto max-w-3xl">
        <div>
          <div className="mb-6 flex items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">Investment analysis</span>
          </div>
        </div>

        <div>
          <h1 className="mb-6 font-[family-name:var(--font-display)] text-[40px] font-light leading-[1.05] tracking-normal text-viking-snow md:text-[56px]">
            Card investment <em className="text-viking-gold">analysis</em>.
          </h1>
        </div>

        <div>
          <p className="mb-12 max-w-2xl text-[16px] leading-[1.75] text-viking-steel">
            Enter a card and a price. The model matches it to a comparable asset in
            our sales database, estimates its current value and its value at the end
            of your holding period, and returns the maximum you can pay while still
            clearing the required return.
          </p>
        </div>

        {serviceDown && !result && (
          <div>
            <div
              role="status"
              data-testid="service-warning"
              className="mb-8 flex gap-3 rounded-2xl border border-viking-amber/40 bg-viking-amber/10 p-5"
            >
              <ServerCrash className="mt-0.5 h-[18px] w-[18px] shrink-0 text-viking-amber" strokeWidth={1.5} />
              <p className="text-[13px] leading-[1.65] text-viking-steel">
                The analysis service is not responding. You can still submit — the
                request will be retried against the service — but a result may not
                be available until it is back.
              </p>
            </div>
          </div>
        )}

        {!result && (
          <div>
            <form
              onSubmit={onSubmit}
              noValidate
              aria-label="Card investment analysis"
              className="relative space-y-8 border border-viking-iron/30 bg-viking-charcoal/40 p-6 backdrop-blur-xl sm:p-10"
            >
              <RadioGroup
                name="asset_type"
                legend="Asset type"
                value={form.asset_type}
                onChange={set('asset_type')}
                options={ASSET_TYPES.map((a) => ({ value: a, label: a }))}
                error={errors.asset_type}
              />

              <TextField
                id="card_name"
                label="Card name"
                value={form.card_name}
                onChange={set('card_name')}
                placeholder="1986 Fleer Michael Jordan #57 PSA 10"
                hint="Include year, set, player, card number, grader and grade. Precision drives the match."
                error={errors.card_name}
                autoComplete="off"
              />

              <SelectField
                id="hold_period"
                label="Holding period"
                value={form.hold_period}
                onChange={set('hold_period')}
                options={HOLD_PERIODS.map((h) => ({ value: h.label, label: h.label }))}
                error={errors.hold_period}
              />

              <div className="grid gap-8 sm:grid-cols-2">
                <TextField
                  id="purchase_amount"
                  label="Purchase amount (USD)"
                  value={form.purchase_amount}
                  onChange={set('purchase_amount')}
                  placeholder="150,000"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  prefix="$"
                  error={errors.purchase_amount}
                />
                <TextField
                  id="acquisition_year"
                  label="Acquisition year"
                  value={form.acquisition_year}
                  onChange={set('acquisition_year')}
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={CURRENT_YEAR + 1}
                  error={errors.acquisition_year}
                />
              </div>

              <RadioGroup
                name="deal_status"
                legend="Deal status"
                value={form.deal_status}
                onChange={set('deal_status')}
                options={DEAL_STATUSES}
                error={errors.deal_status}
              />

              {apiError && (
                <div
                  role="alert"
                  data-testid="api-error"
                  className="flex gap-3 border border-viking-sell/40 bg-viking-sell/10 p-4"
                >
                  <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-viking-sell" strokeWidth={1.5} />
                  <p className="text-[13px] leading-[1.6] text-viking-mist">
                    {apiError}
                  </p>
                </div>
              )}

              <div className="border-t border-viking-iron/30 pt-8">
                <SubmitButton loading={loading}>
                  {loading ? 'Analysing…' : 'Run analysis'}
                </SubmitButton>
                <p className="mt-4 text-[11px] leading-[1.6] text-viking-steel/60">
                  Decision support only. Not an offer, solicitation, or investment advice.
                </p>
              </div>
            </form>
          </div>
        )}

        {/* Loading placeholder — the form is replaced only once a result exists,
            so this appears beneath it and tells the user work is happening. */}
        {loading && (
          <div
            className="mt-8 flex items-center gap-3 border border-viking-iron/30 bg-viking-charcoal/40 p-6"
            data-testid="loading-state"
            aria-live="polite"
          >
            <Sparkles className="h-[18px] w-[18px] animate-pulse text-viking-gold" strokeWidth={1.5} />
            <p className="text-[13px] text-viking-steel">
              Matching the card and scoring the opportunity…
            </p>
          </div>
        )}

        <div ref={resultRef}>
          {result && <CardInvestmentResult result={result} onReset={reset} />}
        </div>
      </div>
    </main>
  );
}
