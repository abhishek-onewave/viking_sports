# Viking Sports — v2

Sports-memorabilia deal analysis built on **real auction results**.

Two analyzers: a **buy/pass signal** for a type of deal, and a **comparable-sales
lookup** for a specific card. Every figure traces to a real auction result, and
every prediction ships with the sample size and lift behind it.

---

## What changed in v2, and why

**v2 still predicts BUY / PASS — but on a question that's answerable, with a
model trained on real data.** Two things were wrong with v1.

### 1. The v1 model was trained on invented data

`scripts/build_model.py` used to generate 12,000 synthetic deals and label them
with a hand-written formula:

```python
prob = 0.5
prob += {"Rookie Cards": +0.30, "Cards (Non-Rookie)": -0.08, ...}[asset_type]
prob += {"1990s": +0.25, "2020s": -0.20, ...}[decade]
target = int(random() < prob)
```

12,000 of 12,089 rows — **99.3%** — were invented. The reported AUC of 0.867
measured how well XGBoost recovered that formula, not anything about
memorabilia.

Those assumptions were then tested against 256 **real** repeat-sale pairs
scraped from six auction houses:

| the formula assumed | real data showed | verdict |
|---|---|---|
| Rookie Cards **+0.30** (best class) | median MOIC 0.95, 17% hit 2× | ❌ |
| Cards Non-Rookie **−0.08** (poor) | median MOIC 1.32, 22% hit 2× | ❌ **inverted** |
| older decade = better | 2010s 44% vs 2020s 11% | ✅ but it's the 2020–21 bubble |
| longer hold = better | corr(hold, MOIC) = +0.34 | ✅ but unknowable at buy time |
| cheaper entry = better | untestable (255/256 pairs >$20K) | — |

The single strongest assumption had the sign backwards.

### 2. The v1 inputs could not identify an asset

v1 asked for asset type, price bracket, decade, hold period and status — a
description of a **category**. Grouping the 256 real pairs by exactly those
fields:

```
"Cards (Non-Rookie) · $20K+ · 2020s"  →  94 real deals,  MOIC 0.36 … 5.12
"Rookie Cards · $20K+ · 2020s"        →  79 real deals,  MOIC 0.12 … 4.08
```

94 deals give byte-identical form answers and range from losing 64% to gaining
412%. No model can separate inputs that are identical.

v2 keeps that form (it predicts a category **base rate** well — 0.782 ROC-AUC)
but says plainly that it's a category estimate, and adds an Item Lookup that
identifies a specific card by player, year, set, card number and grade.

### Also fixed

`feature-engineering.ts` computed `log_buy_price` with `Math.log1p(price)` while
training used `np.log10(price)`. For a $150 item that's 5.02 vs 2.18 — the
deployed price feature was materially mis-scaled. That code path is gone.

---

## How it works

```
scraper (separate repo)  →  auction_lots.db  →  export_comps.py
                                                     │
                                          public/data/comps.json
                                                     │
                                     src/lib/valuation/comps.ts
                                                     │
                              components/predictor/ValuationForm.tsx
```

No backend, no database, no cold starts. The index is ~2.2 MB raw / **347 KB
gzipped**, fetched once and cached.

**Match quality is always surfaced.** Comps are found by progressively loosening
the match, and the UI states which tier produced the numbers:

| tier | meaning | fair-value estimate? |
|---|---|---|
| `exact` | same card, same grade | ✅ |
| `same-card` | same card, other grades | ⚠️ indicative only |
| `same-set` | same player/year/set | ❌ withheld |
| `same-player` | same player only | ❌ withheld |

When matches are too loose, **no number is shown**. A missing estimate is more
useful than an invented one — which is the whole lesson of v1.

No grade-adjustment curve is applied when pooling grades, because none has been
measured. Inventing a multiplier would repeat v1's mistake.

---

## Running it

```bash
npm install
npm run dev
```

### Refreshing the data (after each weekly scrape)

```bash
# 1. rebuild the comparable-sales index the app ships with
python3 scripts/export_comps.py --db ../vk_data_scrap/data/auction_lots.db

# 2. optional: retrain the fair-value fallback model + refresh its metrics
python3 scripts/build_model.py --db ../vk_data_scrap/data/auction_lots.db

# 3. redeploy
```

`build_model.py` will **not** fall back to synthetic data if the database is
missing — it exits with an error instead. That's intentional.

---

## Current dataset

| | |
|---|---|
| Real priced sales | **7,347** |
| Date range | 2004-04-01 → 2026-08-04 |
| Sources | fanatics 2,120 · lelands 2,061 · greyflannel 1,978 · rea 996 · sothebys 192 |
| Fully identifiable (player+year+set+card#+grade) | 1,194 |

Hunt is absent: it gates realized prices behind a login, so it contributes no
comparable prices.

### Fair-value fallback model

Trained on the 7,347 real sales, target `log1p(sale_price)`:

| model | R² (log $) | median × error |
|---|---|---|
| **XGBoost** | **0.836** | **1.77×** |
| Random Forest | 0.833 | 1.77× |
| HistGradientBoosting | 0.832 | 1.83× |
| Ridge | 0.765 | 2.22× |
| Baseline (mean) | 0.000 | 5.42× |

Holdout (n=1,470): R² 0.836, median error 1.77×.

**Carry these caveats into any UI that surfaces it:**

- It predicts **fair value, not future return.** It cannot say an item will 3×.
- Typical prediction is off by ~1.8×, so a $10,000 estimate means roughly
  $5,600–$18,000. A screen for human review, not an execution signal.
- `source` alone carries **~0.68 of feature importance** — it leans heavily on
  which auction house a lot is at. Without it R² falls to 0.750. It knows tiers
  (graded beats raw, REA beats Fanatics) far better than individual cards. This
  is why the app leads with observed comps and treats the model as a fallback.
- Each source covers a narrow date window, so the model encodes those windows'
  price levels and drifts. Retrain after each scrape.

---

## Two analyzers

`Deal Analyzer` is the original five-field form — asset type, hold period,
purchase price, acquisition year, deal status — restored, but behind a model
trained on 260 real repeat sales instead of 12,000 synthetic rows.

`Item Lookup` identifies a specific card and shows its actual comparable sales.

Measured on the same pairs, same grouped CV, same market-relative target:

| analyzer | features | ROC-AUC | prec | rec |
|---|---|---|---|---|
| **Deal Analyzer** | asset type + hold + price + year | **0.782 ± 0.051** | 0.75 | 0.73 |
| Item Lookup signal | grade + item year + comps | 0.690 ± 0.071 | 0.74 | 0.62 |

The category inputs score **higher**, with tighter variance. Most of that comes
from `hold_years`, which the item-level model excludes — and that exclusion is
right for one question and wrong for another:

- *"Should I buy this lot?"* — hold period unknown, so using it is leakage
- *"If I hold 5 years, will it beat the market?"* — the **user** supplies it, so
  it's a scenario input

The Deal Analyzer answers the second. Neither analyzer subsumes the other: the
first shapes a portfolio, the second prices a lot.

### What the Deal Analyzer cannot do

Distinguish two items in the same category. Grouped by those exact five inputs,
one combination in the real data held **94 pairs ranging 0.36x to 5.12x**. It
estimates a base rate for a *type* of deal. The UI says so, next to the result.

### Only 3 of 12 asset types have data

```
Cards (Non-Rookie)   133 pairs
Rookie Cards         109 pairs
Memorabilia           18 pairs   (thin — flagged in the UI)
the other nine          0 pairs
```

For the nine with no data the one-hot column doesn't exist, so the model would
score off its intercept — a number with no basis. `portfolioSignal()` **refuses**
and names what's supported. The list is derived from the model file at load time,
so it stays true as the dataset grows.

`is_realized` is collected but is **not a feature**: every repeat-sale pair is
realized by construction, so the column is constant in training. The UI says
this rather than pretending the toggle matters.

## The item-level outperformance signal

v2 **does** ship a buy/pass signal — but it predicts a different, answerable
question, and it never appears without its evidence.

**What it predicts:** P(this item beats the market over the hold), where "the
market" is the median MOIC of everything bought the same year.

That reframing is what makes it usable. Predicting raw MOIC scored 0.751
ROC-AUC, but nearly all of it came from `buy_year` — the model had learned the
2020–21 bubble, and `buy_year` can't extrapolate to a future purchase. Strip the
timing and raw MOIC collapses to 0.587. Dividing by a same-year benchmark removes
the confound (correlation with `buy_year` falls from −0.301 to 0.000) and leaves
genuine asset-selection signal:

| | |
|---|---|
| ROC-AUC | **0.690** out-of-fold, item-grouped CV |
| Flagged items beat the market | **74%** |
| Baseline (any item) | 52% |
| **Improvement** | **+22 points** |
| Confidence | ±8 points |
| Validated on | 260 repeat sales / 65 graded cards |

`buy_year` and `decade_ordinal` are **excluded from the deployed model** — at
inference `buy_year` would be the current year, outside the 2004–2026 training
range, so the model would extrapolate on its most influential input.

**Scope gate.** Graded cards only. Asked about a game-worn jersey the model would
still emit a number and it would be meaningless, so `buySignal()` refuses and
explains why. Refusing is the correct output.

**Every number ships with its evidence.** A bare "68%" reads as accuracy. The UI
renders the lift, the baseline, the sample size and the CI beside it, plus the
reminder that roughly 1 in 4 flagged items still underperforms.

### Discount-to-comps is NOT a buy signal

Worth recording, because it's counterintuitive. Tested against 130 real repeat
sales:

```
asking vs comps      n    % beat market
<0.7x (discount)    26        53.9%
0.9-1.1x (market)   17        47.1%
1.1-1.4x            30        60.0%   <- best bucket
>1.4x (premium)     31        45.2%

Spearman correlation: -0.033        as a classifier: ROC-AUC 0.539
```

No monotonic relationship, and the best bucket was buying at a *premium*. A
discount usually reflects something real about the lot — weaker eye appeal within
the grade, a thin auction, soft demand that week. The UI shows price-vs-comps as
**information about price level**, explicitly not as a recommendation.

### Python/TypeScript parity is enforced

Inference runs in the browser from `public/model/buy-signal.json` (exported
coefficients + transform parameters — Logistic Regression is
`sigmoid(w·x + b)`, so this is exact, not approximated).

```bash
npm run verify-parity     # replays 12 real inputs, fails above 1e-9
```

Current worst difference: **1.1e-16**. This test exists because v1 shipped a
silent mismatch — training used `np.log10(price)`, the TypeScript used
`Math.log1p(price)`. The exporter also refuses to write if the reconstructed
column order disagrees with the pipeline's, which is how `SimpleImputer` silently
dropping an all-missing column (`comp_median_30d`) would otherwise have
misaligned every coefficient after index 10.

**Run `npm run verify-parity` in CI.**

## Refreshing everything

```bash
npm run refresh-data      # comps + buy model + parity check
```

## Not yet done

- **Accuracy badges on the marketing pages** still quote v1's numbers ("78% /
  0.87" from synthetic data, "88.9% / 97.5%" from the 89-row rank-matched set).
  Replace with the table above, which is measured.
- **More repeat-sale pairs.** 260 pairs across 65 items is what makes the ±8pt
  interval wide. Note that broad scraping barely helps: measured pair yield is
  0.87 per sale at REA (which resells the same iconic cards for 20+ years) versus
  0.08 at Fanatics. Targeted collection of specific high-turnover cards is the
  lever, not volume.
- **Saving valuation lookups to Supabase.** The `predictions` table matches v1's
  shape; storing comps lookups needs a migration. `src/lib/model/types.ts` is
  kept solely so the existing dashboard can read historical rows.
