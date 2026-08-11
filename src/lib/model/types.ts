/**
 * DEPRECATED — kept only so the Supabase `predictions` table and the dashboard
 * can still read historical rows.
 *
 * The buy/not-buy classifier these types served has been retired. It was
 * trained on 12,000 synthetic rows whose labels came from a hand-written
 * formula, and that formula's strongest assumption ("Rookie Cards +0.30, Cards
 * Non-Rookie -0.08") is inverted in real repeat-sale data: non-rookie cards
 * showed median MOIC 1.32 / 22% >=2x versus rookies at 0.95 / 17%.
 *
 * It also could not work in principle: these inputs describe a CATEGORY, and
 * one category combination held 94 real deals ranging from 0.36x to 5.12x.
 *
 * Live analysis now lives in src/lib/valuation/, which reports observed
 * comparable sales instead of a predicted verdict. Do not add to this file.
 */

export interface PredictionInput {
  assetType: string;
  holdYears: number;
  decade: string;
  isRealized: boolean;
  priceTier: string;
}

export interface PredictionResult {
  assetType: string;
  holdYears: number;
  holdBucket: number;
  holdBucketLabel: string;
  decade: string;
  isRealized: boolean;
  priceTier: string;
  probability: number;
  prediction: "BUY" | "NOT BUY";
  confidence: "High" | "Medium" | "Low";
}

export const VALID_ASSET_TYPES = [
  "Rookie Cards",
  "Cards (Non-Rookie)",
  "Publications",
  "Memorabilia",
  "Game-Worn Jerseys",
  "Game-Worn Shoes",
  "Game-Used Equipment",
  "Tickets & Passes",
  "Complete Sets",
  "Coins & Currency",
  "Stickers",
  "Sealed Wax",
] as const;

export const VALID_DECADES = [
  "1980s",
  "1990s",
  "2000s",
  "2010s",
  "2020s",
] as const;

export const CLEAN_FEATURES = [
  "hold_bucket",
  "decade_ordinal",
  "is_realized",
  "log_buy_price",
  "price_tier_ordinal",
  "is_publication",
  "is_memorabilia",
  "is_rookie_card",
  "is_ticket",
  "is_jersey",
  "type_Cards (Non-Rookie)",
  "type_Coins & Currency",
  "type_Complete Sets",
  "type_Game-Used Equipment",
  "type_Game-Worn Jerseys",
  "type_Game-Worn Shoes",
  "type_Memorabilia",
  "type_Publications",
  "type_Rookie Cards",
  "type_Sealed Wax",
  "type_Stickers",
  "type_Tickets & Passes",
] as const;

export const VALID_PRICE_TIERS = [
  "Under $50",
  "$50-$500",
  "$500-$5K",
  "$5K-$20K",
  "$20K+",
] as const;

export const PRICE_TIER_ORDINAL: Record<string, number> = {
  "Under $50": 1,
  "$50-$500": 2,
  "$500-$5K": 3,
  "$5K-$20K": 4,
  "$20K+": 5,
};

export const PRICE_TIER_MIDPOINTS: Record<string, number> = {
  "Under $50": 25,
  "$50-$500": 150,
  "$500-$5K": 2000,
  "$5K-$20K": 10000,
  "$20K+": 40000,
};

export type AssetType = (typeof VALID_ASSET_TYPES)[number];
export type Decade = (typeof VALID_DECADES)[number];

export const HOLD_BUCKET_LABELS: Record<number, string> = {
  1: "Short (1-3 yr)",
  2: "Medium (4-10 yr)",
  3: "Long (11-20 yr)",
  4: "Very Long (20+ yr)",
};
