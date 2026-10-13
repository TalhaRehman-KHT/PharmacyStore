#!/usr/bin/env python3
"""Run ONE MedAssist SQL file against the live database, safely.

  python -m scripts.run_sql sql/005_seed_synonyms.sql        # dry run: shows the safety check
  python -m scripts.run_sql sql/005_seed_synonyms.sql --yes  # really runs it

Safety:
- refuses any statement that changes a SHOP table or its policies (users, orders, medicines, ...)
- runs the whole file in ONE transaction: any error rolls everything back
- reads DATABASE_URL from the environment or medassist-api/.env and never prints it
After a successful run, re-run `python -m scripts.snapshot_schema` and review the git diff.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
SHOP_TABLES = [
    "users", "otps", "pharmacies", "medicines", "medicine_batches", "orders", "order_items",
    "carts", "cart_items", "prescriptions", "reminders", "reminder_times", "alerts",
    "stock_transactions",
]
_T = r"(?:public\.)?\"?(" + "|".join(SHOP_TABLES) + r")\"?\b"
_IS = re.I | re.S
FORBIDDEN = [
    (re.compile(r"\b(alter|drop|truncate)\s+table\s+(if\s+exists\s+)?(only\s+)?" + _T, re.I),
     "changes a shop table"),
    (re.compile(r"\binsert\s+into\s+" + _T, re.I), "inserts into a shop table"),
    (re.compile(r"\bupdate\s+(only\s+)?" + _T, re.I), "updates a shop table"),
    (re.compile(r"\bdelete\s+from\s+(only\s+)?" + _T, re.I), "deletes from a shop table"),
    (re.compile(r"\b(create|drop|alter)\s+policy\b[^;]*?\bon\s+" + _T, _IS),
     "changes a shop table policy"),
    (re.compile(r"\b(create|drop)\s+trigger\b[^;]*?\bon\s+" + _T, _IS),
     "adds/drops a trigger on a shop table"),
    (re.compile(r"\b(grant|revoke)\b[^;]*?\bon\s+(table\s+)?" + _T, _IS),
     "changes privileges on a shop table"),
    (re.compile(r"\bdrop\s+(schema|database|extension)\b", re.I),
     "drops a schema/database/extension"),
]


def strip_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    return "\n".join(line.split("--", 1)[0] for line in sql.splitlines())


def check(sql: str) -> list[str]:
    body = strip_comments(sql)
    problems = []
    for rx, why in FORBIDDEN:
        for m in rx.finditer(body):
            snippet = " ".join(m.group(0).split())[:90]
            problems.append(f"{why}: {snippet}")
    return problems


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--yes", action="store_true", help="really run it (default is a dry run)")
    args = ap.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        return 2
    sql = path.read_text(encoding="utf-8")
    problems = check(sql)
    print(f"File: {path}  ({len(sql.splitlines())} lines)")
    if problems:
        print("REFUSED. This file touches the existing shop app:")
        for p in problems:
            print("  -", p)
        return 4
    print("Safety check: OK (no shop table, policy or privilege is changed)")
    if not args.yes:
        print("Dry run only. Add --yes to execute it in one transaction.")
        return 0

    load_dotenv(ROOT / ".env")
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set (medassist-api/.env).", file=sys.stderr)
        return 2
    try:
        with psycopg.connect(url, prepare_threshold=None, connect_timeout=15) as conn:
            with conn.transaction():
                conn.execute(sql)
    except psycopg.Error as exc:
        msg = str(exc).strip().splitlines()[0][:300]
        print(f"FAILED and rolled back: {type(exc).__name__}: {msg}", file=sys.stderr)
        return 3
    print("Done: committed. Now run: python -m scripts.snapshot_schema")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
