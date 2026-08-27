"""
schemas.py — request validation and response contract.

Validation happens HERE, before anything reaches the model. Every rule in the
brief is enforced with a specific, human-readable message, because a 422 that
just says "invalid" forces the frontend to guess which field the user got wrong.
"""
from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

# The three asset types the form offers. Kept as a Literal so an unknown value is
# a validation error rather than something the matcher silently down-weights.
ASSET_TYPES = ("Cards (Non-Rookie)", "Rookie Cards", "Stickers")

# Label -> months. The model supports exactly these five horizons; anything else
# would be snapped to the nearest by _hold_months(), which would silently answer
# a different question from the one asked.
HOLD_PERIOD_MONTHS: dict[str, int] = {
    "6 months": 6,
    "1 year": 12,
    "2 years": 24,
    "3 years": 36,
    "5 years": 60,
}
SUPPORTED_MONTHS = (6, 12, 24, 36, 60)

_CURRENT_YEAR = date.today().year
MIN_YEAR = 1900
MAX_YEAR = _CURRENT_YEAR + 1          # a deal being papered for next year is fine


class PredictRequest(BaseModel):
    asset_type: Literal["Cards (Non-Rookie)", "Rookie Cards", "Stickers"]
    card_name: Annotated[str, Field(min_length=1, max_length=300)]
    hold_period: str
    purchase_amount: float
    acquisition_year: int
    deal_status: Literal["unreleased", "sold"]

    model_config = {
        "json_schema_extra": {
            "example": {
                "asset_type": "Cards (Non-Rookie)",
                "card_name": "1986 Fleer Michael Jordan #57 PSA 10 Rookie Card",
                "hold_period": "2 years",
                "purchase_amount": 150000,
                "acquisition_year": 2026,
                "deal_status": "unreleased",
            }
        }
    }

    @field_validator("card_name")
    @classmethod
    def _card_name_not_blank(cls, v: str) -> str:
        # min_length=1 alone would accept "   ".
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("card_name cannot be blank")
        return cleaned

    @field_validator("purchase_amount")
    @classmethod
    def _purchase_amount_positive(cls, v: float) -> float:
        if v is None or v <= 0:
            raise ValueError("purchase_amount must be greater than zero")
        if v > 100_000_000:
            raise ValueError("purchase_amount is implausibly large")
        return float(v)

    @field_validator("acquisition_year")
    @classmethod
    def _year_reasonable(cls, v: int) -> int:
        if not (MIN_YEAR <= v <= MAX_YEAR):
            raise ValueError(
                f"acquisition_year must be between {MIN_YEAR} and {MAX_YEAR}")
        return int(v)

    @field_validator("hold_period")
    @classmethod
    def _hold_period_supported(cls, v: str) -> str:
        """Accept a form label, a bare month count, or a 'N years' string.

        Rejects anything that does not land on a supported horizon rather than
        letting the model snap it silently. "18 months" is a reasonable thing for
        a user to type and a misleading thing to answer as if it were 24.
        """
        raw = str(v).strip()
        if raw in HOLD_PERIOD_MONTHS:
            return raw
        low = raw.lower()
        import re
        m = re.search(r"([0-9]+(?:\.[0-9]+)?)", low)
        if m:
            n = float(m.group(1))
            months = n if "month" in low else n * 12
            if int(months) in SUPPORTED_MONTHS:
                return raw
        raise ValueError(
            "hold_period must map to 6, 12, 24, 36 or 60 months. "
            f"Accepted labels: {', '.join(HOLD_PERIOD_MONTHS)}")

    def hold_months(self) -> int:
        if self.hold_period in HOLD_PERIOD_MONTHS:
            return HOLD_PERIOD_MONTHS[self.hold_period]
        import re
        low = self.hold_period.lower()
        n = float(re.search(r"([0-9]+(?:\.[0-9]+)?)", low).group(1))
        return int(n if "month" in low else n * 12)


class HealthResponse(BaseModel):
    status: str
    model_version: str
    model_loaded: bool
    market_data_as_of: str | None = None


class PredictResponse(BaseModel):
    """Mirrors predict_card()'s output exactly, plus derived display helpers.

    `match_score` is passed through but is a RANKING score, not a probability —
    it can exceed 1.0 (the Jordan example scores 1.1457). The frontend must never
    render it as a percentage.
    """
    matched_card: str | None
    match_score: float
    identity_id: str | None
    market_data_as_of: str
    current_valuation: float | None
    current_valuation_range: list[float]
    current_valuation_method: str | None
    hold_period_months: int
    buy_probability: float
    full_coverage_recommendation: str
    high_confidence_action: str
    final_recommendation_with_price_guardrail: str
    predicted_future_sale_value: float
    future_value_90pct_range: list[float]
    maximum_recommended_purchase_price: float
    entered_purchase_amount: float
    deal_status: str
    notes: list[str]

    # Derived server-side so the frontend cannot compute the guardrail
    # differently from the backend.
    price_headroom: float
    exceeds_maximum: bool


class ErrorResponse(BaseModel):
    error: str
    detail: str | list[dict] | None = None
    request_id: str | None = None
