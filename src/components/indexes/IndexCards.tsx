'use client';

/**
 * IndexCards.tsx — the CARDS tab: the top 20 cards in a sport's index.
 *
 * A plain <img> rather than next/image: the thumbnails are Firebase URLs that
 * would each need a `remotePatterns` entry in next.config, and optimisation buys
 * little on a 20-item list of small thumbs. Every image gets a graceful fallback
 * because a broken thumbnail should not leave a hole in a ranked list.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ImageOff, Trophy } from 'lucide-react';
import type { IndexCard, Sport } from '@/lib/indexes';

function Thumb({ card }: { card: IndexCard }) {
  const [failed, setFailed] = useState(false);
  if (!card.imgUrl || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-viking-slate/40">
        <ImageOff className="h-5 w-5 text-viking-steel/40" strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <img
      src={card.imgUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}

/** Top three get a medal tint; the rest get a plain numeral. */
function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? 'border-viking-gold/70 bg-viking-gold/15 text-viking-honey'
      : rank === 2 ? 'border-viking-steel/60 bg-viking-steel/15 text-viking-mist'
        : rank === 3 ? 'border-viking-amber/50 bg-viking-amber/10 text-viking-amber'
          : 'border-viking-iron/50 bg-viking-slate/40 text-viking-steel';
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tabular-nums ${tone}`}
      aria-label={`Rank ${rank}`}
    >
      {rank <= 3 ? <Trophy className="h-4 w-4" strokeWidth={2} /> : rank}
    </span>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded-md border border-viking-iron/40 bg-viking-slate/30 px-2 py-0.5 text-[11px] font-medium text-viking-steel">
      {children}
    </span>
  );
}

export default function IndexCards({ sport }: { sport: Sport }) {
  if (sport.cards.length === 0) {
    return (
      <div className="rounded-2xl border border-viking-iron/30 bg-viking-charcoal/40 p-10 text-center">
        <p className="text-sm text-viking-steel">
          No cards recorded for the {sport.name} index yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-viking-steel">
          Top {sport.cards.length} cards by score
        </p>
        <p className="text-xs text-viking-steel/60">
          Score ranks a card&rsquo;s contribution to the index
        </p>
      </div>

      <ul className="space-y-2.5" data-testid="index-cards-list">
        {sport.cards.map((card, i) => (
          <motion.li
            key={`${card.rank}-${card.cardId ?? card.title}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.025, 0.4) }}
          >
            <a
              href={card.cardUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-viking-iron/30 bg-viking-charcoal/40 p-3 transition-all
                         hover:border-viking-gold/40 hover:bg-viking-charcoal/70
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viking-gold/50 sm:p-4"
            >
              <RankBadge rank={card.rank} />

              <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-viking-iron/40 sm:h-16 sm:w-12">
                <Thumb card={card} />
              </div>

              <div className="min-w-0 flex-1">
                {card.player && (
                  <p className="truncate text-sm font-semibold text-viking-snow">
                    {card.player}
                  </p>
                )}
                <p className="truncate text-xs leading-relaxed text-viking-steel">
                  {card.title}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {card.grade && <Chip>{card.grade}</Chip>}
                  {card.variation && card.variation !== card.grade && (
                    <Chip>{card.variation}</Chip>
                  )}
                </div>
              </div>

              {/* Value dominates; score is the ranking basis and sits quieter.
                  Hidden below sm so the row stays legible on a phone. */}
              <div className="hidden shrink-0 text-right sm:block">
                <p className="font-[family-name:var(--font-display)] text-lg font-bold text-viking-snow">
                  {card.value ?? '—'}
                </p>
                <p className="text-xs text-viking-steel/70">
                  Score {card.score ?? '—'}
                </p>
              </div>

              <ExternalLink
                className="h-4 w-4 shrink-0 text-viking-steel/40 transition-colors group-hover:text-viking-gold"
                strokeWidth={1.75}
                aria-hidden
              />
            </a>

            {/* value/score move under the title on narrow screens */}
            <div className="flex justify-between gap-4 px-3 pb-1 pt-1.5 sm:hidden">
              <span className="text-sm font-bold text-viking-snow">
                {card.value ?? '—'}
              </span>
              <span className="text-xs text-viking-steel/70">
                Score {card.score ?? '—'}
              </span>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
