# Card Investment Model V4 — application bundle

V4 forecasts the next calendar week's median market price for one exact,
unqualified card-grade identity. It was trained on real Card Ladder transaction
observations for Michael Jordan, Tom Brady, and Mickey Mantle. No synthetic
records were used.

The training loader starts from `raw_sales`, retains existing exact grade links,
and recovers rows whose only catalog failure was a clearly parsed numeric
grader/grade not present in `card_grades`. It never guesses missing or ambiguous
grades. For an exact identity/year with at least four sales, only prices below
20% of the median are removed; high sales remain.

## Identity contract

The same market asset means the same player, year, set, card number, variant,
serial denominator, autograph/rookie state, grader, and grade. Physical slab
certificate numbers may differ. `OC`, `MC`, `MK`, `ST`, `PD`, and `OF`
identities and title-level qualifier matches are excluded.

Never send free text directly into prediction. Search first, show candidates to
the user, and pass the selected `grade_uid` to prediction.

```python
from card_investment_inference_v4 import (
    load_bundle,
    list_players,
    list_cards,
    list_card_grades,
    predict_card_grade,
)

bundle = load_bundle()
players = list_players(bundle=bundle)
cards = list_cards("Michael Jordan", bundle=bundle)
grades = list_card_grades(cards[0]["card_uid"], bundle=bundle)

# The UI must let the user select these exact IDs.
selected_grade_uid = grades[0]["grade_uid"]
result = predict_card_grade(
    selected_grade_uid,
    purchase_amount=55000,
    bundle=bundle,
)
print(result)
```

If an identity has no clean historical sales, prediction returns
`INSUFFICIENT_DATA`. Qualifier text in search returns no candidates. Sparse or
stale identities can return `REVIEW` even when a numerical forecast exists.

## Files

- `card_investment_bundle_v4.joblib`: model, preprocessors, current features,
  exact clean catalog, uncertainty calibration, and search index.
- `card_investment_inference_v4.py`: standalone strict inference functions.
- `app_integration_example_v4.py`: ready service-layer functions for player,
  card, grade, search, and prediction API routes.
- `model_metadata_v4.json`: data audit, temporal splits, test metrics, and
  limitations.
- `model_comparison_v4.csv`: validation model comparison.
- `test_model_comparison_v4.csv`: untouched test comparison.
- `clean_card_grade_catalog_v4.csv`: qualifier-free numeric-grade catalog.
- `qualifier_audit_v4.json`: excluded qualifier evidence.
- `excluded_price_outliers_v4.csv.gz`: every below-20% exact-identity/year
  price removed before training, with its comparison median. High prices stay.
- `requirements_v4.txt`: pinned major runtime dependencies.
- `plots/buy_roc_precision_recall.png` and `plots/buy_confusion_matrix.png`:
  final-holdout classification diagnostics.

## Important production behavior

- The supported forecast horizon is seven days/next calendar week.
- BUY probability comes from a dedicated CatBoost decision classifier using
  the entered offer, a 12% transaction-cost assumption, and a 10% annual hurdle.
- Valuation performance must be described with percentage error, not
  classification accuracy.
- Test metrics apply to weeks where a verified future-week sale existed.
- The source sales backfill still has pending identities; retrain after the
  extraction finishes.

## Final chronological holdout (2026-07-06 through 2026-09-07)

- Valuation log R²: 86.97%; median absolute percentage error: 21.58%.
- BUY all-case: 69.01% accuracy, 61.50% precision, 62.37% recall, 61.93% F1,
  and 73.44% ROC-AUC.
- High-confidence automatic subset: 89.47% accuracy, 80.77% BUY precision,
  70.00% recall, and 75.00% F1 on 133 of 5,412 cases (2.46% coverage).

Do not present 89.47% as whole-model accuracy. It applies only to the small
automatic subset; all remaining cases must be shown as `REVIEW`.
