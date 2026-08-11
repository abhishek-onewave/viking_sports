# Viking Sports — v2

Sports-memorabilia deal analysis built on **real auction results**.

The Deal Analyzer takes a specific item and shows what comparable examples have
actually sold for. Every figure on screen traces to a real lot you can open.

---

## What changed in v2, and why

**v1 predicted BUY / NOT BUY. v2 shows comparable sales.** That's a deliberate
downgrade in ambition, for two measured reasons.

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
412%. No model can separate inputs that are identical — returns are determined
by *which* card, not which category.

v2's form asks for player, year, set, card number, grader and grade.

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

## Not yet done

- **Buy/not-buy is not back.** The best honest model on real repeat sales is
  ROC-AUC 0.72 ± 0.13 with precision ~0.31 — a BUY signal wrong roughly 7 times
  in 10 — and its strongest feature is `buy_year`, i.e. the market cycle, which
  can't extrapolate. Revisit once repeat-sale pairs are in the thousands.
- **Accuracy badges on the marketing pages** still quote v1's numbers ("78% /
  0.87" from synthetic data, "88.9% / 97.5%" from the 89-row rank-matched set).
  Those should be replaced with dataset facts — sales counts and date coverage.
- **Saving valuation lookups to Supabase.** The `predictions` table matches v1's
  shape; storing comps lookups needs a migration. `src/lib/model/types.ts` is
  kept solely so the existing dashboard can read historical rows.
