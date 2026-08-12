/**
 * Deal-level (category) buy/pass signal — the five-field analyzer.
 *
 * Asset type · hold period · purchase price · acquisition year · deal status,
 * the same inputs as v1, but behind a model trained on REAL repeat sales
 * instead of 12,000 synthetic rows.
 *
 * MEASURED, same 260 pairs, same grouped CV, same market-relative target:
 *
 *     asset type + hold + price + year   ROC-AUC 0.782   prec 0.75  rec 0.73
 *     grade + item year + comps          ROC-AUC 0.690   prec 0.74  rec 0.62
 *
 * The category inputs score HIGHER than the item-level ones, with tighter
 * variance. Most of that comes from `hold_years`, which the item-level model
 * excludes on purpose — and that exclusion is right for one question and wrong
 * for another:
 *
 *   "Should I buy this lot?"                  hold is unknown -> leakage
 *   "If I hold 5 years, will it beat market?" the USER supplies it -> scenario
 *
 * This model answers the second. The form asks for the hold period, so the user
 * is choosing a scenario rather than the model peeking at an outcome.
 *
 * WHAT IT CANNOT DO
 * Distinguish two items in the same category. Grouped by these exact inputs,
 * one combination in the real data held 94 pairs ranging 0.36x to 5.12x. This
 * is a BASE RATE for a category and hold — useful for portfolio construction,
 * useless for picking a specific lot. Use the item lookup for that.
 */

import { score, type BuySignalModel } from "./buySignal";

/**
 * Asset types with actual training support. The other nine categories have ZERO
 * rows in the 260 pairs, so their one-hot column doesn't exist and the model
 * would score them off the intercept alone — a number with no basis. We refuse
 * instead. This list is derived from the model file at load time rather than
 * hardcoded, so it stays true as the dataset grows.
 */
export function supportedAssetTypes(model: BuySignalModel): string[] {
  const map = model.categorical.maps.find((m) => m.column === "asset_type");
  return map ? Object.keys(map.category_to_output).sort() : [];
}

export interface PortfolioInput {
  assetType: string;
  holdYears: number;
  purchasePrice: number;
  acquisitionYear: number;
  /** Collected for the record. NOT a model feature — see below. */
  isRealized: boolean;
}

export interface PortfolioResult {
  probability: number;
  verdict: "buy" | "marginal" | "pass";
  evidence: BuySignalModel["evidence"];
  caveats: string[];
  /** Support for the chosen category, so the UI can qualify the number. */
  categorySupport: "strong" | "thin" | "none";
}

export interface PortfolioOutOfScope {
  outOfScope: true;
  reason: string;
  supported: string[];
}

let cache: BuySignalModel | null = null;

export async function loadPortfolioModel(): Promise<BuySignalModel> {
  if (cache) return cache;
  const res = await fetch("/model/portfolio-signal.json");
  if (!res.ok) throw new Error(`could not load deal model (${res.status})`);
  cache = await res.json();
  return cache!;
}

/** Categories with few enough pairs that the estimate is fragile. */
const THIN: Record<string, number> = { Memorabilia: 18 };

export function portfolioSignal(
  model: BuySignalModel,
  inp: PortfolioInput,
): PortfolioResult | PortfolioOutOfScope {
  const supported = supportedAssetTypes(model);
  if (!supported.includes(inp.assetType)) {
    return {
      outOfScope: true,
      supported,
      reason:
        `No repeat-sale data for ${inp.assetType}. The training set contains ` +
        `only ${supported.join(", ")}, so a number for this category would ` +
        `come from the model's intercept rather than from evidence. ` +
        `Rather than show you that, we don't.`,
    };
  }
  if (!inp.purchasePrice || inp.purchasePrice <= 0) {
    return { outOfScope: true, supported, reason: "Enter a purchase price." };
  }
  if (!inp.holdYears || inp.holdYears <= 0) {
    return { outOfScope: true, supported, reason: "Enter a hold period." };
  }

  // Units must match train/fit_portfolio.py exactly: log1p of the price, and
  // the raw acquisition year. Getting either wrong is silent and confident —
  // v1 shipped log10-vs-log1p and nothing raised.
  const raw: Record<string, number | string | null> = {
    hold_years: inp.holdYears,
    log_buy_price: Math.log1p(inp.purchasePrice),
    buy_year: inp.acquisitionYear,
    asset_type: inp.assetType,
  };

  const p = score(model, raw);
  const caveats = [...model.caveats];
  const n = THIN[inp.assetType];
  const categorySupport: PortfolioResult["categorySupport"] =
    n ? "thin" : "strong";
  if (n) {
    caveats.unshift(
      `${inp.assetType} has only ${n} repeat sales in the training data — this ` +
        `estimate is fragile.`,
    );
  }
  if (inp.isRealized) {
    caveats.push(
      "Deal status is recorded but does not affect the model: every training " +
        "pair is a realized buy/sell, so the field is constant and carries no " +
        "signal.",
    );
  }

  return {
    probability: p,
    verdict: p >= 0.6 ? "buy" : p >= 0.45 ? "marginal" : "pass",
    evidence: model.evidence,
    caveats,
    categorySupport,
  };
}

export const isPortfolioOutOfScope = (
  x: PortfolioResult | PortfolioOutOfScope,
): x is PortfolioOutOfScope => (x as PortfolioOutOfScope).outOfScope === true;
