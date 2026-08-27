'use client';

/**
 * IndexesView.tsx — the Indexes tab.
 *
 *   sport selector  ->  STATS | CARDS
 *
 * Both selections live in the URL (?sport=basketball&tab=cards) so a view is
 * shareable and survives a refresh. Losing the selected sport on reload is the
 * kind of small friction that makes a tool feel disposable.
 */
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, LayoutGrid } from 'lucide-react';
import { SPORTS, formatUpdated, getSport, growthDirection, findStat } from '@/lib/indexes';
import IndexStats from './IndexStats';
import IndexCards from './IndexCards';

type Tab = 'stats' | 'cards';

export default function IndexesView() {
  const [slug, setSlug] = useState<string>(SPORTS[0]?.slug ?? '');
  const [tab, setTab] = useState<Tab>('stats');

  // Read the URL once on mount. Doing this in an effect rather than in
  // useState's initialiser keeps the server and client render identical, which
  // is what stops Next hydration from complaining.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('sport');
    const t = p.get('tab');
    if (s && SPORTS.some((x) => x.slug === s)) setSlug(s);
    if (t === 'cards' || t === 'stats') setTab(t);
  }, []);

  const sync = useCallback((nextSlug: string, nextTab: Tab) => {
    const p = new URLSearchParams(window.location.search);
    p.set('sport', nextSlug);
    p.set('tab', nextTab);
    // replaceState, not push: flipping a tab should not fill the back button.
    window.history.replaceState({}, '', `${window.location.pathname}?${p}`);
  }, []);

  const selectSport = (s: string) => { setSlug(s); sync(s, tab); };
  const selectTab = (t: Tab) => { setTab(t); sync(slug, t); };

  const sport = getSport(slug) ?? SPORTS[0];
  if (!sport) {
    return (
      <div className="rounded-2xl border border-viking-iron/30 bg-viking-charcoal/40 p-10 text-center">
        <p className="text-sm text-viking-steel">No index data available.</p>
      </div>
    );
  }

  const dir = growthDirection(sport);
  const growth = findStat(sport, 'Rate of Growth');

  return (
    <div className="space-y-8">
      {/* ───────────────────────────── sport selector ──────────────────── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
          Select an index
        </p>
        <div
          role="tablist"
          aria-label="Sport index"
          className="flex flex-wrap gap-2"
        >
          {SPORTS.map((s) => {
            const on = s.slug === sport.slug;
            const d = growthDirection(s);
            const g = findStat(s, 'Rate of Growth');
            return (
              <button
                key={s.slug}
                role="tab"
                aria-selected={on}
                onClick={() => selectSport(s.slug)}
                className={`group relative rounded-xl border px-4 py-3 text-left transition-all sm:px-5
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viking-gold/50
                  ${on
                    ? 'border-viking-gold/60 bg-viking-gold/10'
                    : 'border-viking-iron/40 bg-viking-charcoal/40 hover:border-viking-steel/50'}`}
              >
                <span className={`block text-sm font-semibold ${on ? 'text-viking-snow' : 'text-viking-mist'}`}>
                  {s.name}
                </span>
                {g && (
                  <span
                    className={`mt-0.5 block text-xs tabular-nums ${
                      d === 'up' ? 'text-viking-buy'
                        : d === 'down' ? 'text-viking-sell'
                          : 'text-viking-steel'
                    }`}
                  >
                    {g.display}
                  </span>
                )}
                {on && (
                  <motion.span
                    layoutId="sport-underline"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-viking-gold"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ───────────────────────────── sport header ────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-viking-iron/30 pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-viking-snow md:text-4xl">
            {sport.name}
            <span className="ml-3 text-base font-normal text-viking-steel">Index</span>
          </h2>
          <p className="mt-1 text-xs text-viking-steel/60">
            {sport.cards.length} cards tracked · updated {formatUpdated(sport.updatedAt)}
          </p>
        </div>
        {growth && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.12em] text-viking-steel">
              Rate of growth
            </p>
            <p
              className={`font-[family-name:var(--font-display)] text-2xl font-bold ${
                dir === 'up' ? 'text-viking-buy'
                  : dir === 'down' ? 'text-viking-sell'
                    : 'text-viking-mist'
              }`}
            >
              {growth.display}
            </p>
          </div>
        )}
      </div>

      {/* ───────────────────────────── stats / cards ───────────────────── */}
      <div>
        <div role="tablist" aria-label="Index view" className="mb-6 flex gap-1 rounded-xl border border-viking-iron/40 bg-viking-charcoal/40 p-1">
          {([
            { id: 'stats' as Tab, label: 'Stats', Icon: BarChart3 },
            { id: 'cards' as Tab, label: 'Cards', Icon: LayoutGrid },
          ]).map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => selectTab(id)}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5
                  text-xs font-semibold uppercase tracking-[0.12em] transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viking-gold/50
                  ${on ? 'text-viking-deep' : 'text-viking-steel hover:text-viking-mist'}`}
              >
                {on && (
                  <motion.span
                    layoutId="view-pill"
                    className="absolute inset-0 rounded-lg bg-viking-gold"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" strokeWidth={2} />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${sport.slug}-${tab}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {tab === 'stats'
              ? <IndexStats sport={sport} />
              : <IndexCards sport={sport} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
