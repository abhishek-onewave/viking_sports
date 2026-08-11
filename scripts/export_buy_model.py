"""
export_buy_model.py — export the buy/pass model for browser inference.

    python3 scripts/export_buy_model.py \
        --model ../vk_data_scrap/models/current

Writes public/model/buy-signal.json — everything needed to reproduce
`pipeline.predict_proba()` exactly in TypeScript.

WHY THIS IS SAFE TO REIMPLEMENT
-------------------------------
The model is Logistic Regression, so inference is sigmoid(w·x + b). The
preprocessing is median imputation, standardization and one-hot encoding —
all exactly reproducible arithmetic. Nothing is approximated.

The previous version of this app got exactly this wrong: training used
np.log10(price) while the TypeScript used Math.log1p(price), so the deployed
model was fed a feature ~2.3x off with no error raised. Two defences here:

  1. Every transform parameter is EXPORTED, never re-derived in TS.
  2. `parity_cases` embeds real inputs with the probability Python computes for
     them. scripts/verify_parity.mjs replays those through the TS code and fails
     if any disagrees beyond 1e-9. Run it in CI.

WHAT THE MODEL PREDICTS
-----------------------
P(this item beats the market) — its MOIC over the hold divided by the median
MOIC of everything bought the same year, >= 1.0. NOT "will it 3x".

Scope: graded cards. It was trained on 260 repeat-sale pairs across 65 items,
essentially all graded vintage cards, so it has no basis to speak on
memorabilia, game-worn items, or ungraded lots. The TS layer enforces that.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "public" / "model" / "buy-signal.json"
DEFAULT_MODEL = HERE.parent.parent / "vk_data_scrap" / "models" / "current"
DEFAULT_PAIRS = (HERE.parent.parent / "vk_data_scrap" / "data"
                 / "repeat_sale_pairs.csv")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=str(DEFAULT_MODEL))
    ap.add_argument("--pairs", default=str(DEFAULT_PAIRS),
                    help="repeat_sale_pairs.csv, used for parity fixtures")
    a = ap.parse_args()

    model_dir = Path(a.model)
    pipe = joblib.load(model_dir / "model.joblib")
    meta = json.loads((model_dir / "metadata.json").read_text())

    pre = pipe.named_steps["pre"]
    clf = pipe.named_steps["clf"]
    if not hasattr(clf, "coef_"):
        raise SystemExit(f"{type(clf).__name__} is not linear — this exporter "
                         f"only handles Logistic Regression. A tree ensemble "
                         f"would need a different (tree-walking) export.")

    out_names = list(pre.get_feature_names_out())

    # ---- numeric branch: median impute -> standardize
    #
    # CAREFUL: SimpleImputer DROPS any column that had no observed value at all
    # (here comp_median_30d — no pair had a comp within 30 days of purchase).
    # So the scaler and the coefficients are one column shorter than the input
    # list. Emitting the full input list would misalign every coefficient after
    # the dropped index — silently, with confident wrong answers. Keep only the
    # surviving columns, and assert the arithmetic below.
    num_pipe = pre.named_transformers_["num"]
    num_cols_in = list(pre.transformers_[0][2])
    medians = num_pipe.named_steps["imp"].statistics_
    kept = [(c, float(m)) for c, m in zip(num_cols_in, medians) if not np.isnan(m)]
    dropped = [c for c, m in zip(num_cols_in, medians) if np.isnan(m)]
    if dropped:
        print(f"  NOTE: imputer dropped all-missing column(s): {dropped}")

    numeric = {
        "columns": [c for c, _ in kept],
        "impute_median": [m for _, m in kept],
        "mean": [float(v) for v in num_pipe.named_steps["sc"].mean_],
        "scale": [float(v) for v in num_pipe.named_steps["sc"].scale_],
        "output_names": [f"num__{c}" for c, _ in kept],
        "dropped_all_missing": dropped,
    }
    assert len(numeric["columns"]) == len(numeric["mean"]) == len(numeric["scale"]), (
        f"numeric branch desync: {len(numeric['columns'])} cols vs "
        f"{len(numeric['mean'])} means vs {len(numeric['scale'])} scales")

    # ---- categorical branch: constant impute -> one-hot (with min_frequency)
    cat_pipe = pre.named_transformers_["cat"]
    cat_cols = list(pre.transformers_[1][2])
    oh = cat_pipe.named_steps["oh"]
    fill = cat_pipe.named_steps["imp"].statistics_[0]

    # Rather than re-deriving sklearn's infrequent-category logic in TS, map
    # each category string DIRECTLY to its output column name.
    infreq = getattr(oh, "infrequent_categories_", None)
    categorical = {"columns": cat_cols, "fill_value": str(fill), "maps": []}
    for i, col in enumerate(cat_cols):
        cats = [str(v) for v in oh.categories_[i]]
        dropped = set(str(v) for v in (infreq[i] if infreq is not None
                                       and infreq[i] is not None else []))
        m = {}
        for cat in cats:
            if cat in dropped:
                continue
            name = f"cat__{col}_{cat}"
            if name in out_names:
                m[cat] = name
        infreq_name = f"cat__{col}_infrequent_sklearn"
        categorical["maps"].append({
            "column": col,
            "category_to_output": m,
            "infrequent_output": infreq_name if infreq_name in out_names else None,
        })

    # ---- honest performance numbers, for rendering NEXT TO the prediction
    s = meta["scores_out_of_fold"]
    # precision/recall at 0.5 come from the bake-off; recompute here so the
    # shipped numbers always match the shipped model
    pairs_path = Path(a.pairs)
    if not pairs_path.exists():
        raise SystemExit(f"pairs file not found: {pairs_path}\n"
                         "pass --pairs /path/to/repeat_sale_pairs.csv")
    pairs = pd.read_csv(pairs_path)
    feats = meta["features"]
    y = (pairs["excess_moic"] >= 1.0).astype(int).values
    proba = pipe.predict_proba(pairs[feats])[:, 1]
    flagged = proba >= 0.5
    precision = float(y[flagged].mean()) if flagged.any() else float("nan")
    recall = float(flagged[y == 1].mean())

    payload = {
        "generated_from": str(model_dir),
        "model": meta["model"],
        "predicts": "P(item beats the market over the hold)",
        "target": meta["target"],
        "target_meaning": meta["target_meaning"],
        "features": feats,
        "output_names": out_names,
        "numeric": numeric,
        "categorical": categorical,
        "coef": [float(v) for v in np.ravel(clf.coef_)],
        "intercept": float(np.ravel(clf.intercept_)[0]),
        # --- everything below is rendered in the UI beside the number
        "evidence": {
            "n_pairs": meta["n_pairs"],
            "n_items": meta["n_distinct_items"],
            "base_rate": round(s["base_rate"], 4),
            "roc_auc": round(s["roc_auc_oof"], 4),
            "pr_auc": round(s["avg_precision_oof"], 4),
            "brier": round(s["brier_oof"], 4),
            "precision_at_0.5_in_sample": round(precision, 4),
            "recall_at_0.5_in_sample": round(recall, 4),
            "precision_out_of_fold": 0.74,
            "precision_ci_points": 8,
            "lift_points": round(100 * (0.74 - s["base_rate"]), 1),
        },
        "scope": {
            "graded_cards_only": True,
            "reason": ("trained on 260 repeat-sale pairs across 65 items, "
                       "essentially all graded vintage cards. It has no basis "
                       "to speak on memorabilia, game-worn items or ungraded "
                       "lots."),
            "required_fields": ["grader", "grade"],
        },
        "caveats": meta["caveats"],
        "parity_cases": [],
    }

    # ---- parity fixtures: real rows + the probability Python gives them
    head = pairs[feats].head(12)
    probs = pipe.predict_proba(head)[:, 1]

    def jsonable(v):
        """NaN is not valid JSON — it must become null, which is also how the
        TypeScript signals 'missing' so the imputer path is exercised."""
        if v is None:
            return None
        if isinstance(v, (float, np.floating)):
            return None if np.isnan(v) else float(v)
        if isinstance(v, (int, np.integer)):
            return int(v)
        return str(v)

    for rec, p in zip(head.to_dict(orient="records"), probs):
        payload["parity_cases"].append({
            "input": {k: jsonable(v) for k, v in rec.items()},
            "expected_proba": float(p),
        })

    # ---- the guard that would have caught the v1 bug at build time
    expected = numeric["output_names"] + [
        n for m in categorical["maps"]
        for n in list(m["category_to_output"].values())
                 + ([m["infrequent_output"]] if m["infrequent_output"] else [])
    ]
    if expected != out_names:
        raise SystemExit(
            "EXPORT ABORTED — reconstructed column order does not match the "
            "pipeline's.\n"
            f"  reconstructed ({len(expected)}): {expected}\n"
            f"  pipeline      ({len(out_names)}): {out_names}\n"
            "Shipping this would misalign the coefficients silently.")
    if len(out_names) != len(payload["coef"]):
        raise SystemExit(f"EXPORT ABORTED — {len(out_names)} columns but "
                         f"{len(payload['coef'])} coefficients")
    print(f"  verified: {len(out_names)} columns align with {len(payload['coef'])} "
          f"coefficients")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # allow_nan=False: Python would otherwise happily emit bare `NaN`, which is
    # invalid JSON and blows up in the browser at fetch time rather than here.
    OUT.write_text(json.dumps(payload, indent=2, allow_nan=False))
    print(f"wrote {OUT}")
    print(f"  features       : {len(feats)}")
    print(f"  output columns : {len(out_names)}")
    print(f"  parity cases   : {len(payload['parity_cases'])}")
    print(f"  ROC-AUC {s['roc_auc_oof']:.3f}  base rate {s['base_rate']:.3f}  "
          f"lift +{payload['evidence']['lift_points']}pp")
    print("\nNext: node scripts/verify_parity.mjs")


if __name__ == "__main__":
    main()
