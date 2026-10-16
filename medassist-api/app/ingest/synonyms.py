"""Brand -> generic synonym proposals from the shop's `medicines` rows.

Written to data/synonyms_proposed.csv for review (same columns as public.drug_synonyms).
Nothing loads drug_synonyms yet; query expansion uses it in a later stage.
"""

import csv
from pathlib import Path

from app.ingest.names import clean_generic, clean_label, normalize_generic

CSV_HEADER = ["brand_name", "generic_name", "us_name", "source"]


def propose_synonyms(rows: list[dict]) -> list[tuple[str, str, str, str]]:
    """One (brand, generic, us_name, source) row per product not named after its generic."""
    synonyms: dict[tuple[str, str], tuple[str, str, str, str]] = {}
    for row in rows:
        parts = normalize_generic(row.get("generic_name"))
        label = clean_label(row.get("name"))
        if not parts or not label:
            continue
        # A product named after its own generic (e.g. "Paracetamol 500mg") is not a synonym.
        if normalize_generic(row.get("name")) != parts:
            inn = " + ".join(clean_generic(row.get("generic_name")))
            synonyms.setdefault((label, inn), (label, inn, " + ".join(parts), "product_table"))
    return sorted(synonyms.values())


def write_synonyms_csv(path: Path, synonyms: list[tuple[str, str, str, str]]) -> None:
    """Write the proposals with a header row."""
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(CSV_HEADER)
        writer.writerows(synonyms)
