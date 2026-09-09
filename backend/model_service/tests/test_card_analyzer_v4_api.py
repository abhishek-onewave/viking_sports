"""
tests/test_card_analyzer_v4_api.py — Card Analyzer (Model V4) backend cases.

Run:
    cd backend && .venv/bin/python -m pytest model_service/tests -v

Like the v3 suite these hit the REAL bundle: what matters is the contract —
that only predictable, qualifier-free exact identities are offered, that the
exact selected grade_uid is what gets scored, and that no unsupported holding
period can ever produce a fabricated forecast.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVICE_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = SERVICE_DIR.parent
for p in (str(BACKEND_DIR), str(SERVICE_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from model_service.app import API_PREFIX_V4, app        # noqa: E402
from model_service.model_manager_v4 import manager_v4    # noqa: E402

EXAMPLE_UID = "8bccf7a00e6f5ec1819a"   # Michael Jordan 1986 Fleer #57 Base PSA 9
PLAYERS = ("Michael Jordan", "Mickey Mantle", "Tom Brady")
QUALIFIERS = {"OC", "MC", "MK", "ST", "PD", "OF"}


@pytest.fixture(scope="session")
def client():
    # `with` triggers lifespan, which is where the single load happens.
    with TestClient(app) as c:
        yield c


# ------------------------------------------------------------------- health
def test_v4_health(client):
    r = client.get(f"{API_PREFIX_V4}/health")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "healthy"
    assert body["model_version"] == "4.0"
    assert body["model_loaded"] is True
    assert body["forecast_week"]
    assert not manager_v4.missing_components()


# 1 ------------------------------------------- exactly three supported players
def test_exactly_three_supported_players(client):
    body = client.get(f"{API_PREFIX_V4}/players").json()
    assert [p["player"] for p in body["players"]] == list(PLAYERS)


# 2 ------------------------------------------------------ years sorted ascending
@pytest.mark.parametrize("player", PLAYERS)
def test_years_sorted_ascending(client, player):
    r = client.get(f"{API_PREFIX_V4}/years", params={"player": player})
    assert r.status_code == 200
    years = r.json()["years"]
    assert years and years == sorted(years)
    assert all(isinstance(y, int) for y in years)


# 3 -------------------------- player-only returns every predictable identity
def test_player_only_returns_all_predictable_identities(client):
    bundle = manager_v4._bundle
    predictable = set(bundle["latest_features"]["grade_uid"].astype(str))
    catalog = bundle["search_catalog"]
    expected = set(catalog[
        catalog["player_name"].eq("Michael Jordan")
        & catalog["grade_uid"].astype(str).isin(predictable)
        & ~catalog["qualifier"].fillna("").str.strip().ne("")
    ]["grade_uid"].astype(str))
    body = client.get(f"{API_PREFIX_V4}/cards",
                      params={"player": "Michael Jordan"}).json()
    assert {c["grade_uid"] for c in body["cards"]} == expected


# 4 --------------------------------------------------- year filters the list
def test_year_filter(client):
    all_cards = client.get(f"{API_PREFIX_V4}/cards",
                           params={"player": "Michael Jordan"}).json()
    year_cards = client.get(f"{API_PREFIX_V4}/cards",
                            params={"player": "Michael Jordan",
                                    "year": 1986}).json()
    assert 0 < year_cards["count"] < all_cards["count"]
    assert all(c["year"] == 1986 for c in year_cards["cards"])
    expected = [c["grade_uid"] for c in all_cards["cards"] if c["year"] == 1986]
    assert [c["grade_uid"] for c in year_cards["cards"]] == expected


# 5 --------- sorted by year, set, natural card number, parallel, grader, grade
def test_cards_sorted(client):
    cards = client.get(f"{API_PREFIX_V4}/cards",
                       params={"player": "Tom Brady"}).json()["cards"]

    def natural(value):
        return tuple((0, int(p)) if p.isdigit() else (1, p.lower())
                     for p in re.split(r"(\d+)", value or "") if p)

    def grade_num(value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return float("inf")

    keys = [(c["year"] if c["year"] is not None else 9999,
             c["set"].lower(), natural(c["card_number"]),
             c["parallel"].lower(), c["grader"].lower(), grade_num(c["grade"]))
            for c in cards]
    assert keys == sorted(keys)


# 6 ---------------------------------------- qualifier identities never appear
def test_no_qualifier_identities(client):
    catalog = manager_v4._bundle["search_catalog"].set_index("grade_uid")
    for player in PLAYERS:
        cards = client.get(f"{API_PREFIX_V4}/cards",
                           params={"player": player}).json()["cards"]
        for card in cards:
            qualifier = str(catalog.loc[card["grade_uid"], "qualifier"] or "").strip()
            assert qualifier == "", f"qualifier identity leaked: {card['grade_uid']}"
            label = str(catalog.loc[card["grade_uid"], "grade_label_raw"] or "").upper()
            assert not (QUALIFIERS & set(label.split()))


# 7 ------------------------------ only prediction_available identities appear
def test_only_prediction_available(client):
    predictable = set(
        manager_v4._bundle["latest_features"]["grade_uid"].astype(str))
    for player in PLAYERS:
        cards = client.get(f"{API_PREFIX_V4}/cards",
                           params={"player": player}).json()["cards"]
        assert cards, player
        for card in cards:
            assert card["prediction_available"] is True
            assert card["grade_uid"] in predictable


# 8 ------------------------------- the exact selected grade_uid reaches the model
def test_exact_grade_uid_reaches_model(client, monkeypatch):
    captured = {}
    real = manager_v4._predict_fn

    def spy(grade_uid, purchase_amount=None, bundle=None, **kw):
        captured["grade_uid"] = grade_uid
        captured["purchase_amount"] = purchase_amount
        return real(grade_uid, purchase_amount=purchase_amount, bundle=bundle, **kw)

    monkeypatch.setattr(manager_v4, "_predict_fn", spy)
    r = client.post(f"{API_PREFIX_V4}/predict",
                    json={"grade_uid": EXAMPLE_UID, "purchase_amount": 50000,
                          "holding_period_days": 7})
    assert r.status_code == 200, r.text
    assert captured["grade_uid"] == EXAMPLE_UID
    assert captured["purchase_amount"] == 50000.0
    assert r.json()["grade_uid"] == EXAMPLE_UID


# 9 -------------------------------------------------- no fuzzy fallback occurs
def test_no_fuzzy_fallback(client):
    near_miss = EXAMPLE_UID[:-1] + ("0" if EXAMPLE_UID[-1] != "0" else "1")
    r = client.post(f"{API_PREFIX_V4}/predict", json={"grade_uid": near_miss})
    assert r.status_code == 404
    assert r.json()["error"] == "NOT_FOUND"
    # a card TITLE is not an identifier either
    r = client.post(f"{API_PREFIX_V4}/predict",
                    json={"grade_uid": "Michael Jordan 1986 Fleer #57 PSA 9"})
    assert r.status_code == 404
    assert r.json()["error"] == "NOT_FOUND"


# 10 --------------------------------- empty purchase amount -> valuation only
def test_valuation_only_without_purchase(client):
    for payload in ({"grade_uid": EXAMPLE_UID},
                    {"grade_uid": EXAMPLE_UID, "purchase_amount": None}):
        r = client.post(f"{API_PREFIX_V4}/predict", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "OK"
        assert b["predicted_next_week_valuation"] > 0
        assert b["current_valuation"] > 0
        assert len(b["prediction_90pct_range"]) == 2
        for key in ("recommendation", "buy_probability",
                    "maximum_recommended_purchase_price"):
            assert key not in b


# 11 ----------------------- valid purchase -> recommendation + maximum price
def test_purchase_produces_recommendation(client):
    b = client.post(f"{API_PREFIX_V4}/predict",
                    json={"grade_uid": EXAMPLE_UID,
                          "purchase_amount": 50000}).json()
    assert b["recommendation"] in ("BUY", "DO NOT BUY", "REVIEW")
    assert 0.0 <= b["buy_probability"] <= 1.0
    assert b["maximum_recommended_purchase_price"] > 0
    assert b["purchase_amount"] == 50000.0


# 12 ----------------------------------------- invalid purchase amounts rejected
@pytest.mark.parametrize("amount", [0, -1, -50000.5, "50000", "abc", True,
                                    200_000_000])
def test_invalid_purchase_amounts_rejected(client, amount):
    r = client.post(f"{API_PREFIX_V4}/predict",
                    json={"grade_uid": EXAMPLE_UID, "purchase_amount": amount})
    assert r.status_code == 400, r.text
    b = r.json()
    assert b["error"] == "INVALID_PURCHASE_AMOUNT"
    assert "predicted_next_week_valuation" not in b


def test_nan_purchase_amount_rejected(client):
    # Python's json.loads accepts bare NaN, so a raw body can smuggle one past
    # a strict client. It must still land on INVALID_PURCHASE_AMOUNT.
    r = client.post(f"{API_PREFIX_V4}/predict",
                    content=('{"grade_uid": "%s", "purchase_amount": NaN}'
                             % EXAMPLE_UID).encode(),
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 400, r.text
    assert r.json()["error"] == "INVALID_PURCHASE_AMOUNT"


# 13 --------------------- unsupported holding periods never produce forecasts
@pytest.mark.parametrize("days", [1, 30, 182, 365, 1095, 1825, 0, -7, "7"])
def test_unsupported_holding_periods(client, days):
    r = client.post(f"{API_PREFIX_V4}/predict",
                    json={"grade_uid": EXAMPLE_UID, "holding_period_days": days})
    assert r.status_code == 400, r.text
    b = r.json()
    assert b["error"] == "UNSUPPORTED_HOLDING_PERIOD"
    for key in ("predicted_next_week_valuation", "current_valuation",
                "recommendation"):
        assert key not in b


def test_default_holding_period_is_seven_days(client):
    b = client.post(f"{API_PREFIX_V4}/predict",
                    json={"grade_uid": EXAMPLE_UID}).json()
    assert b["holding_period_days"] == 7


# 15 ------------------------------- NOT_FOUND / INSUFFICIENT_DATA handled cleanly
def test_not_found(client):
    r = client.post(f"{API_PREFIX_V4}/predict",
                    json={"grade_uid": "does-not-exist"})
    assert r.status_code == 404
    assert r.json()["error"] == "NOT_FOUND"


def test_insufficient_data(client):
    bundle = manager_v4._bundle
    catalog = bundle["search_catalog"]
    predictable = set(bundle["latest_features"]["grade_uid"].astype(str))
    clean = catalog[~catalog["qualifier"].fillna("").str.strip().ne("")]
    no_history = clean[~clean["grade_uid"].astype(str).isin(predictable)]
    assert not no_history.empty
    uid = str(no_history.iloc[0]["grade_uid"])
    r = client.post(f"{API_PREFIX_V4}/predict", json={"grade_uid": uid})
    assert r.status_code == 422
    assert r.json()["error"] == "INSUFFICIENT_DATA"
    # and such identities are never offered by the cards endpoint
    player = str(no_history.iloc[0]["player_name"])
    cards = client.get(f"{API_PREFIX_V4}/cards",
                       params={"player": player}).json()["cards"]
    assert uid not in {c["grade_uid"] for c in cards}


# 16 --------------------------------------- bundle loads exactly once per worker
def test_v4_bundle_loads_only_once(client):
    before = manager_v4.load_count
    for _ in range(5):
        assert client.post(f"{API_PREFIX_V4}/predict",
                           json={"grade_uid": EXAMPLE_UID}).status_code == 200
        assert client.get(f"{API_PREFIX_V4}/players").status_code == 200
    assert manager_v4.load_count == before
    assert manager_v4.load_count == 1, \
        f"expected exactly one v4 load, got {manager_v4.load_count}"


# ------------------------------------------------------------------ metadata
def test_v4_metadata(client):
    b = client.get(f"{API_PREFIX_V4}/metadata").json()
    assert b["model_version"] == "4.0"
    assert b["forecast_week"] == "2026-09-14"
    assert b["latest_sale_date"] and b["created_utc"]
    assert isinstance(b["is_stale"], bool)
    supported = [h["days"] for h in b["holding_periods"] if h["supported"]]
    assert supported == [7]
    assert b["assumptions"]["required_annual_return"] == 0.10
    assert b["assumptions"]["transaction_cost_rate"] == 0.12
    assert b["assumptions"]["forecast_horizon_days"] == 7
    perf = b["performance"]
    assert round(perf["buy_accuracy"], 4) == 0.6901
    assert round(perf["high_confidence_accuracy"], 4) == 0.8947
    assert round(perf["high_confidence_coverage"], 4) == 0.0246


# --------------------------------------------------------------------- extras
def test_unknown_player_is_not_found(client):
    for endpoint in ("years", "cards"):
        r = client.get(f"{API_PREFIX_V4}/{endpoint}",
                       params={"player": "LeBron James"})
        assert r.status_code == 404
        assert r.json()["error"] == "NOT_FOUND"


def test_v4_bundle_path_cannot_be_set_from_request(client):
    r = client.post(f"{API_PREFIX_V4}/predict",
                    json={"grade_uid": EXAMPLE_UID, "bundle_path": "/etc/passwd"})
    assert r.status_code == 200
    assert manager_v4.bundle_path.name == "card_investment_bundle_v4.joblib"


def test_no_stack_trace_leaks(client):
    r = client.post(f"{API_PREFIX_V4}/predict", json={})
    assert r.status_code == 422
    assert "Traceback" not in r.text and 'File "' not in r.text
