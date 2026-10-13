"""Section-aware chunking of FDA labels (data/raw/*.json -> data/chunks/chunks.jsonl).

The scaffold (section map, metadata, CLI) is ready. `clean_text` and `chunk_label` are written
in R15 (see prompts/run/chunker-guide.md); until then tests/test_chunker.py fails on purpose.
"""

import json
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path

from app.ingest.make_drug_list import DATA_DIR

MAX_CHARS = 1200  # whole chunk, header included
BODY_CHARS = 1000  # body text per chunk, so header + body stays under MAX_CHARS
OVERLAP_CHARS = 150  # repeated at the start of the next chunk of the same section

# openFDA field -> section title, in output order (boxed_warning always first).
# Old-format labels use "warnings"/"precautions"; new ones use "warnings_and_cautions".
SECTION_MAP: dict[str, str] = {
    "boxed_warning": "Boxed Warning",
    "indications_and_usage": "Indications and Usage",
    "dosage_and_administration": "Dosage and Administration",
    "dosage_forms_and_strengths": "Dosage Forms and Strengths",
    "contraindications": "Contraindications",
    "warnings_and_cautions": "Warnings and Precautions",
    "warnings": "Warnings",
    "precautions": "Precautions",
    "adverse_reactions": "Adverse Reactions",
    "drug_interactions": "Drug Interactions",
    "use_in_specific_populations": "Use in Specific Populations",
    "pregnancy": "Pregnancy",
    "nursing_mothers": "Lactation",
    "pediatric_use": "Pediatric Use",
    "geriatric_use": "Geriatric Use",
    "overdosage": "Overdosage",
    "mechanism_of_action": "Mechanism of Action",
    "clinical_pharmacology": "Clinical Pharmacology",
    "how_supplied": "How Supplied",
    "storage_and_handling": "Storage and Handling",
}


@dataclass
class DocMeta:
    """One drug_documents row."""

    label_id: str
    generic_name: str
    brand_names: list[str] = field(default_factory=list)
    source_url: str | None = None
    effective_date: str | None = None  # YYYY-MM-DD


@dataclass
class Chunk:
    """One drug_chunks row (without the embedding)."""

    label_id: str
    drug_name: str
    section: str
    chunk_index: int  # 0, 1, 2 ... within one section
    content: str  # header line + body text
    metadata: dict = field(default_factory=dict)


def header(drug_name: str, section: str) -> str:
    """First line of every chunk, so the embedding knows the drug and the section."""
    return f"Drug: {drug_name} | Section: {section}"


def section_text(label: dict, field_name: str) -> str:
    """Text of one openFDA field (stored as a list of strings), joined as paragraphs."""
    value = label.get(field_name)
    if not value:
        return ""
    parts = value if isinstance(value, list) else [value]
    return "\n\n".join(str(p).strip() for p in parts if str(p).strip())


def doc_meta(record: dict) -> DocMeta:
    """drug_documents fields from a data/raw/<drug>.json record."""
    label = record["label"]
    openfda = label.get("openfda", {})
    set_id = label.get("set_id") or (openfda.get("spl_set_id") or [None])[0]
    effective = label.get("effective_time") or ""
    return DocMeta(
        label_id=label["id"],
        generic_name=record["drug"],
        brand_names=sorted({b.strip() for b in openfda.get("brand_name", []) if b.strip()}),
        source_url=f"https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid={set_id}"
        if set_id
        else None,
        effective_date=f"{effective[:4]}-{effective[4:6]}-{effective[6:8]}"
        if len(effective) >= 8
        else None,
    )


def clean_text(text: str) -> str:
    """Collapse whitespace, drop a leading section number/title, remove empty lines (R15)."""
    raise NotImplementedError("clean_text is written in R15 (prompts/run/chunker-guide.md)")


def chunk_label(record: dict) -> list[Chunk]:
    """All chunks of one label: boxed_warning first, then SECTION_MAP order. Written in R15."""
    raise NotImplementedError("chunk_label is written in R15 (prompts/run/chunker-guide.md)")


def run(raw_dir: Path | None = None, out_dir: Path | None = None) -> dict:
    """CLI entry: data/raw/*.json -> data/chunks/chunks.jsonl + data/chunk_report.md."""
    raw_dir = raw_dir or DATA_DIR / "raw"
    out_dir = out_dir or DATA_DIR / "chunks"
    out_dir.mkdir(parents=True, exist_ok=True)

    per_section: Counter = Counter()
    sizes: list[int] = []
    docs = 0
    with (out_dir / "chunks.jsonl").open("w", encoding="utf-8") as out:
        for path in sorted(raw_dir.glob("*.json")):
            record = json.loads(path.read_text(encoding="utf-8"))
            meta = doc_meta(record)
            docs += 1
            for chunk in chunk_label(record):
                out.write(
                    json.dumps({"document": asdict(meta), **asdict(chunk)}, ensure_ascii=False)
                    + "\n"
                )
                per_section[chunk.section] += 1
                sizes.append(len(chunk.content))

    report = {
        "documents": docs,
        "chunks": len(sizes),
        "per_section": dict(per_section.most_common()),
        "min_chars": min(sizes, default=0),
        "max_chars": max(sizes, default=0),
    }
    lines = [
        "# Chunk report",
        "",
        f"documents: {docs} | chunks: {len(sizes)} | "
        f"chars min {report['min_chars']} / max {report['max_chars']}",
        "",
        "| section | chunks |",
        "| --- | --- |",
        *(f"| {s} | {n} |" for s, n in per_section.most_common()),
    ]
    (DATA_DIR / "chunk_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report
