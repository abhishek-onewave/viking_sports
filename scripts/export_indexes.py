#!/usr/bin/env python3
"""
export_indexes.py — Card Ladder index data -> a static JSON the app ships with.

    python3 scripts/export_indexes.py
    python3 scripts/export_indexes.py --db /path/to/cardladder.db

WHY STATIC JSON RATHER THAN AN API
----------------------------------
The whole payload is five sports and a hundred cards — well under 100 KB. It
changes when the scraper runs, which is daily at most, never per request. So a
bundled JSON means the Indexes tab has no backend, no loading spinner, no cold
start and no failure mode, and it deploys to Vercel with zero infrastructure.

The source database lives in the scraper project and is ~200 MB; shipping a
runtime dependency on it just to serve 100 KB of near-static reference data
would be the wrong trade. Re-run this after each scrape and redeploy.

THREE DATA PROBLEMS FIXED HERE, NOT IN THE DATABASE
---------------------------------------------------
Repairing at export keeps the scraped tables a faithful record of what the site
showed, which is what makes them auditable later.

  1. `variation` duplicates `score` for every row (2347.52 in both). The real
     variation — "Base", "Refractor /250", "Z-Cling" — is chips_json[3].
  2. 89 of 100 titles end in the word "assessment", which is scrape noise from
     the tooltip button next to the title.
  3. "Last Sold", "Value" and "Score" sit inside index_stats_json but are
     card-level figures that leaked in from the panel. They are separated out
     rather than presented as index metrics, because labelling one card's sale
     price as an index statistic would be quietly wrong.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP_ROOT = HERE.parent
DEFAULT_DB = (APP_ROOT.parent.parent / "vk_data_scrap" / "data" / "cardladder"
              / "cardladder.db")
OUT_PATH = APP_ROOT / "src" / "data" / "indexes.json"

# Stats that describe the INDEX. Order matters — it is the display order.
INDEX_STAT_KEYS = [
    "Current Value", "Rate of Growth", "Real Value Change", "Starting Value",
    "Low Value", "High Value", "Average Value", "Total Cards", "Market Cap",
    "# of Sales 24H", "Average Daily Volume", "Low Daily Volume",
    "High Daily Volume",
]
# Present in the JSON but NOT index metrics — see docstring point 3.
CARD_LEVEL_KEYS = ["Last Sold", "Value", "Score"]

TRAILING_NOISE = re.compile(r"\s+assessment\s*$", re.I)


def clean_title(title: str) -> str:
    return TRAILING_NOISE.sub("", str(title or "")).strip()


def parse_money(text) -> float | None:
    """'$158.60k' -> 158600.0, '$5.42b' -> 5.42e9, '19,516' -> 19516.0.

    Returned alongside the original string, never instead of it: the display
    keeps Card Ladder's own formatting, and the number exists only so the UI can
    size a bar or sort a column.
    """
    if text is None:
        return None
    s = str(text).strip().replace("$", "").replace(",", "").replace("+", "")
    if not s or s.lower() in {"—", "-", "no results"}:
        return None
    mult = 1.0
    if s and s[-1].lower() in "kmb":
        mult = {"k": 1e3, "m": 1e6, "b": 1e9}[s[-1].lower()]
        s = s[:-1]
    try:
        return float(s) * mult
    except ValueError:
        return None


def parse_percent(text) -> float | None:
    if text is None:
        return None
    m = re.search(r"([+-]?\d+(?:\.\d+)?)\s*%", str(text))
    return float(m.group(1)) if m else None


def variation_from_chips(chips_raw, fallback) -> str:
    """chips_json[3] is the real variation; the `variation` column is the score."""
    try:
        chips = json.loads(chips_raw) if chips_raw else []
    except (TypeError, json.JSONDecodeError):
        chips = []
    if len(chips) > 3 and isinstance(chips[3], str):
        v = chips[3].strip()
        if v and v.lower() != "no results":
            return v
    return str(fallback or "").strip()


def player_from_chips(chips_raw) -> str:
    try:
        chips = json.loads(chips_raw) if chips_raw else []
    except (TypeError, json.JSONDecodeError):
        return ""
    return chips[0].strip() if chips and isinstance(chips[0], str) else ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(DEFAULT_DB))
    ap.add_argument("--out", default=str(OUT_PATH))
    a = ap.parse_args()

    db = Path(a.db)
    if not db.exists():
        raise SystemExit(f"database not found: {db}\n"
                         f"point --db at the scraper's cardladder.db")

    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row

    sports = []
    for row in con.execute(
            "SELECT sport_slug, sport_name, index_stats_json, updated_at "
            "FROM cl_index_sports ORDER BY sport_name"):
        try:
            raw = json.loads(row["index_stats_json"] or "{}")
        except json.JSONDecodeError:
            raw = {}

        stats = []
        for key in INDEX_STAT_KEYS:
            if key not in raw:
                continue
            display = raw[key]
            stats.append({
                "label": key,
                "display": display,
                "numeric": parse_money(display),
                "percent": parse_percent(display),
            })

        cards = []
        for c in con.execute(
                "SELECT rank, card_id, full_title, grade, variation, last_sold, "
                "value, score, card_url, img_url, chips_json "
                "FROM cl_index_top_cards WHERE sport_slug=? ORDER BY rank",
                (row["sport_slug"],)):
            cards.append({
                "rank": c["rank"],
                "cardId": c["card_id"],
                "title": clean_title(c["full_title"]),
                "player": player_from_chips(c["chips_json"]),
                "grade": (c["grade"] or "").strip(),
                "variation": variation_from_chips(c["chips_json"], ""),
                "lastSold": c["last_sold"],
                "lastSoldNumeric": parse_money(c["last_sold"]),
                "value": c["value"],
                "valueNumeric": parse_money(c["value"]),
                "score": c["score"],
                "scoreNumeric": parse_money(c["score"]),
                "cardUrl": c["card_url"],
                "imgUrl": c["img_url"],
            })

        sports.append({
            "slug": row["sport_slug"],
            "name": row["sport_name"],
            "updatedAt": row["updated_at"],
            "stats": stats,
            # kept, but explicitly NOT index metrics
            "topCardStats": [
                {"label": k, "display": raw[k]} for k in CARD_LEVEL_KEYS if k in raw
            ],
            "cards": cards,
        })

    con.close()

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Card Ladder indexes",
        "sportCount": len(sports),
        "cardCount": sum(len(s["cards"]) for s in sports),
        "sports": sports,
    }

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))

    kb = out.stat().st_size / 1024
    print(f"wrote {out}  ({kb:.0f} KB)")
    print(f"  sports : {len(sports)}  ({', '.join(s['name'] for s in sports)})")
    print(f"  cards  : {payload['cardCount']}")
    print(f"  stats  : {len(sports[0]['stats']) if sports else 0} per sport")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
