/**
 * Comparable-sales lookup and fair-value estimation.
 *
 * Everything here is arithmetic over observed auction results — medians,
 * counts, ranges. There is no model and nothing is extrapolated, which is
 * precisely why the output is defensible: every figure traces to a real lot the
 * user can open.
 *
 * The one judgement call is WHEN TO REFUSE. If comparables are too loose to
 * support a point estimate, `fairValue` is null and the UI shows the comps
 * without a headline number. A missing estimate is more useful than an invented
 * one.
 */

import type {
  AssetQuery,
  CompLot,
  CompStats,
  CompsIndex,
  CompsMeta,
  MatchTier,
  ValuationResult,
} from "./types";

const shardCache = new Map<string, CompLot[]>();
let metaCache: CompsMeta | null = null;

const norm = (s: string | null | undefined): string =>
  (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const normCard = (s: string | null | undefined): string =>
  (s ?? "").replace(/^#/, "").trim().toUpperCase();

/**
 * Comps are SHARDED by the player's first letter.
 *
 * A single bundle hit 15.7 MB once SCP's 41k lots landed — far too much to
 * fetch on page load. Every lookup begins with a player name, so the browser
 * only ever needs one shard: the largest ('m') is 342 KB gzipped, and most are
 * far smaller. Shards are cached after first use.
 */
function shardKey(player: string): string {
  const c = norm(player).charAt(0);
  return /[a-z]/.test(c) ? c : "_";
}

export async function loadShard(player: string): Promise<CompLot[]> {
  const key = shardKey(player);
  const hit = shardCache.get(key);
  if (hit) return hit;
  const res = await fetch(`/data/comps/${key}.json`);
  if (!res.ok) {
    // a missing shard means no players with that initial — not an error
    if (res.status === 404) {
      shardCache.set(key, []);
      return [];
    }
    throw new Error(`could not load comps shard '${key}' (${res.status})`);
  }
  const data: CompsIndex = await res.json();
  shardCache.set(key, data.lots);
  return data.lots;
}

export async function loadCompsMeta(): Promise<CompsMeta> {
  if (metaCache) return metaCache;
  const res = await fetch("/data/comps-meta.json");
  if (!res.ok) throw new Error(`could not load comps metadata (${res.status})`);
  metaCache = await res.json();
  return metaCache!;
}

// ---------------------------------------------------------------- statistics
function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return NaN;
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

function statsFor(lots: CompLot[]): CompStats | null {
  if (lots.length === 0) return null;
  const prices = lots.map((l) => l.pr).sort((a, b) => a - b);
  const byDateDesc = [...lots].sort((a, b) => (a.d < b.d ? 1 : -1));

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const iso = cutoff.toISOString().slice(0, 10);
  const recent = lots.filter((l) => l.d >= iso).map((l) => l.pr).sort((a, b) => a - b);

  return {
    count: lots.length,
    median: quantile(prices, 0.5),
    min: prices[0],
    max: prices[prices.length - 1],
    p25: quantile(prices, 0.25),
    p75: quantile(prices, 0.75),
    last: byDateDesc[0] ? { price: byDateDesc[0].pr, date: byDateDesc[0].d } : null,
    median12m: recent.length ? quantile(recent, 0.5) : null,
    count12m: recent.length,
  };
}

// ------------------------------------------------------------------- matching
/**
 * Progressively loosen the match until we find something. Returns the tightest
 * tier that yielded any comps, so the caller can tell the user how good the
 * match actually is.
 */
export function findComps(
  lots: CompLot[],
  q: AssetQuery
): { tier: MatchTier; comps: CompLot[] } {
  const player = norm(q.player);
  const set = norm(q.setName);
  const card = normCard(q.cardNumber);
  const grader = (q.grader ?? "").trim().toUpperCase();

  if (!player) return { tier: "none", comps: [] };

  const byPlayer = lots.filter((l) => l.p === player);
  if (byPlayer.length === 0) return { tier: "none", comps: [] };

  const bySet = byPlayer.filter(
    (l) =>
      (q.itemYear == null || l.y === q.itemYear) && (!set || l.s === set)
  );
  const byCard = card ? bySet.filter((l) => normCard(l.c) === card) : [];

  const exact = byCard.filter(
    (l) =>
      (!grader || grader === "RAW/UNGRADED"
        ? l.g == null || (l.g ?? "").toUpperCase() === grader
        : (l.g ?? "").toUpperCase() === grader) &&
      (q.grade == null || l.gr === q.grade)
  );

  const sortDesc = (arr: CompLot[]) => [...arr].sort((a, b) => (a.d < b.d ? 1 : -1));

  if (exact.length > 0) return { tier: "exact", comps: sortDesc(exact) };
  if (byCard.length > 0) return { tier: "same-card", comps: sortDesc(byCard) };
  if (bySet.length > 0) return { tier: "same-set", comps: sortDesc(bySet) };
  return { tier: "same-player", comps: sortDesc(byPlayer) };
}

// --------------------------------------------------------------- fair value
/**
 * A point estimate is only offered for `exact` and `same-card` matches.
 *
 *  exact     -> median of that card at that grade. Prefer the trailing 12
 *               months when there are at least 3 recent sales, because
 *               memorabilia prices moved sharply after 2021 and older sales
 *               misprice the present.
 *  same-card -> median across grades, flagged as indicative. Grade drives price
 *               enormously and we deliberately do NOT apply a grade-adjustment
 *               curve: we have no measured one, and inventing a multiplier is
 *               exactly the kind of made-up prior this rewrite removes.
 *  looser    -> null. Different cards in the same set are not comparable.
 */
function estimate(tier: MatchTier, stats: CompStats | null): number | null {
  if (!stats) return null;
  if (tier === "exact" || tier === "same-card") {
    if (stats.median12m != null && stats.count12m >= 3) return stats.median12m;
    return stats.median;
  }
  return null;
}

export function valuate(lots: CompLot[], q: AssetQuery): ValuationResult {
  const { tier, comps } = findComps(lots, q);
  const stats = statsFor(comps);
  const fairValue = estimate(tier, stats);
  const notes: string[] = [];

  if (tier === "none") {
    notes.push(
      "No sales of this player appear in the dataset. Either the spelling " +
        "differs from the auction listing, or this player has not come up in " +
        "the auctions scraped so far."
    );
  }
  if (tier === "same-card") {
    notes.push(
      "No sales found at this exact grade, so the estimate pools other grades " +
        "of the same card. Grade is a large price driver — treat this as a " +
        "rough range, not a valuation."
    );
  }
  if (tier === "same-set" || tier === "same-player") {
    notes.push(
      "Matches are too loose for a fair-value estimate, so none is shown. " +
        "The sales below are the closest available context."
    );
  }
  if (stats && stats.count > 0 && stats.count < 3 && fairValue != null) {
    notes.push(
      `Only ${stats.count} comparable sale${stats.count === 1 ? "" : "s"} — a ` +
        "median over so few points is fragile."
    );
  }
  if (stats && stats.count12m === 0 && fairValue != null) {
    notes.push(
      "No sales in the last 12 months; the estimate rests on older results and " +
        "may not reflect the current market."
    );
  }

  let relative: ValuationResult["relative"] = null;
  if (q.askingPrice != null && q.askingPrice > 0 && fairValue != null && fairValue > 0) {
    const ratio = q.askingPrice / fairValue;
    const percentDiff = (ratio - 1) * 100;
    relative = {
      askingPrice: q.askingPrice,
      ratio,
      percentDiff,
      verdict:
        percentDiff <= -15 ? "below-comps" : percentDiff >= 15 ? "above-comps" : "in-line",
    };
  }

  return { query: q, tier, comps, stats, fairValue, relative, notes };
}

// -------------------------------------------------------------- suggestions
/** Distinct player names in the dataset, for the form's autocomplete. */
export function playerOptions(lots: CompLot[], prefix: string, limit = 8): string[] {
  const p = norm(prefix);
  if (p.length < 2) return [];
  const counts = new Map<string, number>();
  for (const l of lots) {
    if (l.p && l.p.startsWith(p)) counts.set(l.p, (counts.get(l.p) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name.replace(/\b\w/g, (ch) => ch.toUpperCase()));
}

/** Sets this player actually appears in, to keep the set field grounded. */
export function setOptions(lots: CompLot[], player: string, limit = 12): string[] {
  const p = norm(player);
  const counts = new Map<string, number>();
  for (const l of lots) {
    if (l.p === p && l.s) counts.set(l.s, (counts.get(l.s) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([s]) => s.replace(/\b\w/g, (ch) => ch.toUpperCase()));
}

export const formatUSD = (n: number): string =>
  n >= 1000
    ? `$${Math.round(n).toLocaleString("en-US")}`
    : `$${n.toFixed(n < 10 ? 2 : 0)}`;
