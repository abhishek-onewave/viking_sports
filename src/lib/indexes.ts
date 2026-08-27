/**
 * indexes.ts — types and helpers for the Card Ladder index data.
 *
 * The data is a bundled JSON (~79 KB) rather than an API call: five sports and
 * a hundred cards that change once a day at most. Bundling means the Indexes tab
 * has no loading state, no backend and no failure mode. Regenerate with
 * `python3 scripts/export_indexes.py` after a scrape.
 *
 * Every figure keeps Card Ladder's own formatted string for display. The parsed
 * `*Numeric` fields exist ONLY so the UI can size a bar or sort a column — they
 * are never rendered, because re-formatting "$5.42b" ourselves would risk
 * showing a number that disagrees with the source.
 */
import raw from '@/data/indexes.json';

export interface IndexStat {
  label: string;
  display: string;
  numeric: number | null;
  percent: number | null;
}

export interface IndexCard {
  rank: number;
  cardId: string | null;
  title: string;
  player: string;
  grade: string;
  variation: string;
  lastSold: string | null;
  lastSoldNumeric: number | null;
  value: string | null;
  valueNumeric: number | null;
  score: string | null;
  scoreNumeric: number | null;
  cardUrl: string | null;
  imgUrl: string | null;
}

export interface Sport {
  slug: string;
  name: string;
  updatedAt: string | null;
  stats: IndexStat[];
  topCardStats: { label: string; display: string }[];
  cards: IndexCard[];
}

export interface IndexPayload {
  generatedAt: string;
  source: string;
  sportCount: number;
  cardCount: number;
  sports: Sport[];
}

export const indexData = raw as unknown as IndexPayload;
export const SPORTS = indexData.sports;

export function getSport(slug: string): Sport | undefined {
  return SPORTS.find((s) => s.slug === slug);
}

export function findStat(sport: Sport, label: string): IndexStat | undefined {
  return sport.stats.find((s) => s.label === label);
}

/**
 * Where the current value sits between the period low and high, 0–1.
 *
 * Returns null rather than a default when the range is degenerate (low === high,
 * which happens when an index has only ever been measured once). A bar pinned at
 * 50% would imply a midpoint that does not exist.
 */
export function rangePosition(sport: Sport): number | null {
  const low = findStat(sport, 'Low Value')?.numeric;
  const high = findStat(sport, 'High Value')?.numeric;
  const cur = findStat(sport, 'Current Value')?.numeric;
  if (low == null || high == null || cur == null) return null;
  if (high <= low) return null;
  return Math.min(1, Math.max(0, (cur - low) / (high - low)));
}

/** Growth direction, for colour. `null` when the figure is missing entirely. */
export function growthDirection(sport: Sport): 'up' | 'down' | 'flat' | null {
  const pct = findStat(sport, 'Rate of Growth')?.percent;
  if (pct == null) return null;
  if (pct > 0) return 'up';
  if (pct < 0) return 'down';
  return 'flat';
}

/** "2026-08-27T23:20:56+00:00" -> "27 Aug 2026". */
export function formatUpdated(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/**
 * Stats split into a headline row and the rest.
 *
 * The three headline figures answer "what is this index worth, is it rising, and
 * how big is the market" — everything else is supporting detail and would dilute
 * them if shown at the same weight.
 */
export const HEADLINE_STATS = ['Current Value', 'Rate of Growth', 'Market Cap'];

export function splitStats(sport: Sport): {
  headline: IndexStat[];
  rest: IndexStat[];
} {
  const headline = HEADLINE_STATS
    .map((l) => findStat(sport, l))
    .filter((s): s is IndexStat => Boolean(s));
  const names = new Set(HEADLINE_STATS);
  return { headline, rest: sport.stats.filter((s) => !names.has(s.label)) };
}

/** Short helper text for stats whose meaning is not self-evident. */
export const STAT_HINTS: Record<string, string> = {
  'Starting Value': 'Index level when tracking began',
  'Real Value Change': 'Absolute change since inception',
  'Total Cards': 'Cards constituting the index',
  'Market Cap': 'Combined value of every card in the index',
  '# of Sales 24H': 'Sales recorded in the last 24 hours',
  'Average Daily Volume': 'Mean dollar volume traded per day',
  'Low Daily Volume': 'Quietest trading day on record',
  'High Daily Volume': 'Busiest trading day on record',
  'Low Value': 'Lowest index level on record',
  'High Value': 'Highest index level on record',
  'Average Value': 'Mean index level over the period',
};
