"""
tests/test_model_api.py — the ten backend cases the brief requires.

Run:
    cd backend && .venv/bin/python -m pytest model_service/tests -v

These hit the REAL bundle. Mocking it would prove the wiring and nothing about
the contract that actually matters — that a PSA 10 does not match a PSA 5, and
that a price above the maximum can never surface as BUY.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVICE_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = SERVICE_DIR.parent
for p in (str(BACKEND_DIR), str(SERVICE_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from model_service.app import API_PREFIX, app          # noqa: E402
from model_service.model_manager import manager        # noqa: E402

JORDAN = "1986 Fleer Michael Jordan #57 PSA 10 Rookie Card"

VALID = {
    "asset_type": "Cards (Non-Rookie)",
    "card_name": JORDAN,
    "hold_period": "2 years",
    "purchase_amount": 150000,
    "acquisition_year": 2026,
    "deal_status": "unreleased",
}

REQUIRED_FIELDS = [
    "matched_card", "identity_id", "market_data_as_of", "current_valuation",
    "current_valuation_range", "current_valuation_method", "hold_period_months",
    "buy_probability", "full_coverage_recommendation", "high_confidence_action",
    "final_recommendation_with_price_guardrail", "predicted_future_sale_value",
    "future_value_90pct_range", "maximum_recommended_purchase_price",
    "entered_purchase_amount", "deal_status", "notes",
]


@pytest.fixture(scope="session")
def client():
    # `with` triggers lifespan, which is where the single load happens.
    with TestClient(app) as c:
        yield c


# 1 ---------------------------------------------------------------- health
def test_health_endpoint(client):
    r = client.get(f"{API_PREFIX}/health")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "healthy"
    assert body["model_version"] == "3.0"
    assert body["model_loaded"] is True
    assert body["market_data_as_of"]           # e.g. "2026-08-25"
    # the brief's four health conditions
    assert manager.bundle_path.exists()
    assert not manager.missing_components()


# 2 ------------------------------------------------------- successful predict
def test_successful_prediction(client):
    r = client.post(f"{API_PREFIX}/predict", json=VALID)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["hold_period_months"] == 24
    assert 0.0 <= b["buy_probability"] <= 1.0
    assert b["predicted_future_sale_value"] > 0
    assert b["final_recommendation_with_price_guardrail"] in (
        "BUY", "DO NOT BUY", "REVIEW")


# 3 --------------------------------------------------- negative purchase amount
@pytest.mark.parametrize("amount", [-1, 0, -150000])
def test_non_positive_purchase_amount_rejected(client, amount):
    r = client.post(f"{API_PREFIX}/predict", json={**VALID,
                                                   "purchase_amount": amount})
    assert r.status_code == 422
    body = r.json()
    assert body["error"] == "validation_error"
    assert any("purchase_amount" in f["field"] for f in body["detail"])


# 4 ---------------------------------------------------------- blank card name
@pytest.mark.parametrize("name", ["", "   ", "\t\n"])
def test_blank_card_name_rejected(client, name):
    r = client.post(f"{API_PREFIX}/predict", json={**VALID, "card_name": name})
    assert r.status_code == 422
    assert any("card_name" in f["field"] for f in r.json()["detail"])


# 5 -------------------------------------------------------- invalid deal status
def test_invalid_deal_status_rejected(client):
    r = client.post(f"{API_PREFIX}/predict",
                    json={**VALID, "deal_status": "pending"})
    assert r.status_code == 422
    assert any("deal_status" in f["field"] for f in r.json()["detail"])


def test_valid_deal_statuses_accepted(client):
    for s in ("unreleased", "sold"):
        r = client.post(f"{API_PREFIX}/predict", json={**VALID, "deal_status": s})
        assert r.status_code == 200, f"{s}: {r.text}"
        assert r.json()["deal_status"] == s


# 6 ------------------------------------------------- "2 years" maps to 24 months
def test_hold_period_mapping(client):
    cases = {"6 months": 6, "1 year": 12, "2 years": 24, "3 years": 36,
             "5 years": 60}
    for label, months in cases.items():
        r = client.post(f"{API_PREFIX}/predict",
                        json={**VALID, "hold_period": label})
        assert r.status_code == 200, r.text
        assert r.json()["hold_period_months"] == months, label


def test_unsupported_hold_period_rejected(client):
    # 18 months is a reasonable thing to type and a misleading thing to answer
    # as though it were 24.
    r = client.post(f"{API_PREFIX}/predict",
                    json={**VALID, "hold_period": "18 months"})
    assert r.status_code == 422
    assert any("hold_period" in f["field"] for f in r.json()["detail"])


# 7 ------------------------------------------------------- Jordan match fidelity
def test_jordan_matches_psa_10(client):
    r = client.post(f"{API_PREFIX}/predict", json=VALID)
    assert r.status_code == 200
    assert r.json()["matched_card"] == \
        "1986 Fleer #57 Michael Jordan - PSA GEM MINT 10"


def test_jordan_psa_5_does_not_match_psa_10(client):
    r = client.post(f"{API_PREFIX}/predict",
                    json={**VALID,
                          "card_name": "1986 Fleer Michael Jordan #57 PSA 5"})
    assert r.status_code == 200
    matched = r.json()["matched_card"] or ""
    assert "10" not in matched.split("PSA")[-1], matched
    assert matched != "1986 Fleer #57 Michael Jordan - PSA GEM MINT 10"


def test_different_grades_give_different_matches(client):
    seen = {}
    for grade in (5, 8, 9, 10):
        r = client.post(f"{API_PREFIX}/predict",
                        json={**VALID,
                              "card_name": f"1986 Fleer Michael Jordan #57 PSA {grade}"})
        assert r.status_code == 200
        seen[grade] = r.json()["matched_card"]
    # a grade is a different asset; the matcher must not collapse them
    assert len(set(seen.values())) > 1, seen


def test_match_score_is_not_a_probability(client):
    """It is a RANKING score and can exceed 1.0 — the UI must not show a %."""
    r = client.post(f"{API_PREFIX}/predict", json=VALID)
    assert r.json()["match_score"] > 1.0


# 8 ------------------------------------------------------ all required fields
def test_response_contains_all_required_fields(client):
    b = client.post(f"{API_PREFIX}/predict", json=VALID).json()
    missing = [f for f in REQUIRED_FIELDS if f not in b]
    assert not missing, f"missing: {missing}"
    assert isinstance(b["current_valuation_range"], list) and \
        len(b["current_valuation_range"]) == 2
    assert isinstance(b["future_value_90pct_range"], list) and \
        len(b["future_value_90pct_range"]) == 2
    assert isinstance(b["notes"], list) and b["notes"]


# 9 ------------------------------- above maximum can never be a final BUY
def test_price_above_maximum_cannot_be_buy(client):
    """The brief's hard rule, probed from both directions."""
    base = client.post(f"{API_PREFIX}/predict", json=VALID).json()
    max_price = base["maximum_recommended_purchase_price"]

    # deliberately 3x the maximum
    r = client.post(f"{API_PREFIX}/predict",
                    json={**VALID, "purchase_amount": round(max_price * 3, 2)})
    b = r.json()
    assert b["exceeds_maximum"] is True
    assert b["final_recommendation_with_price_guardrail"] == "DO NOT BUY"
    assert b["price_headroom"] < 0


def test_guardrail_overrides_provisional_buy(client):
    """The documented example: provisional BUY, price too high -> DO NOT BUY."""
    b = client.post(f"{API_PREFIX}/predict", json=VALID).json()
    if b["full_coverage_recommendation"] == "BUY" and b["exceeds_maximum"]:
        assert b["final_recommendation_with_price_guardrail"] == "DO NOT BUY"
    # and the invariant regardless of this fixture's numbers
    if b["exceeds_maximum"]:
        assert b["final_recommendation_with_price_guardrail"] != "BUY"


def test_headroom_is_consistent(client):
    b = client.post(f"{API_PREFIX}/predict", json=VALID).json()
    expected = round(b["maximum_recommended_purchase_price"]
                     - b["entered_purchase_amount"], 2)
    assert abs(b["price_headroom"] - expected) < 0.011


# 10 --------------------------------------------- bundle loads exactly once
def test_bundle_loads_only_once(client):
    """The whole point of model_manager: 9.5 MB is not re-read per request."""
    before = manager.load_count
    for _ in range(5):
        assert client.post(f"{API_PREFIX}/predict", json=VALID).status_code == 200
    assert manager.load_count == before, \
        f"bundle re-loaded {manager.load_count - before} extra times"
    assert manager.load_count == 1, \
        f"expected exactly one load for the process, got {manager.load_count}"


# ------------------------------------------------------------------- extras
def test_no_stack_trace_leaks_on_bad_json(client):
    r = client.post(f"{API_PREFIX}/predict", json={"asset_type": "Rookie Cards"})
    assert r.status_code == 422
    assert "Traceback" not in r.text
    assert "File \"" not in r.text


def test_bundle_path_cannot_be_set_from_request(client):
    """An attacker-supplied path would be an arbitrary-file pickle load."""
    r = client.post(f"{API_PREFIX}/predict",
                    json={**VALID, "bundle_path": "/etc/passwd"})
    # extra key ignored by the schema; the served path is unchanged
    assert r.status_code == 200
    assert manager.bundle_path.name == "card_investment_bundle_v3.joblib"


def test_metadata_endpoint(client):
    b = client.get(f"{API_PREFIX}/metadata").json()
    assert b["transaction_cost_rate"] == 0.12
    assert b["required_annual_return"] == 0.10
    assert b["supported_horizons_months"] == [6, 12, 24, 36, 60]


def test_acquisition_year_bounds(client):
    for bad in (1800, 1899, 2100):
        r = client.post(f"{API_PREFIX}/predict",
                        json={**VALID, "acquisition_year": bad})
        assert r.status_code == 422, bad
