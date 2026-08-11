"""
build_model.py — train the valuation model on REAL auction results.

    python3 scripts/build_model.py --db ../vk_data_scrap/data/auction_lots.db

WHAT CHANGED, AND WHY
=====================
The previous version of this file generated 12,000 SYNTHETIC deals and trained
on them. Its label came from a hand-written formula:

    prob = 0.5
    prob += {"Rookie Cards": +0.30, "Cards (Non-Rookie)": -0.08, ...}[asset]
    prob += {"1990s": +0.25, "2020s": -0.20, ...}[decade]
    target = int(random() < prob)

So 12,000 of 12,089 rows (99.3%) were invented, and the reported AUC of 0.867
measured how well XGBoost could recover that formula — not anything about
sports memorabilia.

Those assumptions were then checked against 256 REAL repeat-sale pairs scraped
from six auction houses:

    formula said                 real data showed              verdict
    ------------------------     --------------------------    -------
    Rookie Cards      +0.30      median MOIC 0.95, 17% >=2x    contradicted
    Cards Non-Rookie  -0.08      median MOIC 1.32, 22% >=2x    BACKWARDS
    older decade better          2010s 44% vs 2020s 11%        true, but it is
                                                               the 2020-21
                                                               bubble, not a
                                                               decade effect
    longer hold better           corr(hold, moic) = +0.34      true but not
                                                               knowable at buy
    cheaper entry better         untestable (255/256 >$20K)    unknown

The strongest assumption had the sign inverted. Training on invented priors
produced a model that was confidently wrong, so the synthetic path is removed.

WHAT THIS TRAINS NOW
====================
Target: log1p(sale_price) — "what should this item sell for?"

That is a change of question, and it is deliberate. MOIC (`will it 3x?`) is a
ratio between two sales, so it only exists for items that sold twice: 256 pairs
out of 9,478 scraped lots. Price exists on every priced lot — 7,300+ rows. The
honest trade is 28x the data in exchange for predicting fair value rather than
future return.

Measured on real data (5-fold CV, then a 20% holdout):
    XGBoost               R2 0.837   median error 1.79x
    HistGradientBoosting  R2 0.833   median error 1.82x
    Random Forest         R2 0.833   median error 1.77x
    Ridge                 R2 0.764   median error 2.24x
    Baseline (mean)       R2 0.000   median error 5.38x

Caveat worth carrying into any UI: `source` alone accounts for ~0.68 of feature
importance, i.e. the model leans heavily on WHICH AUCTION HOUSE a lot is at.
Removing it drops R2 to 0.750. It knows tiers (graded beats raw, REA beats
Fanatics) far better than it knows individual cards — which is why the app
leads with observed comparable sales and treats this model as secondary.

NOTE ON THE APP
===============
The deployed analyzer no longer calls a classifier. It uses
public/data/comps.json (see scripts/export_comps.py) to show real comparable
sales. This script exists to produce a fair-value fallback for items with no
exact comps, and to keep the measurement reproducible.
"""
from __future__ import annotations

import argparse
import json

import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import (GradientBoostingRegressor,
                              HistGradientBoostingRegressor,
                              RandomForestRegressor)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import KFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DB = SCRIPT_DIR.parent.parent / "vk_data_scrap" / "data" / "auction_lots.db"
OUT_DIR = SCRIPT_DIR.parent / "public" / "model"

NUMERIC = ["year", "grade", "item_age", "sale_year", "player_freq", "has_grade"]
CATEGORICAL = ["set_name", "grader", "asset_type", "source"]


def load(db: Path) -> pd.DataFrame:
    conn = sqlite3.connect(db)
    df = pd.read_sql("""
        SELECT sale_price, sale_date, player, year, set_name, grader, grade,
               asset_type, source
        FROM lots WHERE sale_price IS NOT NULL AND sale_price > 0
    """, conn)
    df["y"] = np.log1p(df.sale_price)
    df["sale_year"] = pd.to_datetime(df.sale_date, errors="coerce").dt.year
    df["item_age"] = df.sale_year - df.year
    df["player_freq"] = df.player.map(df.player.value_counts()).fillna(0)
    df["has_grade"] = df.grade.notna().astype(int)
    return df


def median_x_error(y_log, p_log) -> float:
    """Median multiplicative error in dollars — the number to quote to a user.
    R^2 in log space flatters a heavy-tailed price target."""
    t = np.expm1(y_log).clip(1)
    p = np.expm1(p_log).clip(1)
    r = p / t
    return float(np.median(np.maximum(r, 1 / r)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(DEFAULT_DB))
    a = ap.parse_args()

    db = Path(a.db)
    if not db.exists():
        raise SystemExit(
            f"database not found: {db}\n"
            "This script trains on REAL scraped auction results. Point --db at "
            "the scraper's data/auction_lots.db. It will NOT fall back to "
            "synthetic data — that path was removed deliberately."
        )

    df = load(db)
    print(f"real priced lots: {len(df):,}   target: log1p(sale_price)")
    print(f"  date range: {df.sale_date.min()} .. {df.sale_date.max()}")
    print(f"  by source : {df.source.value_counts().to_dict()}")

    features = NUMERIC + CATEGORICAL
    X, y = df[features], df.y
    pre = ColumnTransformer([
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")),
                          ("sc", StandardScaler())]), NUMERIC),
        ("cat", Pipeline([("imp", SimpleImputer(strategy="constant", fill_value="NA")),
                          ("oh", OneHotEncoder(handle_unknown="ignore",
                                               min_frequency=10,
                                               sparse_output=False))]), CATEGORICAL),
    ])

    candidates = {
        "Baseline (mean)": DummyRegressor(strategy="mean"),
        "Ridge": Ridge(alpha=1.0),
        "Random Forest": RandomForestRegressor(n_estimators=300, min_samples_leaf=2,
                                               random_state=42, n_jobs=-1),
        "Gradient Boosting": GradientBoostingRegressor(n_estimators=300, max_depth=3,
                                                       learning_rate=0.05,
                                                       random_state=42),
        "HistGradientBoosting": HistGradientBoostingRegressor(max_depth=6,
                                                              learning_rate=0.05,
                                                              max_iter=400,
                                                              random_state=42),
    }
    try:
        from xgboost import XGBRegressor
        candidates["XGBoost"] = XGBRegressor(
            n_estimators=500, max_depth=5, learning_rate=0.05, subsample=0.9,
            colsample_bytree=0.9, reg_lambda=1.0, random_state=42, n_jobs=-1)
    except ImportError:
        print("  (xgboost not installed — skipping that candidate)")

    print(f"\n{'model':<24}{'R2 (log$)':>11}{'MAE':>9}{'median x-err':>14}")
    cv = KFold(5, shuffle=True, random_state=42)
    results, best = {}, (-np.inf, None, None)
    for name, m in candidates.items():
        pred = cross_val_predict(Pipeline([("pre", pre), ("m", m)]), X, y, cv=cv)
        r2 = r2_score(y, pred)
        results[name] = {"r2": round(float(r2), 4),
                         "mae": round(float(mean_absolute_error(y, pred)), 4),
                         "median_x_error": round(median_x_error(y, pred), 3)}
        print(f"{name:<24}{r2:>11.3f}{results[name]['mae']:>9.3f}"
              f"{results[name]['median_x_error']:>13.2f}x")
        if r2 > best[0]:
            best = (r2, name, m)
    _, best_name, best_model = best

    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)
    pipe = Pipeline([("pre", pre), ("m", best_model)])
    pipe.fit(Xtr, ytr)
    pte = pipe.predict(Xte)
    holdout = {"r2": round(float(r2_score(yte, pte)), 4),
               "median_x_error": round(median_x_error(yte, pte), 3),
               "n_test": int(len(yte))}
    print(f"\nwinner: {best_name}")
    print(f"holdout (n={holdout['n_test']:,}): R2={holdout['r2']:.3f}  "
          f"median error {holdout['median_x_error']:.2f}x")

    pipe.fit(X, y)          # final fit on everything
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    meta = {
        "task": "regression — log1p(sale_price); fair value, NOT future return",
        "trained_on": "real scraped auction results only (no synthetic data)",
        "n_rows": int(len(df)),
        "date_range": [str(df.sale_date.min()), str(df.sale_date.max())],
        "features": features,
        "model": best_name,
        "cv_5fold": results,
        "holdout_20pct": holdout,
        "caveats": [
            "Predicts fair value. It cannot tell you an item will 3x.",
            f"Typical prediction is off by ~{holdout['median_x_error']}x — a "
            "screen for human review, not an execution signal.",
            "`source` carries ~0.68 of feature importance: the model leans on "
            "which auction house a lot is at. Without it R2 falls to ~0.750.",
            "Each source covers a narrow date window, so the model encodes "
            "those windows' price levels and drifts. Retrain after each scrape.",
            "The app's primary output is observed comparable sales "
            "(public/data/comps.json); this model is the fallback for items "
            "with no exact comps.",
        ],
    }
    (OUT_DIR / "valuation-meta.json").write_text(json.dumps(meta, indent=2))
    print(f"\nwrote {OUT_DIR/'valuation-meta.json'}")

    # The fitted pipeline is a pickle: it must NOT live under public/, which is
    # served to the internet, and nothing in the browser can load it anyway.
    # It goes to a gitignored local directory for server-side/offline use.
    try:
        import joblib
        artifacts = SCRIPT_DIR.parent / "model_artifacts"
        artifacts.mkdir(parents=True, exist_ok=True)
        joblib.dump(pipe, artifacts / "valuation-model.joblib")
        print(f"wrote {artifacts/'valuation-model.joblib'}  (gitignored)")
    except ImportError:
        pass

    print("\nNext: python3 scripts/export_comps.py  (refresh the comps index)")


if __name__ == "__main__":
    main()
