import { PredictionInput, CLEAN_FEATURES } from "./types";

const DECADE_ORDINAL: Record<string, number> = {
  "1980s": 1,
  "1990s": 2,
  "2000s": 3,
  "2010s": 4,
  "2020s": 5,
};

// StandardScaler params fitted on training data (only hold_bucket & decade_ordinal are scaled)
const SCALER_MEAN = [2.2253521126760565, 3.8732394366197185];
const SCALER_SCALE = [1.406195377391401, 1.4234413513377617];

function holdBucket(years: number): number {
  if (years <= 3) return 1;
  if (years <= 10) return 2;
  if (years <= 20) return 3;
  return 4;
}

export function buildFeatureVector(input: PredictionInput): number[] {
  const { assetType, holdYears, decade, isRealized } = input;

  // Scale hold_bucket and decade_ordinal to match training pipeline
  const rawHoldBucket = holdBucket(holdYears);
  const rawDecadeOrdinal = DECADE_ORDINAL[decade] ?? 5;
  const scaledHoldBucket = (rawHoldBucket - SCALER_MEAN[0]) / SCALER_SCALE[0];
  const scaledDecadeOrdinal = (rawDecadeOrdinal - SCALER_MEAN[1]) / SCALER_SCALE[1];

  const featureMap: Record<string, number> = {
    hold_bucket: scaledHoldBucket,
    decade_ordinal: scaledDecadeOrdinal,
    is_realized: isRealized ? 1 : 0,
    is_publication: assetType === "Publications" ? 1 : 0,
    is_memorabilia: assetType === "Memorabilia" ? 1 : 0,
    is_rookie_card: assetType === "Rookie Cards" ? 1 : 0,
    is_ticket: assetType === "Tickets & Passes" ? 1 : 0,
    is_jersey: assetType === "Game-Worn Jerseys" ? 1 : 0,
    "type_Cards (Non-Rookie)": assetType === "Cards (Non-Rookie)" ? 1 : 0,
    "type_Coins & Currency": assetType === "Coins & Currency" ? 1 : 0,
    "type_Complete Sets": assetType === "Complete Sets" ? 1 : 0,
    "type_Game-Used Equipment": assetType === "Game-Used Equipment" ? 1 : 0,
    "type_Game-Worn Jerseys": assetType === "Game-Worn Jerseys" ? 1 : 0,
    "type_Game-Worn Shoes": assetType === "Game-Worn Shoes" ? 1 : 0,
    "type_Memorabilia": assetType === "Memorabilia" ? 1 : 0,
    "type_Publications": assetType === "Publications" ? 1 : 0,
    "type_Rookie Cards": assetType === "Rookie Cards" ? 1 : 0,
    "type_Sealed Wax": assetType === "Sealed Wax" ? 1 : 0,
    "type_Stickers": assetType === "Stickers" ? 1 : 0,
    "type_Tickets & Passes": assetType === "Tickets & Passes" ? 1 : 0,
  };

  return CLEAN_FEATURES.map((f) => featureMap[f] ?? 0);
}

export function getHoldBucket(years: number): number {
  return holdBucket(years);
}
