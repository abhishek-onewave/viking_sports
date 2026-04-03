'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { predictDeal } from '@/lib/model/predict';
import { savePrediction } from '@/lib/supabase/queries';
import { useAuth } from '@/context/AuthContext';
import {
  PredictionInput,
  PredictionResult,
  VALID_ASSET_TYPES,
  VALID_DECADES,
  VALID_PRICE_TIERS,
  HOLD_BUCKET_LABELS,
} from '@/lib/model/types';
import { ASSET_TYPE_ICONS } from '@/lib/utils/constants';

function getHoldBucketFromYears(years: number): number {
  if (years <= 3) return 1;
  if (years <= 10) return 2;
  if (years <= 20) return 3;
  return 4;
}

function ArcGauge({ probability, size = 200 }: { probability: number; size?: number }) {
  const pct = probability * 100;
  const radius = (size - 20) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const startAngle = Math.PI;
  const endAngle = 0;
  const totalArc = Math.PI;

  const bgPath = describeArc(cx, cy, radius, startAngle, endAngle);
  const fillAngle = startAngle - totalArc * probability;
  const fillPath = describeArc(cx, cy, radius, startAngle, fillAngle);

  const strokeColor =
    pct < 30
      ? '#EF4444'
      : pct < 50
        ? '#E8B84B'
        : pct < 70
          ? '#D4A843'
          : '#22C55E';

  const [animatedPct, setAnimatedPct] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    const targetPct = pct;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedPct(targetPct * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pct]);

  const animatedFillAngle = startAngle - totalArc * (animatedPct / 100);
  const animatedFillPath = describeArc(cx, cy, radius, startAngle, animatedFillAngle);

  return (
    <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
      <path
        d={bgPath}
        fill="none"
        stroke="rgba(40, 53, 80, 0.6)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {animatedPct > 0.5 && (
        <path
          d={animatedFillPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="12"
          strokeLinecap="round"
          filter="url(#gaugeGlow)"
        />
      )}
      <defs>
        <filter id="gaugeGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <text
        x={cx}
        y={cy - 16}
        textAnchor="middle"
        className="fill-viking-snow text-4xl font-bold"
        style={{ fontSize: '2.25rem', fontWeight: 700 }}
      >
        {animatedPct.toFixed(1)}%
      </text>
      <text
        x={cx}
        y={cy + 8}
        textAnchor="middle"
        className="fill-viking-steel text-sm"
        style={{ fontSize: '0.75rem' }}
      >
        Probability
      </text>
    </svg>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);
  const largeArc = Math.abs(startAngle - endAngle) > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export default function PredictionForm() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assetType, setAssetType] = useState<string>('');
  const [holdYears, setHoldYears] = useState<number>(5);
  const [decade, setDecade] = useState<string>('2000s');
  const [isRealized, setIsRealized] = useState<boolean>(false);
  const [priceTier, setPriceTier] = useState<string>('$50-$500');
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const holdBucket = getHoldBucketFromYears(holdYears);

  const handleSubmit = useCallback(async () => {
    if (!assetType) return;

    // Require authentication
    if (!user) {
      router.push('/login');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const input: PredictionInput = {
        assetType,
        holdYears,
        decade,
        isRealized,
        priceTier,
      };
      const prediction = await predictDeal(input);
      setResult(prediction);

      // Save and notify dashboard
      savePrediction(prediction)
        .then(() => window.dispatchEvent(new Event('prediction-saved')))
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  }, [assetType, holdYears, decade, isRealized, priceTier]);

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="relative max-w-4xl mx-auto">
      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="glass-strong rounded-2xl p-8 md:p-10"
          >
            {/* Asset Type */}
            <fieldset className="mb-10">
              <legend className="text-sm font-semibold uppercase tracking-wider text-viking-steel mb-4">
                Asset Type
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {VALID_ASSET_TYPES.map((type) => {
                  const selected = assetType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAssetType(type)}
                      className={`
                        flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium
                        transition-all duration-200
                        ${
                          selected
                            ? 'bg-viking-gold/20 border-viking-gold text-viking-gold shadow-sm shadow-viking-gold/10'
                            : 'bg-viking-slate/50 border-viking-iron/50 text-viking-steel hover:border-viking-gold/30 hover:text-viking-mist'
                        }
                      `}
                    >
                      <span
                        className={`
                          flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold
                          ${selected ? 'bg-viking-gold/30 text-viking-gold' : 'bg-viking-iron/40 text-viking-steel'}
                        `}
                      >
                        {ASSET_TYPE_ICONS[type]}
                      </span>
                      <span className="truncate">{type}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Hold Years */}
            <fieldset className="mb-10">
              <legend className="text-sm font-semibold uppercase tracking-wider text-viking-steel mb-4">
                Hold Period
              </legend>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={holdYears}
                    onChange={(e) => setHoldYears(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer
                      bg-viking-iron/60
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:h-5
                      [&::-webkit-slider-thumb]:w-5
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-viking-gold
                      [&::-webkit-slider-thumb]:shadow-md
                      [&::-webkit-slider-thumb]:shadow-viking-gold/30
                      [&::-webkit-slider-thumb]:transition-transform
                      [&::-webkit-slider-thumb]:hover:scale-110
                      [&::-moz-range-thumb]:h-5
                      [&::-moz-range-thumb]:w-5
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-viking-gold
                      [&::-moz-range-thumb]:border-0
                    "
                  />
                </div>
                <div className="text-right shrink-0 w-24">
                  <span className="text-3xl font-bold text-viking-snow tabular-nums">
                    {holdYears}
                  </span>
                  <span className="ml-1 text-sm text-viking-steel">
                    {holdYears === 1 ? 'year' : 'years'}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-viking-steel/70">
                Bucket:{' '}
                <span className="text-viking-mist font-medium">
                  {HOLD_BUCKET_LABELS[holdBucket]}
                </span>
              </p>
            </fieldset>

            {/* Price Tier */}
            <fieldset className="mb-10">
              <legend className="text-sm font-semibold uppercase tracking-wider text-viking-steel mb-4">
                Purchase Price
              </legend>
              <div className="flex flex-wrap gap-3">
                {VALID_PRICE_TIERS.map((tier) => {
                  const selected = priceTier === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setPriceTier(tier)}
                      className={`
                        rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200
                        ${
                          selected
                            ? 'bg-viking-gold text-viking-deep shadow-sm shadow-viking-gold/20'
                            : 'bg-viking-slate/50 text-viking-steel border border-viking-iron/50 hover:border-viking-gold/30 hover:text-viking-mist'
                        }
                      `}
                    >
                      {tier}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Acquisition Decade */}
            <fieldset className="mb-10">
              <legend className="text-sm font-semibold uppercase tracking-wider text-viking-steel mb-4">
                Acquisition Decade
              </legend>
              <div className="flex flex-wrap gap-3">
                {VALID_DECADES.map((d) => {
                  const selected = decade === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDecade(d)}
                      className={`
                        rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200
                        ${
                          selected
                            ? 'bg-viking-gold text-viking-deep shadow-sm shadow-viking-gold/20'
                            : 'bg-viking-slate/50 text-viking-steel border border-viking-iron/50 hover:border-viking-gold/30 hover:text-viking-mist'
                        }
                      `}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Deal Status */}
            <fieldset className="mb-10">
              <legend className="text-sm font-semibold uppercase tracking-wider text-viking-steel mb-4">
                Deal Status
              </legend>
              <div className="flex gap-3">
                {[
                  { label: 'Unrealized (Holding)', value: false },
                  { label: 'Realized (Sold)', value: true },
                ].map((opt) => {
                  const selected = isRealized === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setIsRealized(opt.value)}
                      className={`
                        flex-1 rounded-xl border px-5 py-3.5 text-sm font-semibold transition-all duration-200
                        ${
                          selected
                            ? 'bg-viking-gold/15 border-viking-gold/60 text-viking-gold'
                            : 'bg-viking-slate/50 border-viking-iron/50 text-viking-steel hover:border-viking-gold/30'
                        }
                      `}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full transition-colors ${
                            selected ? 'bg-viking-gold' : 'bg-viking-iron'
                          }`}
                        />
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Error */}
            {error && (
              <div className="mb-6 rounded-xl border border-viking-sell/30 bg-viking-sell/10 px-4 py-3 text-sm text-viking-sell">
                {error}
              </div>
            )}

            {/* Auth gate banner */}
            {!authLoading && !user && (
              <div className="mb-6 rounded-xl border border-viking-gold/20 bg-viking-gold/5 px-5 py-4 flex items-center justify-between gap-4">
                <p className="text-sm text-viking-steel">
                  <span className="text-viking-gold font-medium">Sign in required</span> — Create a free account to analyze deals
                </p>
                <a
                  href="/login"
                  className="shrink-0 rounded-lg bg-viking-gold px-4 py-2 text-xs font-semibold text-viking-deep hover:bg-viking-amber transition-colors"
                >
                  Sign In
                </a>
              </div>
            )}

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!assetType || !priceTier || loading || (!authLoading && !user)}
              className={`
                w-full rounded-xl py-4 px-8 text-base font-semibold transition-all duration-300
                ${
                  !assetType || !priceTier || (!authLoading && !user)
                    ? 'bg-viking-iron/40 text-viking-steel/50 cursor-not-allowed'
                    : loading
                      ? 'bg-viking-gold/70 text-viking-deep cursor-wait'
                      : 'bg-viking-gold text-viking-deep hover:bg-viking-amber hover:shadow-lg hover:shadow-viking-gold/20 active:scale-[0.98]'
                }
              `}
            >
              {loading ? (
                <span className="inline-flex items-center gap-3">
                  <svg
                    className="h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="opacity-25"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="opacity-75"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : !authLoading && !user ? (
                'Sign In to Analyze'
              ) : (
                'Analyze Deal'
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass-strong rounded-2xl p-8 md:p-10"
          >
            <ResultDisplay result={result} onReset={handleReset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultDisplay({
  result,
  onReset,
}: {
  result: PredictionResult;
  onReset: () => void;
}) {
  const isBuy = result.prediction === 'BUY';
  const pct = (result.probability * 100).toFixed(1);

  const confidenceStyles: Record<string, string> = {
    High: 'bg-viking-gold/15 text-viking-gold border-viking-gold/30',
    Medium: 'bg-viking-ice/15 text-viking-ice border-viking-ice/30',
    Low: 'bg-viking-steel/15 text-viking-steel border-viking-steel/30',
  };

  return (
    <div className="flex flex-col items-center text-center">
      {/* Prediction badge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
        className={`
          inline-flex items-center gap-3 rounded-2xl border px-8 py-4 text-2xl font-bold
          ${
            isBuy
              ? 'bg-viking-buy/20 text-viking-buy border-viking-buy/30'
              : 'bg-viking-sell/20 text-viking-sell border-viking-sell/30'
          }
        `}
      >
        <span className="text-3xl">{isBuy ? '\u2191' : '\u2193'}</span>
        {result.prediction}
      </motion.div>

      {/* Arc gauge */}
      <motion.div
        className="mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <ArcGauge probability={result.probability} size={220} />
      </motion.div>

      {/* Confidence */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={`mt-4 inline-flex rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${confidenceStyles[result.confidence]}`}
      >
        {result.confidence} Confidence
      </motion.div>

      {/* Summary */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 max-w-lg text-sm leading-relaxed text-viking-steel"
      >
        Based on{' '}
        <span className="font-medium text-viking-mist">{result.assetType}</span>{' '}
        purchased at{' '}
        <span className="font-medium text-viking-mist">{result.priceTier}</span>,{' '}
        held for{' '}
        <span className="font-medium text-viking-mist">{result.holdYears} years</span>{' '}
        from the{' '}
        <span className="font-medium text-viking-mist">{result.decade}</span>, our
        model suggests{' '}
        <span
          className={`font-semibold ${isBuy ? 'text-viking-buy' : 'text-viking-sell'}`}
        >
          {result.prediction}
        </span>{' '}
        with {result.confidence.toLowerCase()} confidence ({pct}% probability).
      </motion.p>

      {/* Deal details grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 grid grid-cols-2 gap-4 w-full max-w-md"
      >
        {[
          { label: 'Hold Bucket', value: result.holdBucketLabel },
          { label: 'Price Tier', value: result.priceTier },
          { label: 'Status', value: result.isRealized ? 'Realized' : 'Unrealized' },
          { label: 'Decade', value: result.decade },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-viking-slate/30 border border-viking-iron/30 px-4 py-3"
          >
            <div className="text-xs text-viking-steel">{item.label}</div>
            <div className="mt-0.5 text-sm font-medium text-viking-mist">
              {item.value}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Reset button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        type="button"
        onClick={onReset}
        className="mt-10 rounded-xl border border-viking-steel/20 px-8 py-3.5 text-sm font-semibold text-viking-snow transition-all duration-300 hover:border-viking-steel/40 hover:bg-viking-snow/5"
      >
        Analyze Another
      </motion.button>
    </div>
  );
}
