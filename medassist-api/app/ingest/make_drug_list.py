"""Build the drug list for the knowledge base from the shop's own `medicines` table.

Reads only (SELECT id, name, generic_name FROM medicines). Writes, under data/:
- drugs.txt: one unique US generic name per line, sorted, merged with drugs_extra.txt
- synonyms_proposed.csv: brand -> generic rows for review (same columns as public.drug_synonyms)
- drug_report.md: counts, rows without a usable generic, top generic names
"""

from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from supabase import AsyncClient

from app.ingest.names import clean_label, normalize_generic, us_name_map
from app.ingest.synonyms import propose_synonyms, write_synonyms_csv
from app.paths import DATA_DIR
from app.repositories.medicines import fetch_medicines


@dataclass
class DrugListResult:
    """Everything the three output files are written from."""

    total: int = 0
    with_generic: int = 0
    derived: list[tuple[str, list[str]]] = field(default_factory=list)
    not_derived: list[str] = field(default_factory=list)
    counts: Counter = field(default_factory=Counter)
    synonyms: list[tuple[str, str, str, str]] = field(default_factory=list)
    extras: list[str] = field(default_factory=list)
    drugs: list[str] = field(default_factory=list)


def read_extras(path: Path) -> list[str]:
    """Extra drug names from data/drugs_extra.txt (one per line, '#' comments allowed)."""
    if not path.exists():
        return []
    names: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        names.extend(normalize_generic(line.split("#", 1)[0]))
    return list(dict.fromkeys(names))


def build(rows: list[dict], extras: list[str] | None = None) -> DrugListResult:
    """Pure core: medicines rows -> drug list, synonym proposals and report numbers."""
    result = DrugListResult(total=len(rows), extras=list(extras or []))
    by_label: dict[str, list[str]] = {}
    known = set(us_name_map()) | set(us_name_map().values())
    blanks: list[dict] = []

    for row in rows:
        parts = normalize_generic(row.get("generic_name"))
        if not parts:
            blanks.append(row)
            continue
        result.with_generic += 1
        result.counts.update(parts)
        known.update(parts)
        label = clean_label(row.get("name"))
        if label:
            by_label.setdefault(label, parts)

    for row in blanks:
        name = row.get("name") or ""
        parts = by_label.get(clean_label(name))
        if not parts:
            guess = normalize_generic(name)
            parts = guess if guess and all(p in known for p in guess) else None
        if parts:
            result.derived.append((name, parts))
            result.counts.update(parts)
        else:
            result.not_derived.append(name)

    result.synonyms = propose_synonyms(rows)
    result.drugs = sorted(set(result.counts) | set(result.extras))
    return result


def render_report(r: DrugListResult) -> str:
    """Markdown summary for data/drug_report.md."""
    top = sorted(r.counts.items(), key=lambda kv: (-kv[1], kv[0]))[:10]
    lines = [
        "# Drug list report",
        "",
        "| | count |",
        "| --- | --- |",
        f"| medicines total | {r.total} |",
        f"| with generic_name | {r.with_generic} |",
        f"| without generic_name | {r.total - r.with_generic} |",
        f"| - derived from name | {len(r.derived)} |",
        f"| - could not derive | {len(r.not_derived)} |",
        f"| extra drugs (drugs_extra.txt) | {len(r.extras)} |",
        f"| unique drugs (drugs.txt) | {len(r.drugs)} |",
        f"| proposed synonyms | {len(r.synonyms)} |",
        "",
        "## Top 10 generic names",
        "",
        "| generic | medicines |",
        "| --- | --- |",
        *(f"| {name} | {n} |" for name, n in top),
        "",
        "## Derived from the product name (check these)",
        "",
        *(f"- {name} -> {', '.join(parts)}" for name, parts in r.derived),
        "",
        "## No generic name and could not derive (add to drugs_extra.txt if needed)",
        "",
        *(f"- {name}" for name in sorted(r.not_derived)),
        "",
    ]
    return "\n".join(lines)


def write_outputs(r: DrugListResult, data_dir: Path = DATA_DIR) -> None:
    """Write drugs.txt, synonyms_proposed.csv and drug_report.md."""
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "drugs.txt").write_text(
        "".join(f"{d}\n" for d in r.drugs), encoding="utf-8"
    )
    write_synonyms_csv(data_dir / "synonyms_proposed.csv", r.synonyms)
    (data_dir / "drug_report.md").write_text(render_report(r), encoding="utf-8")


async def run(db: AsyncClient, data_dir: Path = DATA_DIR) -> DrugListResult:
    """Fetch, build and write. Returns the result for the CLI summary."""
    rows = await fetch_medicines(db)
    result = build(rows, read_extras(data_dir / "drugs_extra.txt"))
    write_outputs(result, data_dir)
    return result
