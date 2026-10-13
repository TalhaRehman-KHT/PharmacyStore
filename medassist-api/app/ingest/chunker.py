"""Section-aware chunking of FDA labels (data/raw/*.json -> data/chunks/chunks.jsonl).

Each openFDA field (boxed_warning, dosage_and_administration, ...) becomes its own chunks, so a
chunk never mixes two sections. Long sections are cut at paragraphs, then sentences, then spaces,
never inside a word. Why it is built this way: docs/LEARNING.md "Chunker".
"""

import json
import re
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


# ---------- cleaning ----------

# Titles that labels put at the very start of a section ("5 WARNINGS AND PRECAUTIONS", "USES").
# The header line already names the section, so the title is only noise. Longest first, so
# "WARNINGS AND PRECAUTIONS" wins over "WARNINGS".
_TITLES = sorted(
    {t.upper() for t in SECTION_MAP.values()}
    | {
        "INDICATIONS AND USAGE",
        "INDICATIONS",
        "USES",
        "DIRECTIONS",
        "BOXED WARNING",
        "WARNINGS AND CAUTIONS",
        "NURSING MOTHERS",
        "OVERDOSE",
        "HOW SUPPLIED/STORAGE AND HANDLING",
        "STORAGE",
    },
    key=len,
    reverse=True,
)
# Optional section number ("5", "5.1"), then one title in capitals, then a space or the end.
# "AND" may be written "&". A title followed by ":" ("WARNING: BLEEDING RISK") is real content
# and stays, because the title must be followed by whitespace.
_LEADING_TITLE = re.compile(
    r"^\s*(?:\d+(?:\.\d+)*\s+)?(?:"
    + "|".join(re.escape(t).replace(r"\ AND\ ", r"\s+(?:AND|&)\s+").replace(r"\ ", r"\s+")
               for t in _TITLES)
    + r")(?=\s|$)"
)
_SPACES = re.compile(r"[ \t\r\f\v]+")
# openFDA writes "( 5.1 ) ." and "[see ... ] ,"; glue brackets and punctuation back on.
_SPACE_BEFORE_PUNCT = re.compile(r" +([.,;:)\]])")
_SPACE_AFTER_OPEN = re.compile(r"([(\[]) +")


def clean_text(text: str) -> str:
    """Collapse whitespace, drop a leading section number/title, remove empty lines.

    Paragraphs stay separated by exactly one blank line ("\\n\\n"), because the splitter uses
    them as its first (best) place to cut.
    """
    text = _LEADING_TITLE.sub("", text, count=1)
    paragraphs: list[str] = []
    for block in re.split(r"\n\s*\n", text):  # a blank line = a new paragraph
        lines = [_SPACES.sub(" ", line).strip() for line in block.splitlines()]
        block = " ".join(line for line in lines if line)  # single newlines are just wrapping
        block = _SPACE_AFTER_OPEN.sub(r"\1", _SPACE_BEFORE_PUNCT.sub(r"\1", block))
        if block:
            paragraphs.append(block)
    return "\n\n".join(paragraphs)


# ---------- splitting ----------

# A sentence ends at . ! or ? followed by a space and something that can start a sentence.
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9•(\[\"'])")
# Labels have no line breaks, but numbered subsections ("... daily. 5.2 Hypoglycemia ...")
# are natural paragraph starts: a number like 5.2 + a capital word, right after a sentence end.
_SUBSECTION = re.compile(r"(?<=[.!?:)\]])\s+(?=\d{1,2}\.\d{1,2}\s+[A-Z])")
# A "sentence" that ends in one of these is not finished ("e.g. aspirin"): glue it to the next.
_ABBREVIATIONS = ("e.g.", "i.e.", "etc.", "vs.", "approx.", "dr.", "no.", "fig.", "u.s.", "st.")


@dataclass
class _Piece:
    """A unit the packer never cuts: a sentence (or a word-safe slice of a very long one)."""

    text: str
    new_paragraph: bool  # True when it starts a new paragraph (joined with a line break)


def _sentences(paragraph: str) -> list[str]:
    """Split one paragraph into sentences, keeping abbreviations inside their sentence."""
    out: list[str] = []
    for part in _SENTENCE_END.split(paragraph):
        if out and out[-1].lower().endswith(_ABBREVIATIONS):
            out[-1] += " " + part
        else:
            out.append(part)
    return out


def _word_slices(text: str, size: int) -> list[str]:
    """Last resort for a run-on "sentence" (long bullet lists, tables): cut at spaces only."""
    slices: list[str] = []
    while len(text) > size:
        cut = text.rfind(" ", 0, size)
        if cut <= 0:  # one giant "word" (a URL): cut it anyway, it has no meaning to keep
            cut = size
        slices.append(text[:cut].strip())
        text = text[cut:].strip()
    return [*slices, text] if text else slices


def _pieces(body: str) -> list[_Piece]:
    """Paragraphs first; a paragraph that is too long becomes sentences; a sentence that is
    still too long becomes word-safe slices. Slices leave room for the overlap."""
    pieces: list[_Piece] = []
    for paragraph in (p for block in body.split("\n\n") for p in _SUBSECTION.split(block)):
        parts = [paragraph] if len(paragraph) <= BODY_CHARS else _sentences(paragraph)
        first = True
        for part in parts:
            fits = len(part) <= BODY_CHARS
            slices = [part] if fits else _word_slices(part, BODY_CHARS - OVERLAP_CHARS)
            for s in slices:
                pieces.append(_Piece(s, new_paragraph=first))
                first = False
    return pieces


def _join(pieces: list[_Piece]) -> str:
    text = ""
    for p in pieces:
        sep = "\n" if p.new_paragraph else " "
        text = f"{text}{sep}{p.text}" if text else p.text
    return text


def _overlap(chunk: list[_Piece]) -> list[_Piece]:
    """The end of a chunk that is repeated at the start of the next one (~OVERLAP_CHARS).

    Whole sentences when they fit; otherwise the last ~OVERLAP_CHARS of the last sentence,
    starting at a word boundary, so a fact cut at the border is still readable in one chunk.
    """
    tail: list[_Piece] = []
    size = 0
    for p in reversed(chunk):
        if size + len(p.text) > OVERLAP_CHARS:
            break
        tail.insert(0, _Piece(p.text, p.new_paragraph))
        size += len(p.text) + 1
    if tail:
        return tail
    last = chunk[-1].text
    start = last.find(" ", len(last) - OVERLAP_CHARS)
    return [_Piece(last[start:].strip(), False)] if start > 0 else []


def _split(body: str) -> list[str]:
    """Pack pieces into chunk bodies of at most BODY_CHARS, each starting with an overlap."""
    if len(body) <= BODY_CHARS:
        return [body]  # short section: one chunk, no cutting at all
    bodies: list[str] = []
    current: list[_Piece] = []
    fresh = 0  # pieces in `current` that are new (not overlap), so every chunk adds something
    for piece in _pieces(body):
        if current and len(_join([*current, piece])) > BODY_CHARS and fresh:
            bodies.append(_join(current))
            current = _overlap(current)
            fresh = 0
            # Drop overlap pieces while the new piece would not fit next to them.
            while current and len(_join([*current, piece])) > BODY_CHARS:
                current.pop(0)
        current.append(piece)
        fresh += 1
    if fresh:
        bodies.append(_join(current))
    return bodies


def _is_heading_only(body: str) -> bool:
    """A "section" that is just a heading with nothing under it ("SUGGESTED USE:", "Drug Facts").

    Such a chunk would match many questions while answering none, so it is skipped.
    Short real answers ("None.", "Systemic fungal infections.") are kept.
    """
    short = len(body.split()) <= 3
    return short and (body.endswith(":") or body.lower() == "drug facts")


def chunk_label(record: dict) -> list[Chunk]:
    """All chunks of one label: boxed_warning first, then SECTION_MAP order.

    Every chunk = header line + "\\n" + body, so it stays under MAX_CHARS.
    Fields that are empty or not in SECTION_MAP give no chunks.
    """
    label = record["label"]
    drug = record["drug"]
    chunks: list[Chunk] = []
    for field_name, section in SECTION_MAP.items():  # dict order = fixed output order
        body = clean_text(section_text(label, field_name))
        if not body or _is_heading_only(body):
            continue
        for i, part in enumerate(_split(body)):
            chunks.append(
                Chunk(
                    label_id=label["id"],
                    drug_name=drug,
                    section=section,
                    chunk_index=i,
                    content=f"{header(drug, section)}\n{part}",
                    metadata={"field": field_name},
                )
            )
    return chunks


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
