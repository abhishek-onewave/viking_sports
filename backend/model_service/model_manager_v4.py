"""
model_manager_v4.py — single load of the v4 bundle, per worker.

V4 is a different contract from v3. Where v3 fuzzy-matches a free-text card
title, v4 predicts ONE exact card-grade identity (`grade_uid`) chosen by the
user from a catalog of predictable identities. The supplied
`card_investment_inference_v4.predict_card_grade()` already accepts a
pre-loaded `bundle=` argument, so no joblib shim is needed here: the bundle is
loaded once at startup and passed on every call.

Besides prediction, this manager precomputes the Card Analyzer's dropdown data
once at load time — supported players, their predictable years, and every
qualifier-free exact identity with a prediction available — because the
catalog is static for the lifetime of a bundle and re-deriving it per request
would re-sort thousands of rows for nothing.

HARD RULES ENFORCED HERE
------------------------
  * only identities present in the bundle's `latest_features` (i.e. with a real
    prediction available) are ever offered to the UI
  * qualifier identities (OC, MC, MK, ST, PD, OF) are never offered
  * prediction uses the exact selected grade_uid — there is no fuzzy fallback,
    and a near-miss uid is NOT_FOUND rather than "the closest card"
  * the only supported holding period is seven days; anything else is refused
    rather than annualized into a fabricated longer-horizon forecast
"""
from __future__ import annotations

import logging
import os
import re
import sys
import threading
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any

log = logging.getLogger("model_service.manager_v4")

SERVICE_DIR = Path(__file__).resolve().parent
MODEL_V4_DIR = SERVICE_DIR / "model_v4"

# Server-side path ONLY — never accepted from a request (see model_manager.py).
BUNDLE_V4_PATH = Path(os.environ.get(
    "MODEL_V4_BUNDLE_PATH", MODEL_V4_DIR / "card_investment_bundle_v4.joblib"))
EXPECTED_VERSION = "4.0"

SUPPORTED_HOLDING_PERIOD_DAYS = 7
HOLDING_PERIOD_MESSAGE = (
    "This model is currently validated only for seven-day forecasts. "
    "Longer-horizon models are under development.")

REQUIRED_KEYS = (
    "version", "preprocessor", "xgb_regressor", "cat_regressor",
    "buy_classifier", "features", "buy_features", "latest_features",
    "search_catalog", "residual_log_interval", "selective_thresholds",
    "transaction_cost_rate", "required_annual_return", "forecast_days",
    "forecast_week", "metadata",
)


def _natural_number_key(value: str):
    """Natural sort key for card numbers like '57', 'T-100', '4A'."""
    parts = re.split(r"(\d+)", str(value or ""))
    return tuple(
        (0, int(part)) if part.isdigit() else (1, part.lower())
        for part in parts if part != "")


class ModelManagerV4:
    """Loads the v4 bundle once and exposes catalog + prediction + health."""

    def __init__(self, bundle_path: Path = BUNDLE_V4_PATH):
        self.bundle_path = Path(bundle_path)
        self._bundle: Any = None
        self._predict_fn = None
        self._lock = threading.Lock()
        self._load_count = 0          # asserted by a test: must stay at 1
        self._load_error: str | None = None
        # Precomputed once per load:
        self._records: list[dict] = []
        self._player_years: dict[str, list[int]] = {}
        self._players: list[dict] = []

    # ------------------------------------------------------------------ load
    def load(self) -> None:
        """Called once at startup. Idempotent and thread-safe."""
        with self._lock:
            if self._bundle is not None:
                return
            try:
                if not self.bundle_path.exists():
                    raise FileNotFoundError(f"bundle not found: {self.bundle_path}")

                model_dir = str(MODEL_V4_DIR)
                if model_dir not in sys.path:
                    sys.path.insert(0, model_dir)
                # The SUPPLIED module, unmodified. Its predict takes bundle=.
                import card_investment_inference_v4 as inference

                import joblib
                t0 = time.time()
                self._bundle = joblib.load(self.bundle_path)
                self._load_count += 1
                self._predict_fn = inference.predict_card_grade
                self._build_catalog()
                self._load_error = None
                log.info("v4 bundle loaded in %.2fs from %s (load #%d, %d "
                         "predictable identities)", time.time() - t0,
                         self.bundle_path, self._load_count, len(self._records))
            except Exception as e:                       # noqa: BLE001
                self._bundle = None
                self._load_error = f"{type(e).__name__}: {e}"
                log.exception("v4 bundle failed to load")
                raise

    def _build_catalog(self) -> None:
        """Precompute the predictable, qualifier-free exact identities once."""
        import pandas as pd

        catalog = self._bundle["search_catalog"]
        predictable = set(self._bundle["latest_features"]["grade_uid"].astype(str))

        def text(value) -> str:
            if value is None:
                return ""
            try:
                if pd.isna(value):
                    return ""
            except (TypeError, ValueError):
                pass
            return str(value).strip()

        records = []
        for row in catalog.to_dict("records"):
            grade_uid = str(row["grade_uid"])
            if text(row.get("qualifier")):          # qualifier identities: never offered
                continue
            if grade_uid not in predictable:        # no prediction: never offered
                continue
            year_text = text(row.get("card_year"))
            year = int(year_text) if year_text.isdigit() else None
            card_set = text(row.get("card_set"))
            card_number = text(row.get("card_number"))
            parallel = text(row.get("parallel")) or "Base"
            grader = text(row.get("grader"))
            grade = text(row.get("grade"))
            grade_numeric = pd.to_numeric(row.get("grade_numeric"), errors="coerce")
            grade_numeric = float(grade_numeric) if pd.notna(grade_numeric) else float("inf")
            sales_count = pd.to_numeric(row.get("sales_count"), errors="coerce")
            display_name = " — ".join(part for part in [
                year_text or "?",
                card_set or "?",
                f"#{card_number}" if card_number else "#?",
                parallel,
                f"{grader} {grade}".strip(),
            ])
            records.append({
                "grade_uid": grade_uid,
                "card_uid": str(row["card_uid"]),
                "player": text(row.get("player_name")),
                "year": year,
                "set": card_set,
                "card_number": card_number,
                "parallel": parallel,
                "grader": grader,
                "grade": grade,
                "display_name": display_name,
                "historical_sales_count": 0 if pd.isna(sales_count) else int(sales_count),
                "prediction_available": True,
                "_sort": (
                    year if year is not None else 9999,
                    card_set.lower(),
                    _natural_number_key(card_number),
                    parallel.lower(),
                    grader.lower(),
                    grade_numeric,
                ),
            })

        records.sort(key=lambda r: r["_sort"])
        for record in records:
            record.pop("_sort")
        self._records = records

        years: dict[str, set[int]] = {}
        counts: dict[str, int] = {}
        for record in records:
            counts[record["player"]] = counts.get(record["player"], 0) + 1
            if record["year"] is not None:
                years.setdefault(record["player"], set()).add(record["year"])
        self._player_years = {p: sorted(v) for p, v in years.items()}
        self._players = [
            {"player": p, "predictable_grade_identities": counts[p]}
            for p in sorted(counts)]

    # --------------------------------------------------------------- catalog
    @property
    def loaded(self) -> bool:
        return self._bundle is not None and self._predict_fn is not None

    @property
    def load_count(self) -> int:
        return self._load_count

    def players(self) -> list[dict]:
        return self._players

    def has_player(self, player: str) -> bool:
        return player in self._player_years

    def years(self, player: str) -> list[int]:
        return self._player_years.get(player, [])

    def cards(self, player: str, year: int | None = None) -> list[dict]:
        return [
            r for r in self._records
            if r["player"] == player and (year is None or r["year"] == year)]

    # --------------------------------------------------------------- predict
    def predict(self, *, grade_uid: str, purchase_amount: float | None) -> dict:
        """Delegate to the supplied predict_card_grade with the EXACT uid."""
        if self._predict_fn is None:
            self.load()
        return self._predict_fn(
            grade_uid=grade_uid,
            purchase_amount=purchase_amount,
            bundle=self._bundle,
        )

    # -------------------------------------------------------------- metadata
    def model_version(self) -> str:
        if self._bundle is None:
            return "unknown"
        return str(self._bundle.get("version") or "unknown")

    def forecast_week(self) -> date | None:
        if self._bundle is None:
            return None
        import pandas as pd
        return pd.Timestamp(self._bundle["forecast_week"]).date()

    def metadata_info(self) -> dict:
        """Non-secret model facts for the analyzer's info panels."""
        meta = self._bundle["metadata"]
        week = self.forecast_week()
        week_end = week + timedelta(days=6)
        today = date.today()
        buy = meta.get("test_buy_metrics", {})
        return {
            "model_version": self.model_version(),
            "created_utc": meta.get("created_utc"),
            "latest_sale_date": meta.get("audit", {}).get("latest_sale"),
            "forecast_week": str(week),
            "forecast_week_end": str(week_end),
            "current_date": str(today),
            "is_stale": today > week_end,
            "stale_message": (
                "The model snapshot is past its supported forecast week and "
                "should be retrained before making current investment decisions."),
            "supported_players": [p["player"] for p in self._players],
            "holding_periods": [
                {"days": 7, "label": "7 Days", "supported": True,
                 "note": "Currently supported"},
                {"days": 182, "label": "6 Months", "supported": False,
                 "note": HOLDING_PERIOD_MESSAGE},
                {"days": 365, "label": "1 Year", "supported": False,
                 "note": HOLDING_PERIOD_MESSAGE},
                {"days": 1095, "label": "3 Years", "supported": False,
                 "note": HOLDING_PERIOD_MESSAGE},
                {"days": 1825, "label": "5 Years", "supported": False,
                 "note": HOLDING_PERIOD_MESSAGE},
            ],
            "assumptions": {
                "forecast_horizon_days": int(self._bundle["forecast_days"]),
                "required_annual_return": float(self._bundle["required_annual_return"]),
                "transaction_cost_rate": float(self._bundle["transaction_cost_rate"]),
                "hurdle_after_transaction_costs": True,
                "note": ("This is currently an asset-level underwriting hurdle, "
                         "not the Fund's 20%+ net return objective."),
            },
            # BUY-decision metrics on the final chronological holdout. The
            # selective (high-confidence) figures apply ONLY to that small
            # automatic subset — they are not whole-model accuracy.
            "performance": {
                "buy_accuracy": buy.get("accuracy"),
                "buy_precision": buy.get("precision"),
                "buy_recall": buy.get("recall"),
                "buy_f1": buy.get("f1"),
                "buy_roc_auc": buy.get("roc_auc"),
                "high_confidence_accuracy": buy.get("selective_accuracy"),
                "high_confidence_coverage": buy.get("selective_coverage"),
            },
        }

    # ---------------------------------------------------------------- health
    def missing_components(self) -> list[str]:
        if self._bundle is None:
            return list(REQUIRED_KEYS)
        return [k for k in REQUIRED_KEYS if k not in self._bundle]

    def health(self) -> dict:
        missing = self.missing_components()
        version = self.model_version()
        checks = {
            "bundle_exists": self.bundle_path.exists(),
            "bundle_loaded": self.loaded,
            "version_is_4_0": version == EXPECTED_VERSION,
            "required_components_present": not missing,
            "catalog_built": bool(self._records),
        }
        healthy = all(checks.values())
        out = {
            "status": "healthy" if healthy else "unhealthy",
            "model_version": version,
            "model_loaded": self.loaded,
            "forecast_week": str(self.forecast_week()) if self.loaded else None,
        }
        if not healthy:
            out["checks"] = checks
            if missing:
                out["missing_components"] = missing
            if self._load_error:
                out["load_error"] = self._load_error
        return out


# One instance per worker process, mirroring the v3 manager.
manager_v4 = ModelManagerV4()
