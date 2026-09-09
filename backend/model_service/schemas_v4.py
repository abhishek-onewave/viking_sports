"""
schemas_v4.py — request/response contract for the Card Analyzer (Model V4).

The v4 predict request is deliberately loose at the type layer: semantic
validation happens in the route so that the client receives the SPECIFIC error
codes the analyzer UI keys on (INVALID_PURCHASE_AMOUNT,
UNSUPPORTED_HOLDING_PERIOD, …) rather than a generic pydantic
validation_error whose field list it would have to reverse-engineer.
"""
from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, Field


class PredictV4Request(BaseModel):
    grade_uid: Annotated[str, Field(min_length=1, max_length=100)]
    # Validated semantically in the route — see app.py — so the error codes
    # below stay authoritative:
    #   purchase_amount     -> INVALID_PURCHASE_AMOUNT
    #   holding_period_days -> UNSUPPORTED_HOLDING_PERIOD
    purchase_amount: Any = None
    holding_period_days: Any = None

    model_config = {
        "extra": "ignore",   # a smuggled bundle_path never reaches the model
        "json_schema_extra": {
            "example": {
                "grade_uid": "8bccf7a00e6f5ec1819a",
                "purchase_amount": 50000,
                "holding_period_days": 7,
            }
        },
    }


class CardIdentity(BaseModel):
    grade_uid: str
    card_uid: str
    player: str
    year: int | None
    set: str
    card_number: str
    parallel: str
    grader: str
    grade: str
    display_name: str
    historical_sales_count: int
    prediction_available: bool


class ErrorV4Response(BaseModel):
    """Same shape as the v3 ErrorResponse; `error` carries the analyzer codes:
    NOT_FOUND, INSUFFICIENT_DATA, REJECTED_QUALIFIER,
    UNSUPPORTED_HOLDING_PERIOD, INVALID_PURCHASE_AMOUNT, MODEL_UNAVAILABLE.
    """
    error: str
    detail: str | list[dict] | None = None
    request_id: str | None = None
