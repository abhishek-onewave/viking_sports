"""
export_comps.py — build the comparable-sales index the app ships with.

    python3 scripts/export_comps.py --db ../vk_data_scrap/data/auction_lots.db

Reads the scraper's SQLite database of REAL auction results and writes a compact
JSON index to public/data/comps.json, plus public/data/comps-meta.json.

WHY A BUNDLED JSON RATHER THAN AN API
-------------------------------------
The whole index is ~1-2 MB uncompressed and well under 500 KB gzipped over the
wire. Bundling it means the app has no backend to run, no database to pay for,
and no cold starts — and every number it shows is a real auction result the user
could look up themselves. Re-run this script after each weekly scrape and
redeploy to refresh.

WHAT IS DEDUCED VS OBSERVED
---------------------------
Nothing here is modelled. Every row is an observed sale: title, price, date,
source, and the parsed identity fields (player / year / set / card # / grader /
grade) that the scraper's normalizer extracted. The app computes medians over
these; it never invents a price.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import Counter
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
PUBLIC_DATA = HERE.parent / "public" / "data"
CARD_NO_RE = re.compile(r"#\s*([A-Za-z]{0,4}-?\d+[A-Za-z]?)\b")

# Only these carry a realized price we can compare against. Hunt gates its
# prices behind a login, so its lots would add titles with no comparable value.
DEFAULT_DB = HERE.parent.parent / "vk_data_scrap" / "data" / "auction_lots.db"


def norm(s: str | None) -> str | None:
    if not s:
        return None
    return re.sub(r"\s+", " ", s).strip().lower() or None


def card_no(title: str | None) -> str | None:
    m = CARD_NO_RE.search(title or "")
    return m.group(1).upper() if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(DEFAULT_DB),
                    help="path to auction_lots.db")
    ap.add_argument("--out", default=str(PUBLIC_DATA))
    a = ap.parse_args()

    db = Path(a.db)
    if not db.exists():
        raise SystemExit(f"database not found: {db}\n"
                         f"point --db at the scraper's data/auction_lots.db")

    out_dir = Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db)
    rows = conn.execute("""
        SELECT title, player, year, set_name, grader, grade, asset_type,
               sale_price, sale_date, source, url
        FROM lots
        WHERE sale_price IS NOT NULL AND sale_price > 0
          AND sale_date IS NOT NULL AND title IS NOT NULL
        ORDER BY sale_date DESC
    """).fetchall()
    print(f"read {len(rows):,} priced sales from {db}")

    lots = []
    for (title, player, year, set_name, grader, grade, asset_type,
         price, date, source, url) in rows:
        lots.append({
            # short keys keep the payload small; see comps-meta.json for the map
            "t": title[:160],
            "p": norm(player),
            "y": int(year) if year else None,
            "s": norm(set_name),
            "c": card_no(title),
            "g": grader,
            "gr": float(grade) if grade is not None else None,
            "a": asset_type,
            "pr": round(float(price), 2),
            "d": str(date)[:10],
            "src": source,
            "u": url,
        })

    index_path = out_dir / "comps.json"
    index_path.write_text(json.dumps({"lots": lots}, separators=(",", ":")))

    dated = [l["d"] for l in lots if l["d"]]
    meta = {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "source_db": str(db),
        "n_sales": len(lots),
        "date_range": [min(dated), max(dated)] if dated else None,
        "by_source": dict(Counter(l["src"] for l in lots)),
        "by_asset_type": dict(Counter(l["a"] or "(unclassified)" for l in lots)),
        "identifiable": {
            "with_player": sum(1 for l in lots if l["p"]),
            "with_grade": sum(1 for l in lots if l["gr"] is not None),
            "with_card_no": sum(1 for l in lots if l["c"]),
            "fully_fingerprinted": sum(
                1 for l in lots
                if l["p"] and l["y"] and l["s"] and l["c"] and l["g"]
                and l["gr"] is not None),
        },
        "key_map": {
            "t": "title", "p": "player", "y": "item year", "s": "set",
            "c": "card number", "g": "grader", "gr": "grade",
            "a": "asset type", "pr": "sale price (USD)", "d": "sale date",
            "src": "auction house", "u": "lot url",
        },
        "notes": [
            "Every row is an observed auction result. No modelled or synthetic "
            "values appear in this file.",
            "Hunt lots are absent: that site gates realized prices behind a "
            "login, so it contributes no comparable prices.",
            "Re-run scripts/export_comps.py after each weekly scrape, then "
            "redeploy, to refresh.",
        ],
    }
    (out_dir / "comps-meta.json").write_text(json.dumps(meta, indent=2))

    size = index_path.stat().st_size
    print(f"wrote {index_path}  ({size/1048576:.2f} MB)")
    print(f"wrote {out_dir/'comps-meta.json'}")
    print(f"  date range        : {meta['date_range'][0]} .. {meta['date_range'][1]}")
    print(f"  fully identifiable: {meta['identifiable']['fully_fingerprinted']:,}")
    for k, v in sorted(meta["by_source"].items(), key=lambda x: -x[1]):
        print(f"    {k:<14}{v:>6,}")


if __name__ == "__main__":
    main()
