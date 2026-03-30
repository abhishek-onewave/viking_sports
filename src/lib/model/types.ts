export interface PredictionInput {
  assetType: string;
  holdYears: number;
  decade: string;
  isRealized: boolean;
}

export interface PredictionResult {
  assetType: string;
  holdYears: number;
  holdBucket: number;
  holdBucketLabel: string;
  decade: string;
  isRealized: boolean;
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
  "Autographs",
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

export type AssetType = (typeof VALID_ASSET_TYPES)[number];
export type Decade = (typeof VALID_DECADES)[number];

export const HOLD_BUCKET_LABELS: Record<number, string> = {
  1: "Short (1-3 yr)",
  2: "Medium (4-10 yr)",
  3: "Long (11-20 yr)",
  4: "Very Long (20+ yr)",
};
