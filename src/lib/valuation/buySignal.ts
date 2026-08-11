/**
 * Buy/pass signal — browser-side inference for the beat-the-market model.
 *
 * WHAT IT PREDICTS
 *   P(this item's return beats the market over the hold), where "the market" is
 *   the median MOIC of everything bought the same year. NOT "will it 3x".
 *
 *   That distinction is the whole reason this model is usable. Predicting raw
 *   MOIC gave 0.751 ROC-AUC, but almost all of it came from `buy_year` — the
 *   model had learned the 2020-21 bubble, and buy_year cannot extrapolate to a
 *   future purchase. Dividing by a same-year benchmark removes the confound
 *   (correlation with buy_year drops from -0.301 to 0.000) and leaves genuine
 *   asset-selection signal at 0.734, with half the variance.
 *
 * WHY REIMPLEMENTING THE MODEL IS SAFE HERE
 *   It's Logistic Regression: sigmoid(w·x + b). Preprocessing is median
 *   imputation, standardization and one-hot encoding — exact arithmetic, no
 *   approximation. Every parameter comes from buy-signal.json rather than being
 *   re-derived, and scripts/verify_parity.mjs replays real inputs through this
 *   code and fails if any probability disagrees with Python beyond 1e-9.
 *
 *   v1 of this app is why that test exists: training used np.log10(price) while
 *   the TypeScript used Math.log1p(price), so the deployed model was silently
 *   fed a feature ~2.3x wrong.
 */

import type { CompLot, CompStats } from "./types";

export interface BuySignalModel {
  predicts: string;
  target: string;
  target_meaning: string;
  features: string[];
  output_names: string[];
  numeric: {
    columns: string[];
    impute_median: number[];
    mean: number[];
    scale: number[];
    output_names: string[];
    dropped_all_missing: string[];
  };
  categorical: {
    columns: string[];
    fill_value: string;
    maps: {
      column: string;
      category_to_output: Record<string, string>;
      infrequent_output: string | null;
    }[];
  };
  coef: number[];
  intercept: number;
  evidence: {
    n_pairs: number;
    n_items: number;
    base_rate: number;
    roc_auc: number;
    pr_auc: number;
    brier: number;
    precision_out_of_fold: number;
    precision_ci_points: number;
    lift_points: number;
  };
  scope: {
    graded_cards_only: boolean;
    reason: string;
    required_fields: string[];
  };
  caveats: string[];
  parity_cases: { input: Record<string, number | string | null>; expected_proba: number }[];
}

export type SignalVerdict = "favourable" | "neutral" | "unfavourable";

export interface BuySignal {
  probability: number;
  verdict: SignalVerdict;
  /** Percentage-point improvement over the base rate this model offers. */
  evidence: BuySignalModel["evidence"];
  caveats: string[];
}

/** Why the model declined to score an item. Never guess outside scope. */
export interface OutOfScope {
  outOfScope: true;
  reason: string;
}

let cache: BuySignalModel | null = null;

export async function loadBuyModel(): Promise<BuySignalModel> {
  if (cache) return cache;
  const res = await fetch("/model/buy-signal.json");
  if (!res.ok) throw new Error(`could not load buy model (${res.status})`);
  cache = await res.json();
  return cache!;
}

// ------------------------------------------------------------------ features
export interface SignalInput {
  askingPrice: number;
  grade: number | null;
  grader: string;
  itemYear: number | null;
  assetType: string;
  comps: CompLot[];
  stats: CompStats | null;
}

/**
 * Build the raw named feature record. Names and units must match training
 * exactly — see train/repeat_sales.py, which produced them.
 */
function rawFeatures(inp: SignalInput): Record<string, number | string | null> {
  const now = new Date();
  const year = now.getFullYear();
  const prices = inp.comps.map((c) => c.pr);
  const mean = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : NaN;
  const sd = prices.length > 1
    ? Math.sqrt(prices.reduce((a, b) => a + (b - mean) ** 2, 0) / (prices.length - 1))
    : NaN;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const since = (days: number) => {
    const t = new Date(now);
    t.setDate(t.getDate() - days);
    return iso(t);
  };
  const win = (days: number) => inp.comps.filter((c) => c.d >= since(days));
  const median = (xs: number[]) => {
    if (!xs.length) return NaN;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const medAll = inp.stats?.median ?? median(prices);
  const last = inp.stats?.last?.price ?? NaN;

  return {
    // log1p to match np.log1p(buy_price) in repeat_sales.py — NOT log10
    log_buy_price: Math.log1p(inp.askingPrice),
    grade: inp.grade,
    item_year: inp.itemYear,
    item_age_at_buy: inp.itemYear == null ? null : year - inp.itemYear,
    num_bids_at_buy: null,           // unknown before you bid; imputed
    comp_count_all: inp.comps.length,
    comp_count_30d: win(30).length,
    comp_count_90d: win(90).length,
    comp_count_365d: win(365).length,
    comp_median_all: Number.isFinite(medAll) ? medAll : null,
    comp_median_30d: null,           // dropped by the imputer (all-missing in training)
    comp_median_90d: win(90).length ? median(win(90).map((c) => c.pr)) : null,
    comp_median_365d: win(365).length ? median(win(365).map((c) => c.pr)) : null,
    comp_std_all: Number.isFinite(sd) ? sd : null,
    comp_last_price: Number.isFinite(last) ? last : null,
    comp_last_vs_median:
      Number.isFinite(last) && Number.isFinite(medAll) && medAll > 0 ? last / medAll : null,
    buy_vs_comp_median:
      Number.isFinite(medAll) && medAll > 0 ? inp.askingPrice / medAll : null,
    asset_type: inp.assetType,
    grader: inp.grader,
  };
}

/** Reproduce ColumnTransformer -> LogisticRegression exactly. */
export function score(
  model: BuySignalModel,
  raw: Record<string, number | string | null>,
): number {
  const vec = new Map<string, number>();

  // numeric: median-impute then standardize
  model.numeric.columns.forEach((col, i) => {
    const v = raw[col];
    const num = typeof v === "number" && Number.isFinite(v)
      ? v
      : model.numeric.impute_median[i];
    vec.set(model.numeric.output_names[i],
            (num - model.numeric.mean[i]) / model.numeric.scale[i]);
  });

  // categorical: constant-impute then one-hot via the exported name map
  for (const m of model.categorical.maps) {
    const v = raw[m.column];
    const key = v == null || v === "" ? model.categorical.fill_value : String(v);
    const target = m.category_to_output[key] ?? m.infrequent_output;
    if (target) vec.set(target, 1);
  }

  // dot product in the pipeline's own column order
  let z = model.intercept;
  model.output_names.forEach((name, i) => {
    z += (vec.get(name) ?? 0) * model.coef[i];
  });
  return 1 / (1 + Math.exp(-z));
}

// -------------------------------------------------------------------- public
/**
 * Score an item, or explain why it's out of scope.
 *
 * The scope gate is not a formality. The model saw 260 repeat-sale pairs across
 * 65 items, essentially all graded vintage cards. Asked about a game-worn
 * jersey it would still emit a number, and that number would be meaningless.
 * Refusing is the correct output.
 */
export function buySignal(
  model: BuySignalModel,
  inp: SignalInput,
): BuySignal | OutOfScope {
  if (model.scope.graded_cards_only) {
    if (inp.grade == null || !inp.grader || inp.grader === "Raw/Ungraded") {
      return {
        outOfScope: true,
        reason:
          "This signal covers graded cards only. Enter a grader and grade to " +
          "get one — " + model.scope.reason,
      };
    }
    if (!/card/i.test(inp.assetType)) {
      return {
        outOfScope: true,
        reason:
          `No signal for ${inp.assetType.toLowerCase()}. ` + model.scope.reason,
      };
    }
  }
  if (!inp.askingPrice || inp.askingPrice <= 0) {
    return { outOfScope: true, reason: "Enter an asking price to get a signal." };
  }

  const p = score(model, rawFeatures(inp));
  const caveats = [...model.caveats];
  if (inp.comps.length === 0) {
    caveats.unshift(
      "No comparable sales were found, so every market feature was filled with " +
        "a training-set median. The signal carries little information here.",
    );
  } else if (inp.comps.length < 3) {
    caveats.unshift(
      `Only ${inp.comps.length} comparable sale${inp.comps.length === 1 ? "" : "s"} ` +
        "informed this signal.",
    );
  }

  return {
    probability: p,
    verdict: p >= 0.6 ? "favourable" : p >= 0.45 ? "neutral" : "unfavourable",
    evidence: model.evidence,
    caveats,
  };
}

export const isOutOfScope = (x: BuySignal | OutOfScope): x is OutOfScope =>
  (x as OutOfScope).outOfScope === true;
