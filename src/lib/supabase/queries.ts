import { supabase } from "./client";
import { PredictionResult } from "../model/types";

export interface StoredPrediction {
  id: string;
  asset_type: string;
  hold_years: number;
  decade: string;
  is_realized: boolean;
  prediction: string;
  probability: number;
  confidence: string;
  created_at: string;
}

export async function savePrediction(
  result: PredictionResult
): Promise<void> {
  if (!supabase) return;

  await supabase.from("predictions").insert({
    asset_type: result.assetType,
    hold_years: result.holdYears,
    decade: result.decade,
    is_realized: result.isRealized,
    prediction: result.prediction,
    probability: result.probability,
    confidence: result.confidence,
  });
}

export async function getRecentPredictions(
  limit = 20
): Promise<StoredPrediction[]> {
  if (!supabase) return [];

  const { data } = await supabase
    .from("predictions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as StoredPrediction[]) ?? [];
}

export async function getPredictionStats(): Promise<{
  total: number;
  buyCount: number;
  notBuyCount: number;
}> {
  if (!supabase) return { total: 0, buyCount: 0, notBuyCount: 0 };

  const { count: total } = await supabase
    .from("predictions")
    .select("*", { count: "exact", head: true });

  const { count: buyCount } = await supabase
    .from("predictions")
    .select("*", { count: "exact", head: true })
    .eq("prediction", "BUY");

  return {
    total: total ?? 0,
    buyCount: buyCount ?? 0,
    notBuyCount: (total ?? 0) - (buyCount ?? 0),
  };
}
