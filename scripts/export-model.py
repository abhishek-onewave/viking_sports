"""
Export the Viking Sports XGBoost model from .pkl to JSON for browser inference.
Usage: python3 scripts/export-model.py
"""
import pickle
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PKL_PATH = os.path.join(SCRIPT_DIR, "viking_sl_xgb_model.pkl")
OUT_DIR = os.path.join(SCRIPT_DIR, "..", "public", "model")
OUT_PATH = os.path.join(OUT_DIR, "xgboost-model.json")

os.makedirs(OUT_DIR, exist_ok=True)

print("Loading model bundle from .pkl ...")
with open(PKL_PATH, "rb") as f:
    bundle = pickle.load(f)

model = bundle["model"]
features = bundle["features"]
metrics = bundle["metrics"]

print(f"  Features: {features}")
print(f"  Metrics:  {metrics}")
print(f"  Trees:    {model.n_estimators}")

# Export model to XGBoost native JSON
model.save_model(OUT_PATH)
print(f"\nModel exported to {OUT_PATH}")

# Also save metadata sidecar
meta = {
    "features": features,
    "metrics": metrics,
    "n_estimators": model.n_estimators,
    "max_depth": model.max_depth,
    "valid_asset_types": [
        "Rookie Cards", "Cards (Non-Rookie)", "Publications", "Memorabilia",
        "Game-Worn Jerseys", "Game-Worn Shoes", "Game-Used Equipment",
        "Autographs", "Tickets & Passes", "Complete Sets",
        "Coins & Currency", "Stickers", "Sealed Wax"
    ],
    "valid_decades": ["1980s", "1990s", "2000s", "2010s", "2020s"]
}

meta_path = os.path.join(OUT_DIR, "model-meta.json")
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=2)

print(f"Metadata saved to {meta_path}")
print("Done!")
