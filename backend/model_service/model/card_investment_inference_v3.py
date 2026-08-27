# Standalone inference for Card Investment Model v3.
from __future__ import annotations

import re
from pathlib import Path
import joblib
import numpy as np
import pandas as pd

DEFAULT_BUNDLE = Path(__file__).with_name("card_investment_bundle_v3.joblib")


def _hold_months(value):
    if isinstance(value, str):
        number = float(re.search(r"[0-9.]+", value).group())
        months = number if "month" in value.lower() else number * 12
    else:
        number = float(value)
        months = number * 12 if number <= 5 else number
    return min([6, 12, 24, 36, 60], key=lambda x: abs(x - months))


def _match_card(bundle, card_name, asset_type=None):
    catalog = bundle["current_catalog"]
    query = bundle["match_vectorizer"].transform([str(card_name)])
    scores = np.asarray((bundle["match_matrix"] @ query.T).toarray()).ravel()
    text = str(card_name)
    year_match = re.search(r"\b((?:18|19|20)\d{2})\b", text)
    grader_match = re.search(r"\b(PSA|BGS|SGC|CGC|CSG|BVG)\b", text, re.I)
    grade_match = re.search(
        r"\b(?:PSA|BGS|SGC|CGC|CSG|BVG)\s*(?:GEM(?:\s+MINT)?\s*)?([0-9]+(?:\.[0-9]+)?)\b",
        text,
        re.I,
    )
    card_number_match = re.search(r"#\s*([A-Za-z0-9-]+)", text)
    strict = np.ones(len(catalog), dtype=bool)
    if year_match:
        same_year = pd.to_numeric(catalog.card_year, errors="coerce").fillna(-1).to_numpy() == int(year_match.group(1))
        scores += 0.12 * same_year
        strict &= same_year
    if grader_match:
        same_grader = catalog.grader.fillna("").str.upper().to_numpy() == grader_match.group(1).upper()
        scores += 0.12 * same_grader
        strict &= same_grader
    if grade_match:
        same_grade = np.isclose(
            pd.to_numeric(catalog.numeric_grade, errors="coerce").fillna(-999).to_numpy(),
            float(grade_match.group(1)),
        )
        scores += 0.20 * same_grade
        strict &= same_grade
    if card_number_match:
        normalized_numbers = catalog.card_number.fillna("").astype(str).str.replace(r"\.0$", "", regex=True).str.upper().to_numpy()
        same_number = normalized_numbers == card_number_match.group(1).upper()
        scores += 0.10 * same_number
        strict &= same_number
    if asset_type:
        scores += 0.04 * (catalog.asset_type.fillna("").str.lower().to_numpy() == str(asset_type).lower())
    if strict.any():
        scores[~strict] = -np.inf
    index = int(np.argmax(scores))
    return catalog.iloc[index], float(scores[index])


def _feature_row(bundle, match, hold_months, purchase_amount, acquisition_year):
    cost = bundle["transaction_cost_rate"]
    required_return = bundle["required_annual_return"]
    required_exit = purchase_amount * (1 + required_return) ** (hold_months / 12) / (1 - cost)
    med90 = match.get("median_price_90d", np.nan)
    med365 = match.get("median_price_365d", np.nan)
    row = {
        "identity_id": match.get("identity_id", "(missing)"),
        "player_or_subject": match.get("player_or_subject", "(missing)"),
        "set_name": match.get("set_name", "(missing)"),
        "card_number": match.get("card_number", "(missing)"),
        "parallel_or_variant": match.get("parallel_or_variant", "(missing)"),
        "grader": match.get("grader", "(missing)"),
        "qualifier": match.get("qualifier", "(missing)"),
        "sport_or_category": match.get("sport_or_category", "Other"),
        "asset_type": match.get("asset_type", "Cards (Non-Rookie)"),
        "purchase_price": purchase_amount,
        "log_purchase_price": np.log1p(purchase_amount),
        "target_holding_months": hold_months,
        "acquisition_year": acquisition_year,
        "target_exit_year": acquisition_year + hold_months / 12,
        "card_year": match.get("card_year", np.nan),
        "card_age_at_purchase": acquisition_year - match.get("card_year", acquisition_year) if pd.notna(match.get("card_year", np.nan)) else np.nan,
        "numeric_grade": match.get("numeric_grade", np.nan),
        "rookie_indicator": match.get("rookie_indicator", 0),
        "autograph_indicator": match.get("autograph_indicator", 0),
        "memorabilia_indicator": match.get("memorabilia_indicator", 0),
        "log_serial_denominator": np.log1p(match.get("serial_number_denominator", np.nan)),
        "identity_match_confidence": match.get("identity_match_confidence", 0.0),
        "prev_sale_price": match.get("prev_sale_price", np.nan),
        "log_prev_sale_price": np.log1p(match.get("prev_sale_price", np.nan)),
        "days_since_prev_sale": match.get("days_since_prev_sale", np.nan),
        "n_prior_sales": match.get("n_prior_sales", 0),
        "median_price_30d": match.get("median_price_30d", np.nan),
        "median_price_90d": med90,
        "median_price_365d": med365,
        "log_median_price_30d": np.log1p(match.get("median_price_30d", np.nan)),
        "log_median_price_90d": np.log1p(med90),
        "log_median_price_365d": np.log1p(med365),
        "sale_count_30d": match.get("sale_count_30d", 0),
        "sale_count_90d": match.get("sale_count_90d", 0),
        "sale_count_365d": match.get("sale_count_365d", 0),
        "price_volatility_365d": match.get("price_volatility_365d", np.nan),
        "price_trend_90_365": match.get("price_trend_90_365", np.nan),
        "price_to_median_90d_rebuilt": purchase_amount / med90 if pd.notna(med90) and med90 > 0 else np.nan,
        "price_to_median_365d_rebuilt": purchase_amount / med365 if pd.notna(med365) and med365 > 0 else np.nan,
        "liquidity_score": match.get("liquidity_score", 0),
        "required_exit_value_target": required_exit,
        "log_required_exit_value_target": np.log1p(required_exit),
    }
    frame = pd.DataFrame([row])
    for column in bundle["categorical_features"]:
        frame[column] = frame[column].fillna("(missing)").astype(str)
    for column in bundle["numeric_features"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce").replace([np.inf, -np.inf], np.nan)
    return frame[bundle["features"]]


def predict_card(asset_type, card_name, hold_period, purchase_amount, acquisition_year,
                 deal_status="unreleased", bundle_path=DEFAULT_BUNDLE):
    bundle = joblib.load(bundle_path)
    purchase_amount = float(purchase_amount)
    if purchase_amount <= 0:
        raise ValueError("purchase_amount must be positive")
    hold_months = _hold_months(hold_period)
    match, match_score = _match_card(bundle, card_name, asset_type)
    features = _feature_row(bundle, match, hold_months, purchase_amount, int(acquisition_year))
    encoded = bundle["classifier_preprocessor"].transform(features)
    buy_probability = float(bundle["classifier"].predict_proba(encoded)[0, 1])

    xgb_log = float(bundle["xgb_regressor"].predict(encoded)[0])
    cat_log = float(bundle["cat_regressor"].predict(features)[0])
    weight = bundle["regression_xgb_weight"]
    predicted_log = weight * xgb_log + (1 - weight) * cat_log
    predicted_future = max(0.0, float(np.expm1(predicted_log)))
    low_residual, high_residual = bundle["residual_log_interval"]
    future_low = max(0.0, float(np.expm1(predicted_log + low_residual)))
    future_high = max(0.0, float(np.expm1(predicted_log + high_residual)))
    max_buy = predicted_future * (1 - bundle["transaction_cost_rate"]) / (1 + bundle["required_annual_return"]) ** (hold_months / 12)

    thresholds = bundle["thresholds"]
    provisional = "BUY" if buy_probability >= thresholds["accuracy"] else "DO NOT BUY"
    if buy_probability >= thresholds["selective_high"]:
        confidence_action = "BUY"
    elif buy_probability <= thresholds["selective_low"]:
        confidence_action = "DO NOT BUY"
    else:
        confidence_action = "REVIEW"
    final_with_price_guardrail = (
        "DO NOT BUY" if purchase_amount > max_buy
        else confidence_action if confidence_action != "REVIEW"
        else "REVIEW"
    )

    return {
        "matched_card": match.get("sale_title_original"),
        "match_score": round(match_score, 4),
        "identity_id": match.get("identity_id"),
        "market_data_as_of": str(pd.Timestamp(bundle["current_as_of"]).date()),
        "current_valuation": round(float(match.get("current_value", np.nan)), 2),
        "current_valuation_range": [round(float(match.get("current_low", np.nan)), 2), round(float(match.get("current_high", np.nan)), 2)],
        "current_valuation_method": match.get("current_value_method"),
        "hold_period_months": hold_months,
        "buy_probability": round(buy_probability, 4),
        "full_coverage_recommendation": provisional,
        "high_confidence_action": confidence_action,
        "final_recommendation_with_price_guardrail": final_with_price_guardrail,
        "predicted_future_sale_value": round(predicted_future, 2),
        "future_value_90pct_range": [round(future_low, 2), round(future_high, 2)],
        "maximum_recommended_purchase_price": round(max_buy, 2),
        "entered_purchase_amount": round(purchase_amount, 2),
        "deal_status": deal_status,
        "notes": [
            "REVIEW is mandatory when probability falls between the selective cutoffs.",
            "Deal status is recorded but is not a trained feature because training outcomes are completed sales.",
            "A current comparable match is not proof that every title attribute was parsed perfectly.",
        ],
    }
