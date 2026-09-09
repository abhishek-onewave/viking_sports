# Model V4 result summary

## What this model serves

Only Michael Jordan, Mickey Mantle, and Tom Brady. The supported unit is an
exact player + card + variant + grader + numeric grade identity. The output is
next-calendar-week valuation. If a purchase amount is supplied, the output also
includes BUY, DO NOT BUY, or REVIEW and a maximum recommended purchase price.

## Data used

- 399,282 rows audited directly from `raw_sales`.
- 131,973 existing exact grader/grade-linked rows.
- 31,078 additional rows recovered because they contained a clear numeric
  grader/grade but that identity was missing from the grade catalog.
- 160,629 clean real sales after all filters; zero synthetic sales.
- 5,356 exact identities, 104,820 weekly observations, and 95,707 supervised
  next-week examples.
- Qualifiers OC, MC, MK, ST, PD, and OF were rejected before feature creation.
- 1,218 prices below 20% of the exact identity's same-year median were removed
  when the group had at least four sales. High-priced observations were kept.

## Chronological evaluation

- Training: 77,961 rows through 2025-12-29.
- Model validation: 7,643 rows from 2026-01-05 through 2026-04-27.
- Decision calibration: 4,691 rows from 2026-05-04 through 2026-06-29.
- Final untouched test: 5,412 rows from 2026-07-06 through 2026-09-07.

## Final valuation metrics

- Log R²: 86.97%.
- Median absolute percentage error: 21.58%.
- RMSLE: 0.6575.
- MAE: $1,242.70.
- RMSE: $9,275.91; this is sensitive to rare expensive cards.
- Within 10% of the observed next-week median: 25.42%.
- Within 20%: 47.04%.

## Final BUY metrics

The classifier uses a 12% transaction-cost assumption and a 10% annual hurdle
over seven days.

- All 5,412 cases: 69.01% accuracy, 61.50% precision, 62.37% recall, 61.93% F1,
  and 73.44% ROC-AUC.
- High-confidence automatic subset: 89.47% accuracy, 80.77% BUY precision,
  70.00% recall, and 75.00% F1 on 133 cases (2.46% coverage).

The 89.47% number is not whole-model accuracy. The other 97.54% of cases must
remain REVIEW unless business rules deliberately accept more risk.

## Important status

The catalog is complete, but the source database still marks sales extraction
as PENDING for all three players. This is a production-candidate snapshot and
should be retrained after the backfill finishes.
