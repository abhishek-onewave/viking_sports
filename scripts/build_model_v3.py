"""
Viking Sports Model v3 — Optuna tuning + SMOTE + LightGBM vs XGBoost comparison.

Usage: python3 scripts/build_model_v3.py
Output: scripts/viking_sports_model_v3.pkl + public/model/ exports
"""

import numpy as np
import pandas as pd
import pickle
import json
import os
import warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score, precision_score,
    recall_score, classification_report, confusion_matrix
)
from imblearn.over_sampling import SMOTE, ADASYN
from imblearn.combine import SMOTETomek
import xgboost as xgb
import lightgbm as lgb
import optuna
from optuna.samplers import TPESampler

optuna.logging.set_verbosity(optuna.logging.WARNING)
np.random.seed(42)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ORIG_CSV = os.path.join(SCRIPT_DIR, "..", "..", "data_prep", "viking_sl_prepared_data.csv")
SYNTH_CSV = os.path.join(SCRIPT_DIR, "..", "..", "data_prep", "synthetic_deals_12000.csv")

# ─── Features ────────────────────────────────────────────────────────────────

FEATURES = [
    "hold_bucket", "decade_ordinal", "is_realized",
    "log_buy_price", "price_tier_ordinal",
    "is_publication", "is_memorabilia", "is_rookie_card", "is_ticket", "is_jersey",
    "type_Cards (Non-Rookie)", "type_Coins & Currency", "type_Complete Sets",
    "type_Game-Used Equipment", "type_Game-Worn Jerseys", "type_Game-Worn Shoes",
    "type_Memorabilia", "type_Publications", "type_Rookie Cards",
    "type_Sealed Wax", "type_Stickers", "type_Tickets & Passes",
]

CONTINUOUS_COLS = ["hold_bucket", "decade_ordinal", "log_buy_price", "price_tier_ordinal"]

ASSET_TYPES = [
    "Rookie Cards", "Cards (Non-Rookie)", "Tickets & Passes",
    "Game-Worn Jerseys", "Publications", "Memorabilia",
    "Sealed Wax", "Stickers", "Coins & Currency",
    "Game-Used Equipment", "Game-Worn Shoes", "Complete Sets",
]
DECADES = ["1980s", "1990s", "2000s", "2010s", "2020s"]
DECADE_ORDINAL = {"1980s": 1, "1990s": 2, "2000s": 3, "2010s": 4, "2020s": 5}
PRICE_TIERS = {
    "Under $50": {"range": (5, 49), "ordinal": 1},
    "$50-$500": {"range": (50, 500), "ordinal": 2},
    "$500-$5K": {"range": (500, 5000), "ordinal": 3},
    "$5K-$20K": {"range": (5000, 20000), "ordinal": 4},
    "$20K+": {"range": (20000, 80000), "ordinal": 5},
}

# ─── Load & Prepare Data ─────────────────────────────────────────────────────

print("=" * 70)
print("VIKING SPORTS — Model v3 (Optuna + SMOTE + LightGBM)")
print("=" * 70)

# Load original
print("\n[1] Loading data...")
orig = pd.read_csv(ORIG_CSV)

hb_scaled_to_raw = {-0.8714: 1, -0.1603: 2, 0.5509: 3, 1.262: 4}
do_scaled_to_raw = {-2.0185: 1, -1.316: 2, -0.6135: 3, 0.0891: 4, 0.7916: 5}
pt_scaled_to_raw = {-1.3334: 1, -0.4956: 2, 0.3422: 3, 1.18: 4, 2.0178: 5}

orig_clean = orig.copy()
orig_clean["hold_bucket"] = orig["hold_bucket"].map(hb_scaled_to_raw)
orig_clean["decade_ordinal"] = orig["decade_ordinal"].map(do_scaled_to_raw)
orig_clean["price_tier_ordinal"] = orig["price_tier_ordinal"].map(pt_scaled_to_raw)
orig_clean["log_buy_price"] = np.log10(orig_clean["buy_price"])

for col in FEATURES:
    if col.startswith("type_") and col in orig_clean.columns:
        orig_clean[col] = orig_clean[col].astype(int)

# Load synthetic
synth = pd.read_csv(SYNTH_CSV)
for col in FEATURES:
    if col.startswith("type_") and col in synth.columns:
        synth[col] = synth[col].astype(int)

orig_for_merge = orig_clean[FEATURES + ["target_binary"]].copy()
synth_for_merge = synth[FEATURES + ["target_binary"]].copy()
combined = pd.concat([orig_for_merge, synth_for_merge], ignore_index=True)

print(f"    Original: {len(orig)} rows")
print(f"    Synthetic: {len(synth)} rows")
print(f"    Combined: {len(combined)} rows")
print(f"    Target balance: {dict(combined['target_binary'].value_counts())}")

X_raw = combined[FEATURES].values.astype(float)
y = combined["target_binary"].values

# Scale continuous features
cont_indices = [FEATURES.index(c) for c in CONTINUOUS_COLS]
scaler = StandardScaler()
X_raw[:, cont_indices] = scaler.fit_transform(X_raw[:, cont_indices])

print(f"    Scaler means: {[round(m, 4) for m in scaler.mean_]}")
print(f"    Scaler scales: {[round(s, 4) for s in scaler.scale_]}")

# Train/test split
X_train_raw, X_test, y_train_raw, y_test = train_test_split(
    X_raw, y, test_size=0.2, stratify=y, random_state=42
)
print(f"    Train: {len(X_train_raw)}, Test: {len(X_test)}")

# ─── SMOTE Variants ──────────────────────────────────────────────────────────

print("\n[2] Applying oversampling strategies...")

smote_strategies = {}

# Plain SMOTE
sm = SMOTE(random_state=42, k_neighbors=5)
X_sm, y_sm = sm.fit_resample(X_train_raw, y_train_raw)
smote_strategies["SMOTE"] = (X_sm, y_sm)
print(f"    SMOTE: {len(X_sm)} rows, balance={dict(pd.Series(y_sm).value_counts())}")

# ADASYN (adaptive) — skip if classes already balanced
try:
    ada = ADASYN(random_state=42, n_neighbors=5)
    X_ada, y_ada = ada.fit_resample(X_train_raw, y_train_raw)
    smote_strategies["ADASYN"] = (X_ada, y_ada)
    print(f"    ADASYN: {len(X_ada)} rows, balance={dict(pd.Series(y_ada).value_counts())}")
except ValueError:
    print(f"    ADASYN: skipped (classes already balanced)")

# SMOTETomek (oversample + clean borderline)
smt = SMOTETomek(random_state=42)
X_smt, y_smt = smt.fit_resample(X_train_raw, y_train_raw)
smote_strategies["SMOTETomek"] = (X_smt, y_smt)
print(f"    SMOTETomek: {len(X_smt)} rows, balance={dict(pd.Series(y_smt).value_counts())}")

# No resampling baseline
smote_strategies["None"] = (X_train_raw, y_train_raw)

# ─── Optuna Tuning ────────────────────────────────────────────────────────────

print("\n[3] Optuna hyperparameter optimization (100 trials each)...")
print("    This may take a few minutes...\n")

cv_outer = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

all_results = []

def make_xgb_objective(X_tr, y_tr):
    def objective(trial):
        params = {
            "max_depth": trial.suggest_int("max_depth", 3, 8),
            "n_estimators": trial.suggest_int("n_estimators", 100, 800, step=50),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "gamma": trial.suggest_float("gamma", 0.0, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
        }
        model = xgb.XGBClassifier(
            objective="binary:logistic",
            eval_metric="logloss",
            use_label_encoder=False,
            random_state=42,
            **params
        )
        scores = cross_val_score(model, X_tr, y_tr, cv=cv_outer, scoring="roc_auc", n_jobs=-1)
        return scores.mean()
    return objective


def make_lgb_objective(X_tr, y_tr):
    def objective(trial):
        params = {
            "max_depth": trial.suggest_int("max_depth", 3, 8),
            "n_estimators": trial.suggest_int("n_estimators", 100, 800, step=50),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "min_child_samples": trial.suggest_int("min_child_samples", 5, 50),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 15, 127),
        }
        model = lgb.LGBMClassifier(
            objective="binary",
            random_state=42,
            verbosity=-1,
            **params
        )
        scores = cross_val_score(model, X_tr, y_tr, cv=cv_outer, scoring="roc_auc", n_jobs=-1)
        return scores.mean()
    return objective


N_TRIALS = 100

for samp_name, (X_tr, y_tr) in smote_strategies.items():
    print(f"  --- Sampling: {samp_name} ---")

    # XGBoost + Optuna
    study_xgb = optuna.create_study(direction="maximize", sampler=TPESampler(seed=42))
    study_xgb.optimize(make_xgb_objective(X_tr, y_tr), n_trials=N_TRIALS, show_progress_bar=False)
    best_xgb_params = study_xgb.best_params
    best_xgb_cv_auc = study_xgb.best_value

    xgb_model = xgb.XGBClassifier(
        objective="binary:logistic", eval_metric="logloss",
        use_label_encoder=False, random_state=42, **best_xgb_params
    )
    xgb_model.fit(X_tr, y_tr)
    xgb_pred = xgb_model.predict(X_test)
    xgb_prob = xgb_model.predict_proba(X_test)[:, 1]
    xgb_acc = accuracy_score(y_test, xgb_pred)
    xgb_f1 = f1_score(y_test, xgb_pred)
    xgb_auc = roc_auc_score(y_test, xgb_prob)
    xgb_prec = precision_score(y_test, xgb_pred)
    xgb_rec = recall_score(y_test, xgb_pred)

    print(f"    XGBoost:  AUC={xgb_auc:.4f}  Acc={xgb_acc:.4f}  F1={xgb_f1:.4f}  "
          f"Prec={xgb_prec:.4f}  Rec={xgb_rec:.4f}  CV_AUC={best_xgb_cv_auc:.4f}")

    all_results.append({
        "algo": "XGBoost", "sampling": samp_name,
        "test_acc": xgb_acc, "test_f1": xgb_f1, "test_auc": xgb_auc,
        "test_prec": xgb_prec, "test_rec": xgb_rec,
        "cv_auc": best_xgb_cv_auc,
        "params": best_xgb_params, "model": xgb_model,
    })

    # LightGBM + Optuna
    study_lgb = optuna.create_study(direction="maximize", sampler=TPESampler(seed=42))
    study_lgb.optimize(make_lgb_objective(X_tr, y_tr), n_trials=N_TRIALS, show_progress_bar=False)
    best_lgb_params = study_lgb.best_params
    best_lgb_cv_auc = study_lgb.best_value

    lgb_model = lgb.LGBMClassifier(
        objective="binary", random_state=42, verbosity=-1, **best_lgb_params
    )
    lgb_model.fit(X_tr, y_tr)
    lgb_pred = lgb_model.predict(X_test)
    lgb_prob = lgb_model.predict_proba(X_test)[:, 1]
    lgb_acc = accuracy_score(y_test, lgb_pred)
    lgb_f1 = f1_score(y_test, lgb_pred)
    lgb_auc = roc_auc_score(y_test, lgb_prob)
    lgb_prec = precision_score(y_test, lgb_pred)
    lgb_rec = recall_score(y_test, lgb_pred)

    print(f"    LightGBM: AUC={lgb_auc:.4f}  Acc={lgb_acc:.4f}  F1={lgb_f1:.4f}  "
          f"Prec={lgb_prec:.4f}  Rec={lgb_rec:.4f}  CV_AUC={best_lgb_cv_auc:.4f}")
    print()

    all_results.append({
        "algo": "LightGBM", "sampling": samp_name,
        "test_acc": lgb_acc, "test_f1": lgb_f1, "test_auc": lgb_auc,
        "test_prec": lgb_prec, "test_rec": lgb_rec,
        "cv_auc": best_lgb_cv_auc,
        "params": best_lgb_params, "model": lgb_model,
    })

# ─── Leaderboard ──────────────────────────────────────────────────────────────

print("\n" + "=" * 70)
print("LEADERBOARD (sorted by Test AUC)")
print("=" * 70)
print(f"{'Rank':<5} {'Algorithm':<12} {'Sampling':<13} {'AUC':>7} {'Acc':>7} {'F1':>7} {'Prec':>7} {'Rec':>7} {'CV_AUC':>7}")
print("-" * 70)

sorted_results = sorted(all_results, key=lambda x: x["test_auc"], reverse=True)
for i, r in enumerate(sorted_results):
    print(f"{i+1:<5} {r['algo']:<12} {r['sampling']:<13} {r['test_auc']:>7.4f} {r['test_acc']:>7.4f} "
          f"{r['test_f1']:>7.4f} {r['test_prec']:>7.4f} {r['test_rec']:>7.4f} {r['cv_auc']:>7.4f}")

# ─── Best Model Details ──────────────────────────────────────────────────────

best = sorted_results[0]
best_model = best["model"]
print(f"\n{'=' * 70}")
print(f"BEST: {best['algo']} + {best['sampling']}")
print(f"{'=' * 70}")
print(f"\nBest Hyperparameters:")
for k, v in best["params"].items():
    print(f"  {k:25s}: {v}")

y_pred_best = best_model.predict(X_test)
y_prob_best = best_model.predict_proba(X_test)[:, 1]

print(f"\nClassification Report:")
print(classification_report(y_test, y_pred_best, target_names=["NOT BUY", "BUY"]))

cm = confusion_matrix(y_test, y_pred_best)
print(f"Confusion Matrix:")
print(f"  TN={cm[0,0]:5d}  FP={cm[0,1]:5d}")
print(f"  FN={cm[1,0]:5d}  TP={cm[1,1]:5d}")

# Full CV on best
cv_final = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
if best["sampling"] != "None":
    samp_key = best["sampling"]
    X_best_train, y_best_train = smote_strategies[samp_key]
else:
    X_best_train, y_best_train = X_train_raw, y_train_raw

cv_auc_scores = cross_val_score(best_model, X_best_train, y_best_train, cv=cv_final, scoring="roc_auc")
cv_acc_scores = cross_val_score(best_model, X_best_train, y_best_train, cv=cv_final, scoring="accuracy")

metrics = {
    "test_accuracy": round(best["test_acc"], 4),
    "test_f1": round(best["test_f1"], 4),
    "test_auc": round(best["test_auc"], 4),
    "test_precision": round(best["test_prec"], 4),
    "test_recall": round(best["test_rec"], 4),
    "cv_auc_mean": round(cv_auc_scores.mean(), 4),
    "cv_auc_std": round(cv_auc_scores.std(), 4),
    "cv_acc_mean": round(cv_acc_scores.mean(), 4),
    "cv_acc_std": round(cv_acc_scores.std(), 4),
    "n_train": len(X_best_train),
    "n_test": len(X_test),
    "n_total": len(combined),
    "threshold": 0.5,
    "algorithm": best["algo"],
    "sampling": best["sampling"],
}

print(f"\nFinal Metrics:")
for k, v in metrics.items():
    print(f"  {k:20s}: {v}")

# Feature importance
print(f"\nTop Feature Importances:")
fi = best_model.feature_importances_
for idx in np.argsort(fi)[::-1][:10]:
    print(f"  {FEATURES[idx]:30s}: {fi[idx]:.4f}")

# ─── Spot Checks ──────────────────────────────────────────────────────────────

print(f"\n{'=' * 70}")
print("PREDICTION SPOT CHECKS")
print(f"{'=' * 70}")

test_cases = [
    ("Rookie Cards", 10, "2000s", 50, "Under $50", False),
    ("Rookie Cards", 2, "2020s", 2000, "$500-$5K", False),
    ("Cards (Non-Rookie)", 15, "1990s", 200, "$50-$500", False),
    ("Cards (Non-Rookie)", 1, "2020s", 10000, "$5K-$20K", False),
    ("Tickets & Passes", 5, "2010s", 100, "$50-$500", False),
    ("Sealed Wax", 25, "1990s", 30, "Under $50", True),
    ("Game-Worn Jerseys", 3, "2020s", 15000, "$5K-$20K", False),
    ("Memorabilia", 20, "2000s", 300, "$50-$500", True),
    ("Publications", 30, "1990s", 20, "Under $50", False),
    ("Stickers", 8, "2010s", 150, "$50-$500", False),
]

for asset, hold_yrs, decade, price, ptier, realized in test_cases:
    hb = 1 if hold_yrs <= 3 else 2 if hold_yrs <= 10 else 3 if hold_yrs <= 20 else 4
    do = DECADE_ORDINAL[decade]
    lbp = np.log10(price)
    pto = PRICE_TIERS[ptier]["ordinal"]

    raw = np.array([[hb, do, int(realized), lbp, pto,
                     int(asset == "Publications"),
                     int(asset == "Memorabilia"),
                     int(asset == "Rookie Cards"),
                     int(asset == "Tickets & Passes"),
                     int(asset == "Game-Worn Jerseys"),
                     ] + [int(asset == t) for t in ASSET_TYPES]], dtype=float)

    raw[:, cont_indices] = scaler.transform(raw[:, cont_indices])
    prob = best_model.predict_proba(raw)[0][1]
    label = "BUY" if prob > 0.5 else "NOT BUY"
    print(f"  {asset:25s} | {hold_yrs:2d}yr | {decade} | ${price:>6,} | {ptier:12s} | "
          f"{'Realized' if realized else 'Holding ':8s} -> {prob*100:5.1f}% {label}")

# ─── Save ─────────────────────────────────────────────────────────────────────

# Save best model as XGBoost JSON if it's XGBoost, or as pkl for LightGBM
OUT_PKL = os.path.join(SCRIPT_DIR, "viking_sports_model_v3.pkl")
bundle = {
    "model": best_model,
    "features": FEATURES,
    "scaler": scaler,
    "scaler_columns": CONTINUOUS_COLS,
    "metrics": metrics,
    "params": best["params"],
    "algorithm": best["algo"],
    "sampling": best["sampling"],
    "all_results": [{k: v for k, v in r.items() if k != "model"} for r in sorted_results],
}
with open(OUT_PKL, "wb") as f:
    pickle.dump(bundle, f)
print(f"\nModel bundle saved to: {OUT_PKL}")

# Export model JSON (XGBoost native format)
if best["algo"] == "XGBoost":
    MODEL_JSON = os.path.join(SCRIPT_DIR, "..", "public", "model", "xgboost-model.json")
    best_model.save_model(MODEL_JSON)
    print(f"XGBoost JSON exported to: {MODEL_JSON}")
else:
    # For LightGBM, also train the best XGBoost as runner-up for browser deployment
    # (browser scorer only supports XGBoost JSON format)
    print(f"\nBest model is LightGBM — also exporting best XGBoost for browser deployment...")
    best_xgb = [r for r in sorted_results if r["algo"] == "XGBoost"][0]
    print(f"  Best XGBoost: AUC={best_xgb['test_auc']:.4f}, Sampling={best_xgb['sampling']}")
    MODEL_JSON = os.path.join(SCRIPT_DIR, "..", "public", "model", "xgboost-model.json")
    best_xgb["model"].save_model(MODEL_JSON)
    print(f"  XGBoost JSON exported to: {MODEL_JSON}")

# Save metadata
META_PATH = os.path.join(SCRIPT_DIR, "..", "public", "model", "model-meta.json")
meta = {
    "features": FEATURES,
    "scaler_columns": CONTINUOUS_COLS,
    "scaler_mean": scaler.mean_.tolist(),
    "scaler_scale": scaler.scale_.tolist(),
    "metrics": metrics,
    "best_algorithm": best["algo"],
    "best_sampling": best["sampling"],
    "valid_asset_types": ASSET_TYPES,
    "valid_decades": DECADES,
    "price_tiers": {k: v["ordinal"] for k, v in PRICE_TIERS.items()},
}
if best["algo"] == "XGBoost":
    meta["n_estimators"] = best["params"].get("n_estimators", 200)
    meta["max_depth"] = best["params"].get("max_depth", 4)
with open(META_PATH, "w") as f:
    json.dump(meta, f, indent=2)
print(f"Metadata saved to: {META_PATH}")

print(f"\n{'=' * 70}")
print("DONE! Model v3 ready.")
print(f"{'=' * 70}")
