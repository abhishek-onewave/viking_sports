/**
 * Types for the comparable-sales valuation engine.
 *
 * This replaces the old buy/not-buy classifier. The reason is measurable: that
 * model's inputs (asset type + price bracket + decade + hold + status) describe
 * a CATEGORY, while returns are determined by WHICH ITEM. Grouping 256 real
 * repeat-sale pairs by exactly those inputs, one combination contained 94 deals
 * whose outcomes ranged from 0.36x to 5.12x. No model can separate inputs that
 * are identical, so the form now identifies the asset instead of describing it.
 */

/** One observed auction result. Short keys match public/data/comps.json. */
export interface CompLot {
  t: string;            // title
  p: string | null;     // player (lowercased)
  y: number | null;     // item year
  s: string | null;     // set (lowercased)
  c: string | null;     // card number
  g: string | null;     // grader (PSA/BGS/SGC/...)
  gr: number | null;    // grade
  a: string | null;     // asset type
  pr: number;           // realized price, USD
  d: string;            // sale date, YYYY-MM-DD
  src: string;          // auction house
  u: string | null;     // lot url
}

export interface CompsIndex {
  lots: CompLot[];
}

export interface CompsMeta {
  generated: string;
  n_sales: number;
  date_range: [string, string] | null;
  by_source: Record<string, number>;
  identifiable: Record<string, number>;
}

/** What the user tells us about the item they're looking at. */
export interface AssetQuery {
  player: string;
  itemYear: number | null;
  setName: string;
  cardNumber: string;
  grader: string;
  grade: number | null;
  askingPrice: number | null;
}

/**
 * How closely the comparables actually match. Surfaced in the UI so an
 * estimate built from loose matches is never presented as a tight one.
 */
export type MatchTier =
  | "exact"        // same player, year, set, card #, grader AND grade
  | "same-card"    // same card, different grade or grader
  | "same-set"     // same player + year + set, different card
  | "same-player"  // same player only
  | "none";

export const MATCH_TIER_LABEL: Record<MatchTier, string> = {
  exact: "Exact match — same card, same grade",
  "same-card": "Same card, other grades",
  "same-set": "Same player, year and set",
  "same-player": "Same player only",
  none: "No comparable sales found",
};

/** How much weight the UI should invite the user to put on the estimate. */
export const MATCH_TIER_QUALITY: Record<MatchTier, "high" | "medium" | "low" | "none"> = {
  exact: "high",
  "same-card": "medium",
  "same-set": "low",
  "same-player": "low",
  none: "none",
};

export interface CompStats {
  count: number;
  median: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  last: { price: number; date: string } | null;
  /** Median of sales in the trailing 365 days, when there are any. */
  median12m: number | null;
  count12m: number;
}

export interface ValuationResult {
  query: AssetQuery;
  tier: MatchTier;
  /** The comps the numbers came from, newest first. */
  comps: CompLot[];
  stats: CompStats | null;
  /**
   * Point estimate of fair value, or null when the matches are too loose to
   * justify one. Deliberately null rather than a guess.
   */
  fairValue: number | null;
  /** Present only when the user supplied an asking price. */
  relative: {
    askingPrice: number;
    ratio: number;          // asking / fairValue
    percentDiff: number;    // negative = below comps
    verdict: "below-comps" | "in-line" | "above-comps";
  } | null;
  /** Human-readable caveats specific to this result. */
  notes: string[];
}

export const GRADERS = ["PSA", "BGS", "SGC", "CSG", "CGC", "MBA", "Raw/Ungraded"] as const;
