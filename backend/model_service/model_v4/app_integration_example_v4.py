"""Minimal application service layer for Card Investment Model V4.

Map these functions to your frontend/API routes. Load the bundle once when the
backend starts; do not reload the 50+ MB artifact on every request.
"""
from __future__ import annotations

from card_investment_inference_v4 import (
    list_card_grades,
    list_cards,
    list_players,
    load_bundle,
    predict_card_grade,
    search_cards,
)


BUNDLE = load_bundle()


def get_players() -> dict:
    """GET /api/cards/players"""
    return {"status": "OK", "players": list_players(bundle=BUNDLE)}


def get_cards(player: str) -> dict:
    """GET /api/cards?player=Michael%20Jordan"""
    cards = list_cards(player, bundle=BUNDLE)
    return {"status": "OK" if cards else "NOT_FOUND", "cards": cards}


def get_grades(card_uid: str) -> dict:
    """GET /api/card-grades?card_uid=..."""
    grades = list_card_grades(card_uid, bundle=BUNDLE)
    return {"status": "OK" if grades else "NOT_FOUND", "grades": grades}


def get_search_results(query: str, limit: int = 10) -> dict:
    """GET /api/card-search?q=... (optional search-box flow)."""
    return {"status": "OK", "candidates": search_cards(query, limit, bundle=BUNDLE)}


def post_prediction(grade_uid: str, purchase_amount: float | None = None) -> dict:
    """POST /api/card-prediction with exact grade_uid and optional offer."""
    return predict_card_grade(
        grade_uid=grade_uid,
        purchase_amount=purchase_amount,
        bundle=BUNDLE,
    )


if __name__ == "__main__":
    print(get_players())
