import {
  PredictionInput,
  PredictionResult,
  VALID_ASSET_TYPES,
  VALID_DECADES,
  VALID_PRICE_TIERS,
  HOLD_BUCKET_LABELS,
} from "./types";
import { buildFeatureVector, getHoldBucket } from "./feature-engineering";
import { loadModel, predict as score } from "./xgboost-scorer";

export async function predictDeal(
  input: PredictionInput
): Promise<PredictionResult> {
  if (!VALID_ASSET_TYPES.includes(input.assetType as any)) {
    throw new Error(`Invalid asset type: ${input.assetType}`);
  }
  if (!VALID_DECADES.includes(input.decade as any)) {
    throw new Error(`Invalid decade: ${input.decade}`);
  }
  if (input.holdYears < 1 || input.holdYears > 50) {
    throw new Error("Hold years must be between 1 and 50");
  }
  if (!VALID_PRICE_TIERS.includes(input.priceTier as any)) {
    throw new Error(`Invalid price tier: ${input.priceTier}`);
  }

  await loadModel();

  const features = buildFeatureVector(input);
  const probability = score(features);

  const prediction = probability >= 0.5 ? "BUY" : "NOT BUY";
  const pct = probability * 100;
  let confidence: "High" | "Medium" | "Low";
  if (pct > 75 || pct < 25) {
    confidence = "High";
  } else if (pct > 55 || pct < 45) {
    confidence = "Medium";
  } else {
    confidence = "Low";
  }

  const bucket = getHoldBucket(input.holdYears);

  return {
    assetType: input.assetType,
    holdYears: input.holdYears,
    holdBucket: bucket,
    holdBucketLabel: HOLD_BUCKET_LABELS[bucket],
    decade: input.decade,
    isRealized: input.isRealized,
    priceTier: input.priceTier,
    probability,
    prediction,
    confidence,
  };
}
