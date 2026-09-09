"""Strict application inference for Card Investment Model V4."""
from __future__ import annotations

import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


DEFAULT_BUNDLE = Path(__file__).with_name("card_investment_bundle_v4.joblib")
QUALIFIERS = {"OC", "MC", "MK", "ST", "PD", "OF"}


def _text(value) -> str:
    return "" if value is None or pd.isna(value) else str(value).strip()


def load_bundle(bundle_path=DEFAULT_BUNDLE):
    return joblib.load(bundle_path)


def list_players(bundle=None, bundle_path=DEFAULT_BUNDLE):
    """Return the only players supported by this model."""
    bundle = bundle or load_bundle(bundle_path)
    catalog = bundle["search_catalog"]
    counts = catalog.groupby("player_name", sort=True).agg(
        distinct_cards=("card_uid", "nunique"),
        grade_identities=("grade_uid", "nunique"),
    )
    return [
        {
            "player": str(player),
            "distinct_cards": int(row["distinct_cards"]),
            "grade_identities": int(row["grade_identities"]),
        }
        for player, row in counts.iterrows()
    ]


def list_cards(player: str, bundle=None, bundle_path=DEFAULT_BUNDLE):
    """Populate the card dropdown for one exact supported player."""
    bundle = bundle or load_bundle(bundle_path)
    catalog = bundle["search_catalog"]
    subset = catalog.loc[catalog["player_name"].eq(str(player).strip())].copy()
    if subset.empty:
        return []
    card_columns = [
        "card_uid", "player_name", "card_year", "card_set", "card_number",
        "parallel", "serial", "is_rookie", "is_auto", "title_raw", "img_url",
    ]
    cards = subset[card_columns].drop_duplicates("card_uid").sort_values(
        ["card_year", "card_set", "card_number"], na_position="last"
    )
    grade_counts = subset.groupby("card_uid")["grade_uid"].nunique()
    results = []
    for _, row in cards.iterrows():
        label_parts = [
            str(int(row["card_year"])) if pd.notna(row["card_year"]) else "",
            _text(row["card_set"]),
            f"#{_text(row.get('card_number'))}" if _text(row.get("card_number")) else "",
            _text(row.get("parallel")),
        ]
        results.append({
            "card_uid": row["card_uid"],
            "player": row["player_name"],
            "display_name": " ".join(part for part in label_parts if part),
            "title": row.get("title_raw"),
            "year": None if pd.isna(row["card_year"]) else int(row["card_year"]),
            "set": row.get("card_set"),
            "card_number": row.get("card_number"),
            "parallel": row.get("parallel"),
            "serial": row.get("serial"),
            "image_url": row.get("img_url"),
            "available_grade_identities": int(grade_counts.get(row["card_uid"], 0)),
        })
    return results


def list_card_grades(card_uid: str, bundle=None, bundle_path=DEFAULT_BUNDLE):
    """Populate the grader/grade dropdown for one selected canonical card."""
    bundle = bundle or load_bundle(bundle_path)
    catalog = bundle["search_catalog"]
    subset = catalog.loc[catalog["card_uid"].eq(card_uid)].copy()
    if subset.empty:
        return []
    predictable = set(bundle["latest_features"]["grade_uid"].astype(str))
    subset["grade_numeric_sort"] = pd.to_numeric(subset["grade"], errors="coerce")
    subset = subset.sort_values(["grader", "grade_numeric_sort"], ascending=[True, False])
    results = []
    for _, row in subset.iterrows():
        sales_count = pd.to_numeric(row.get("sales_count"), errors="coerce")
        results.append({
            "grade_uid": row["grade_uid"],
            "grader": row["grader"],
            "grade": row["grade"],
            "display_name": f"{row['grader']} {row['grade']}",
            "historical_sales_count": 0 if pd.isna(sales_count) else int(sales_count),
            "sales_status": row.get("sales_status"),
            "prediction_available": str(row["grade_uid"]) in predictable,
        })
    return results


def search_cards(query: str, limit: int = 10, bundle=None, bundle_path=DEFAULT_BUNDLE):
    """Return ranked clean identities; never silently selects a card."""
    bundle = bundle or load_bundle(bundle_path)
    text = str(query or "").strip()
    if not text:
        return []
    if any(re.search(rf"\b{q}\b", text, re.I) for q in QUALIFIERS):
        return []
    catalog = bundle["search_catalog"]
    vector = bundle["search_vectorizer"].transform([text])
    scores = np.asarray((bundle["search_matrix"] @ vector.T).toarray()).ravel()

    # Structured tokens improve ranking but do not replace user selection.
    year = re.search(r"\b((?:18|19|20)\d{2})\b", text)
    number = re.search(r"#\s*([A-Za-z0-9-]+)", text)
    grader = re.search(r"\b(PSA|BGS|BVG|SGC|CGC|CSG)\b", text, re.I)
    grade = re.search(
        r"\b(?:PSA|BGS|BVG|SGC|CGC|CSG)\s*(\d+(?:\.\d+)?)\b",
        text, re.I,
    )
    if year:
        scores += 0.12 * (catalog["card_year"].fillna("").astype(str).to_numpy() == year.group(1))
    if number:
        values = catalog["card_number"].fillna("").astype(str).str.upper().to_numpy()
        scores += 0.14 * (values == number.group(1).upper())
    if grader:
        scores += 0.12 * (catalog["grader"].fillna("").str.upper().to_numpy() == grader.group(1).upper())
    if grade:
        values = pd.to_numeric(catalog["grade"], errors="coerce").to_numpy()
        scores += 0.16 * np.isclose(values, float(grade.group(1)), equal_nan=False)

    order = np.argsort(-scores)[: max(1, int(limit))]
    results = []
    for idx in order:
        row = catalog.iloc[int(idx)]
        sales_count = pd.to_numeric(row.get("sales_count"), errors="coerce")
        results.append({
            "grade_uid": row["grade_uid"],
            "card_uid": row["card_uid"],
            "display_name": row["search_text"],
            "player": row["player_name"],
            "year": row["card_year"],
            "set": row["card_set"],
            "card_number": row["card_number"],
            "parallel": row["parallel"],
            "grader": row["grader"],
            "grade": row["grade"],
            "historical_sales_count": 0 if pd.isna(sales_count) else int(sales_count),
            "sales_status": row.get("sales_status"),
            "score": round(float(scores[int(idx)]), 4),
        })
    return results


def _confidence(row) -> str:
    history = float(row.get("history_sale_count", 0) or 0)
    active_13 = float(row.get("active_weeks_13w", 0) or 0)
    stale = float(row.get("weeks_since_last_sale", 999) or 999)
    if history >= 50 and active_13 >= 4 and stale <= 4:
        return "HIGH"
    if history >= 10 and stale <= 13:
        return "MEDIUM"
    return "LOW"


def predict_card_grade(
    grade_uid: str,
    purchase_amount: float | None = None,
    bundle=None,
    bundle_path=DEFAULT_BUNDLE,
):
    """Forecast one exact selected identity. No fuzzy fallback is permitted."""
    bundle = bundle or load_bundle(bundle_path)
    catalog = bundle["search_catalog"]
    identity = catalog.loc[catalog["grade_uid"] == grade_uid]
    if identity.empty:
        return {"status": "NOT_FOUND", "grade_uid": grade_uid}
    identity = identity.iloc[0]
    if str(identity.get("qualifier") or "").strip():
        return {"status": "REJECTED_QUALIFIER", "grade_uid": grade_uid}

    latest = bundle["latest_features"]
    selected = latest.loc[latest["grade_uid"] == grade_uid]
    if selected.empty:
        return {
            "status": "INSUFFICIENT_DATA",
            "grade_uid": grade_uid,
            "matched_card": identity["search_text"],
            "message": "The clean catalog identity exists but has no usable exact sales history.",
        }
    row = selected.iloc[[0]].copy()
    features = row[bundle["features"]]
    encoded = bundle["preprocessor"].transform(features)
    xgb_residual = float(bundle["xgb_regressor"].predict(encoded)[0])
    cat_residual = float(bundle["cat_regressor"].predict(features)[0])
    model_residual = (
        bundle["xgb_weight"] * xgb_residual
        + (1 - bundle["xgb_weight"]) * cat_residual
    )
    base_log = row["median_log_price_13w"].iloc[0]
    if pd.isna(base_log):
        base_log = row["last_log_price"].iloc[0]
    predicted_log = float(base_log + bundle["residual_shrinkage"] * model_residual)
    predicted = max(0.0, float(np.expm1(predicted_log)))
    low_residual, high_residual = bundle["residual_log_interval"]
    low = max(0.0, float(np.expm1(predicted_log + low_residual)))
    high = max(0.0, float(np.expm1(predicted_log + high_residual)))

    current_log = row["median_log_price_4w"].iloc[0]
    if pd.isna(current_log):
        current_log = base_log
    current_value = max(0.0, float(np.expm1(current_log)))
    result = {
        "status": "OK",
        "model_version": bundle["version"],
        "grade_uid": grade_uid,
        "matched_card": identity["search_text"],
        "player": identity["player_name"],
        "forecast_week": str(pd.Timestamp(bundle["forecast_week"]).date()),
        "current_valuation": round(current_value, 2),
        "predicted_next_week_valuation": round(predicted, 2),
        "prediction_90pct_range": [round(low, 2), round(high, 2)],
        "expected_change_pct": round((predicted / current_value - 1) * 100, 2) if current_value else None,
        "historical_sales_used": int(row["history_sale_count"].iloc[0]),
        "active_sales_weeks_last_13": int(row["active_weeks_13w"].iloc[0]),
        "weeks_since_last_sale": round(float(row["weeks_since_last_sale"].iloc[0]), 1),
        "data_confidence": _confidence(row.iloc[0]),
        "qualifiers_excluded": True,
    }

    if purchase_amount is not None:
        purchase_amount = float(purchase_amount)
        if purchase_amount <= 0:
            raise ValueError("purchase_amount must be positive")
        cost = float(bundle["transaction_cost_rate"])
        hurdle = float(bundle["required_annual_return"])
        days = int(bundle["forecast_days"])
        required_exit = purchase_amount * (1 + hurdle) ** (days / 365) / (1 - cost)
        buy_features = row.copy()
        base_13w_value = max(0.0, float(np.expm1(base_log)))
        last_sale_value = max(0.0, float(row["last_sale_price"].iloc[0]))
        buy_features["purchase_log_price"] = np.log1p(purchase_amount)
        buy_features["purchase_to_last_log_ratio"] = (
            np.log1p(purchase_amount) - np.log1p(last_sale_value)
        )
        buy_features["purchase_to_13w_log_ratio"] = (
            np.log1p(purchase_amount) - np.log1p(base_13w_value)
        )
        buy_probability = float(
            bundle["buy_classifier"].predict_proba(buy_features[bundle["buy_features"]])[0, 1]
        )
        maximum_buy = predicted * (1 - cost) / ((1 + hurdle) ** (days / 365))
        thresholds = bundle["selective_thresholds"]
        if buy_probability >= thresholds["high"]:
            action = "BUY"
        elif buy_probability <= thresholds["low"]:
            action = "DO NOT BUY"
        else:
            action = "REVIEW"
        if result["data_confidence"] == "LOW":
            action = "REVIEW"
        if purchase_amount > maximum_buy:
            action = "DO NOT BUY"
        result.update({
            "purchase_amount": round(purchase_amount, 2),
            "buy_probability": round(float(buy_probability), 4),
            "maximum_recommended_purchase_price": round(maximum_buy, 2),
            "recommendation": action,
        })
    return result


def predict_from_query(query: str, purchase_amount: float | None = None, limit: int = 10, bundle_path=DEFAULT_BUNDLE):
    """Search-first contract: return candidates and require exact user selection."""
    bundle = load_bundle(bundle_path)
    return {
        "status": "SELECT_EXACT_CARD",
        "query": query,
        "candidates": search_cards(query, limit=limit, bundle=bundle),
        "next_step": "Call predict_card_grade with the selected grade_uid.",
    }
