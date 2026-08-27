"""
model_manager.py — single load of the v3 bundle, per worker.

THE PROBLEM THIS SOLVES
-----------------------
The supplied `predict_card()` ends its own signature with `bundle_path` and calls
`joblib.load(bundle_path)` on EVERY invocation. The bundle is 9.5 MB of XGBoost
and CatBoost boosters; reloading it per request would add roughly a second of CPU
and a full deserialize to every prediction, and would make concurrency actively
harmful.

HOW IT IS FIXED WITHOUT TOUCHING THE MATHS
------------------------------------------
The brief is explicit: refactor only the loading behaviour, leave trained models,
features, thresholds and prediction calculations alone. So we do NOT copy or
re-implement `predict_card`. Instead we replace the `joblib` reference *inside
that one module's namespace* with a memoizing shim:

    inference.joblib = _JoblibShim()      # only this module sees it

`predict_card` still runs byte-for-byte identically — same feature row, same
preprocessor, same thresholds, same guardrail — but its `joblib.load(...)` call
returns the already-deserialized object. Nothing about the prediction path is
re-implemented here, so it cannot drift from the supplied file.

The alternative (fork the function to accept a bundle) duplicates ~60 lines of
scoring logic, and a future bundle revision would then need the fork updated in
lockstep. That is precisely the kind of silent divergence that produces
confidently wrong numbers.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import threading
import time
from pathlib import Path
from typing import Any

log = logging.getLogger("model_service.manager")

SERVICE_DIR = Path(__file__).resolve().parent
MODEL_DIR = SERVICE_DIR / "model"

# Server-side path ONLY. Never accepted from a request — a client-supplied path
# would be an arbitrary-file-read and a deserialization sink.
BUNDLE_PATH = Path(os.environ.get("MODEL_BUNDLE_PATH",
                                  MODEL_DIR / "card_investment_bundle_v3.joblib"))
METADATA_PATH = Path(os.environ.get("MODEL_METADATA_PATH",
                                    MODEL_DIR / "model_metadata_v3.json"))
EXPECTED_VERSION = "3.0"

# Components the health check must find before declaring the service healthy.
REQUIRED_KEYS = (
    "classifier", "classifier_preprocessor", "xgb_regressor", "cat_regressor",
    "thresholds", "features", "categorical_features", "numeric_features",
    "current_catalog", "match_vectorizer", "match_matrix", "current_as_of",
    "transaction_cost_rate", "required_annual_return", "residual_log_interval",
    "regression_xgb_weight",
)


class _JoblibShim:
    """Stands in for the `joblib` module inside the inference module only.

    Scoped deliberately: we rebind `inference.joblib`, not `sys.modules['joblib']`,
    so nothing else in the process is affected.
    """

    def __init__(self, loader):
        self._loader = loader

    def load(self, path, *a, **kw):        # signature-compatible with joblib.load
        return self._loader(path)

    def __getattr__(self, name):           # anything else falls through
        import joblib
        return getattr(joblib, name)


class ModelManager:
    """Loads the bundle once and exposes prediction + health."""

    def __init__(self, bundle_path: Path = BUNDLE_PATH,
                 metadata_path: Path = METADATA_PATH):
        self.bundle_path = Path(bundle_path)
        self.metadata_path = Path(metadata_path)
        self._bundle: Any = None
        self._metadata: dict = {}
        self._predict_fn = None
        self._lock = threading.Lock()
        self._load_count = 0          # asserted by a test: must stay at 1
        self._loaded_at: float | None = None
        self._load_error: str | None = None

    # ------------------------------------------------------------------ load
    def _real_load(self, _path_ignored=None):
        """The memoized loader handed to the shim."""
        if self._bundle is None:
            import joblib
            t0 = time.time()
            self._bundle = joblib.load(self.bundle_path)
            self._load_count += 1
            self._loaded_at = time.time()
            log.info("bundle loaded in %.2fs from %s (load #%d)",
                     time.time() - t0, self.bundle_path, self._load_count)
        return self._bundle

    def load(self) -> None:
        """Called once at startup. Idempotent and thread-safe."""
        with self._lock:
            if self._predict_fn is not None:
                return
            try:
                if not self.bundle_path.exists():
                    raise FileNotFoundError(f"bundle not found: {self.bundle_path}")

                # Import the SUPPLIED module unmodified.
                model_dir = str(MODEL_DIR)
                if model_dir not in sys.path:
                    sys.path.insert(0, model_dir)
                import card_investment_inference_v3 as inference

                # Redirect only this module's joblib.load to the memoized loader.
                inference.joblib = _JoblibShim(self._real_load)
                self._predict_fn = inference.predict_card

                self._real_load()          # eager: fail at boot, not on request 1

                if self.metadata_path.exists():
                    self._metadata = json.loads(self.metadata_path.read_text())
                self._load_error = None
            except Exception as e:                       # noqa: BLE001
                self._load_error = f"{type(e).__name__}: {e}"
                log.exception("bundle failed to load")
                raise

    # --------------------------------------------------------------- predict
    def predict(self, *, asset_type: str, card_name: str, hold_period: str,
                purchase_amount: float, acquisition_year: int,
                deal_status: str) -> dict:
        """Delegate to the supplied predict_card. No maths happens here."""
        if self._predict_fn is None:
            self.load()
        # bundle_path is still passed for signature compatibility; the shim
        # ignores it and returns the cached bundle.
        return self._predict_fn(
            asset_type=asset_type,
            card_name=card_name,
            hold_period=hold_period,
            purchase_amount=purchase_amount,
            acquisition_year=acquisition_year,
            deal_status=deal_status,
            bundle_path=self.bundle_path,
        )

    # ---------------------------------------------------------------- health
    @property
    def loaded(self) -> bool:
        return self._bundle is not None and self._predict_fn is not None

    @property
    def load_count(self) -> int:
        return self._load_count

    def model_version(self) -> str:
        return str(self._metadata.get("version") or "unknown")

    def market_data_as_of(self) -> str | None:
        if self._bundle is None:
            return None
        try:
            import pandas as pd
            return str(pd.Timestamp(self._bundle["current_as_of"]).date())
        except Exception:                                # noqa: BLE001
            return None

    def missing_components(self) -> list[str]:
        if self._bundle is None:
            return list(REQUIRED_KEYS)
        return [k for k in REQUIRED_KEYS if k not in self._bundle]

    def health(self) -> dict:
        """Every condition the brief requires the health check to confirm."""
        missing = self.missing_components()
        as_of = self.market_data_as_of()
        version = self.model_version()
        checks = {
            "bundle_exists": self.bundle_path.exists(),
            "bundle_loaded": self.loaded,
            "version_is_3_0": version == EXPECTED_VERSION,
            "required_components_present": not missing,
            "market_data_available": bool(as_of),
        }
        healthy = all(checks.values())
        out = {
            "status": "healthy" if healthy else "unhealthy",
            "model_version": version,
            "model_loaded": self.loaded,
            "market_data_as_of": as_of,
        }
        # Diagnostics only when something is wrong — a healthy response stays
        # exactly the shape the brief specifies.
        if not healthy:
            out["checks"] = checks
            if missing:
                out["missing_components"] = missing
            if self._load_error:
                out["load_error"] = self._load_error
        return out

    def thresholds(self) -> dict:
        if self._bundle is None:
            return {}
        return {k: float(v) for k, v in self._bundle["thresholds"].items()}


# One instance per worker process. Uvicorn/Gunicorn workers each get their own,
# which is what the brief asks for: one loaded model per worker.
manager = ModelManager()
