"""Section-aware chunking of FDA labels (data/raw/*.json -> data/chunks/chunks.jsonl).

Each openFDA field (boxed_warning, dosage_and_administration, ...) becomes its own chunks, so a
chunk never mixes two sections. Long sections are cut at paragraphs, then sentences, then spaces,
never inside a word. Why it is built this way: .local/LEARNING.md "Chunker".
"""

import json
import re
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

# Label structure and cleaning live in label.py / clean.py; imported here (callers and tests
# keep importing them from chunker).
from app.ingest.clean import clean_text
from app.ingest.label import SECTION_MAP, Chunk, DocMeta, doc_meta, header, section_text  # noqa: F401
from app.paths import DATA_DIR

MAX_CHARS = 1200  # whole chunk, header included
BODY_CHARS = 1000  # body text per chunk, so header + body stays under MAX_CHARS
OVERLAP_CHARS = 150  # repeated at the start of the next chunk of the same section

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


def _old_rows(path: Path) -> dict[str, list[dict]]:
    """Rows of an existing chunks.jsonl grouped by drug_name ({} when there is no file)."""
    rows: dict[str, list[dict]] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                rows.setdefault(row["drug_name"], []).append(row)
    return rows


def run(
    raw_dir: Path | None = None, out_dir: Path | None = None, only: list[str] | None = None
) -> dict:
    """CLI entry: data/raw/*.json -> data/chunks/chunks.jsonl + data/chunk_report.md.

    `only` = re-chunk just these drugs; every other drug keeps its rows from the existing file
    unchanged (same text = same cache key, so it costs no embedding quota).
    """
    raw_dir = raw_dir or DATA_DIR / "raw"
    out_dir = out_dir or DATA_DIR / "chunks"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "chunks.jsonl"
    wanted = None if only is None else {d.strip().lower() for d in only if d.strip()}
    old = {} if wanted is None else _old_rows(out_file)

    per_section: Counter = Counter()
    sizes: list[int] = []
    docs = 0
    lines: list[str] = []
    for path in sorted(raw_dir.glob("*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        docs += 1
        drug = record["drug"]
        if wanted is not None and drug.lower() not in wanted and drug in old:
            rows = old[drug]
        else:
            meta = asdict(doc_meta(record))
            rows = [{"document": meta, **asdict(c)} for c in chunk_label(record)]
        for row in rows:
            lines.append(json.dumps(row, ensure_ascii=False) + "\n")
            per_section[row["section"]] += 1
            sizes.append(len(row["content"]))
    out_file.write_text("".join(lines), encoding="utf-8")

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
