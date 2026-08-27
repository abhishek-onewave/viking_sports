'use client';

/**
 * IndexStats.tsx — the STATS tab.
 *
 * Three headline figures, then a range bar, then the supporting grid. The
 * hierarchy is the point: showing thirteen equally-weighted numbers would make
 * the reader do the ranking themselves.
 *
 * Every value renders Card Ladder's own formatted string. The parsed numbers are
 * used only to position the range bar and colour the growth figure.
 */
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import {
  findStat, growthDirection, rangePosition, splitStats, STAT_HINTS,
  type Sport,
} from '@/lib/indexes';

const CARD = 'rounded-2xl border border-viking-iron/30 bg-viking-charcoal/40';

function GrowthIcon({ dir }: { dir: 'up' | 'down' | 'flat' | null }) {
  if (dir === 'up') return <ArrowUpRight className="h-6 w-6" strokeWidth={2} />;
  if (dir === 'down') return <ArrowDownRight className="h-6 w-6" strokeWidth={2} />;
  if (dir === 'flat') return <Minus className="h-6 w-6" strokeWidth={2} />;
  return null;
}

export default function IndexStats({ sport }: { sport: Sport }) {
  const { headline, rest } = splitStats(sport);
  const dir = growthDirection(sport);
  const pos = rangePosition(sport);

  const growthColor =
    dir === 'up' ? 'text-viking-buy'
      : dir === 'down' ? 'text-viking-sell'
        : 'text-viking-mist';

  const low = findStat(sport, 'Low Value');
  const high = findStat(sport, 'High Value');
  const current = findStat(sport, 'Current Value');

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────── headline figures ──────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {headline.map((s, i) => {
          const isGrowth = s.label === 'Rate of Growth';
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={`${CARD} relative overflow-hidden p-6`}
            >
              {/* a single quiet accent line, brighter on the growth tile */}
              <div
                aria-hidden
                className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${
                  isGrowth && dir === 'up' ? 'via-viking-buy/50'
                    : isGrowth && dir === 'down' ? 'via-viking-sell/50'
                      : 'via-viking-gold/30'
                }`}
              />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
                {s.label}
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className={`font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl ${
                    isGrowth ? growthColor : 'text-viking-snow'
                  }`}
                  data-testid={`headline-${s.label}`}
                >
                  {s.display}
                </span>
                {isGrowth && (
                  <span className={growthColor}>
                    <GrowthIcon dir={dir} />
                  </span>
                )}
              </div>
              {STAT_HINTS[s.label] && (
                <p className="mt-2 text-xs leading-snug text-viking-steel/70">
                  {STAT_HINTS[s.label]}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ─────────────────────────────── range bar ─────────────────────── */}
      {pos !== null && low && high && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className={`${CARD} p-6`}
        >
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
              Index range
            </p>
            <p className="text-xs text-viking-steel/70">
              Current level within its recorded low and high
            </p>
          </div>

          <div className="relative h-2 rounded-full bg-viking-slate/60">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-viking-gold/40 to-viking-gold"
              initial={{ width: 0 }}
              animate={{ width: `${pos * 100}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
            <motion.div
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-viking-deep bg-viking-gold shadow-lg"
              initial={{ left: 0, opacity: 0 }}
              animate={{ left: `calc(${pos * 100}% - 8px)`, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-viking-steel/70">Low</p>
              <p className="mt-0.5 font-semibold text-viking-mist">{low.display}</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.1em] text-viking-gold">Current</p>
              <p className="mt-0.5 font-semibold text-viking-snow">{current.display}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.1em] text-viking-steel/70">High</p>
              <p className="mt-0.5 font-semibold text-viking-mist">{high.display}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────── supporting grid ───────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25 + i * 0.03 }}
            className={`${CARD} p-5 transition-colors hover:border-viking-gold/30`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-viking-steel">
              {s.label}
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-viking-snow">
              {s.display}
            </p>
            {STAT_HINTS[s.label] && (
              <p className="mt-1.5 text-xs leading-snug text-viking-steel/60">
                {STAT_HINTS[s.label]}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Card-level figures that arrived inside the index payload. Shown, but
          clearly separated: labelling one card's sale price as an index metric
          would be quietly wrong. */}
      {sport.topCardStats.length > 0 && (
        <div className={`${CARD} p-5`}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-viking-steel">
            Top card in this index
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {sport.topCardStats.map((s) => (
              <div key={s.label}>
                <p className="text-xs text-viking-steel/70">{s.label}</p>
                <p className="mt-0.5 font-semibold text-viking-mist">{s.display}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-snug text-viking-steel/50">
            These describe the highest-ranked card, not the index as a whole.
          </p>
        </div>
      )}
    </div>
  );
}
