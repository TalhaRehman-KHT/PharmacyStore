"""Chunker. Scaffold tests pass now; clean_text / chunk_label tests FAIL until R15 writes them.

Contract (prompts/archive/chunker-guide.md) header line on every chunk, at most MAX_CHARS per chunk,
~BODY_CHARS of body with ~OVERLAP_CHARS overlap, boxed_warning first then SECTION_MAP order,
no empty chunks, no chunk ending in the middle of a word.
"""

import json

import pytest

from app.ingest.chunker import (
    MAX_CHARS,
    SECTION_MAP,
    chunk_label,
    clean_text,
    doc_meta,
    header,
    run,
    section_text,
)

SENTENCE = "Patients should be monitored for liver injury during long treatment courses. "


def record(**fields) -> dict:
    label = {
        "id": "label-1",
        "set_id": "set-1",
        "effective_time": "20240315",
        "openfda": {"generic_name": ["IBUPROFEN"], "brand_name": ["Advil", "Motrin", "Advil"]},
        **{k: v if isinstance(v, list) else [v] for k, v in fields.items()},
    }
    return {"drug": "ibuprofen", "query": "q", "label": label}


# ---------- scaffold (passes now) ----------


def test_section_map_starts_with_boxed_warning():
    assert next(iter(SECTION_MAP)) == "boxed_warning"
    assert len(set(SECTION_MAP.values())) == len(SECTION_MAP)


def test_section_text_joins_list_and_skips_empty():
    label = {"warnings": ["First part.", "  ", "Second part."], "empty": []}
    assert section_text(label, "warnings") == "First part.\n\nSecond part."
    assert section_text(label, "empty") == ""
    assert section_text(label, "absent") == ""


def test_doc_meta():
    meta = doc_meta(record())
    assert meta.label_id == "label-1"
    assert meta.generic_name == "ibuprofen"
    assert meta.brand_names == ["Advil", "Motrin"]
    assert meta.effective_date == "2024-03-15"
    assert meta.source_url.endswith("setid=set-1")


def test_header_format():
    assert (
        header("ibuprofen", "Drug Interactions") == "Drug: ibuprofen | Section: Drug Interactions"
    )


# ---------- clean_text / chunk_label (fail until R15) ----------


def test_clean_text_strips_section_number_and_whitespace():
    raw = "5.1 WARNINGS AND PRECAUTIONS\n\n  Risk   of  bleeding.\n\n\n  Take with food. "
    out = clean_text(raw)
    assert not out.startswith("5.1")
    assert "WARNINGS AND PRECAUTIONS" not in out
    assert "Risk of bleeding." in out and "Take with food." in out
    assert "  " not in out
    assert "\n\n\n" not in out


def test_short_section_is_one_chunk_with_header():
    chunks = chunk_label(record(indications_and_usage="Ibuprofen is used for pain and fever."))
    assert len(chunks) == 1
    c = chunks[0]
    assert c.content.startswith("Drug: ibuprofen | Section: Indications and Usage\n")
    assert "used for pain and fever" in c.content
    assert (c.label_id, c.drug_name, c.section, c.chunk_index) == (
        "label-1",
        "ibuprofen",
        "Indications and Usage",
        0,
    )


def numbered_text(paragraphs: int = 12, per_paragraph: int = 4) -> str:
    """~3700 characters; every sentence is unique ("S7 ..."), so overlap can be checked."""
    n = iter(range(paragraphs * per_paragraph))
    return "\n\n".join(
        "".join(f"S{next(n)} {SENTENCE}" for _ in range(per_paragraph)).strip()
        for _ in range(paragraphs)
    )


def test_long_section_is_split_with_limits_and_overlap():
    chunks = chunk_label(record(warnings=numbered_text()))

    assert len(chunks) >= 3
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))
    for c in chunks:
        assert c.content.startswith(header("ibuprofen", "Warnings") + "\n")
        assert len(c.content) <= MAX_CHARS
        body = c.content.split("\n", 1)[1].strip()
        assert body
        assert body[-1] in ".!?"  # split at a sentence end, never inside a word
    # overlap: the last sentence of a chunk is repeated near the start of the next one
    for prev, nxt in zip(chunks, chunks[1:], strict=False):
        last_id = prev.content.rsplit(" S", 1)[1].split(" ", 1)[0]
        assert f"S{last_id} " in nxt.content[:400]
    # nothing is lost: every sentence id appears in some chunk
    everything = " ".join(c.content for c in chunks)
    assert all(f"S{i} " in everything for i in range(48))


def test_boxed_warning_first_then_fixed_order():
    rec = record(
        drug_interactions="Avoid with warfarin.",
        boxed_warning="Serious cardiovascular risk.",
        indications_and_usage="Pain and fever.",
        adverse_reactions="Nausea.",
    )
    sections = [c.section for c in chunk_label(rec)]
    assert sections == [
        "Boxed Warning",
        "Indications and Usage",
        "Adverse Reactions",
        "Drug Interactions",
    ]
    assert [c.section for c in chunk_label(rec)] == sections  # deterministic


def test_empty_and_unknown_sections_give_no_chunks():
    rec = record(warnings="  ", spl_unclassified_section="Not a mapped field.")
    assert chunk_label(rec) == []


def test_run_writes_jsonl_and_report(tmp_path, monkeypatch):
    raw = tmp_path / "raw"
    raw.mkdir()
    rec = record(indications_and_usage="Pain and fever.", warnings="Bleeding risk.")
    (raw / "ibuprofen.json").write_text(json.dumps(rec), encoding="utf-8")
    monkeypatch.setattr("app.ingest.chunker.DATA_DIR", tmp_path)

    report = run(raw, tmp_path / "chunks")

    rows = [
        json.loads(line)
        for line in (tmp_path / "chunks" / "chunks.jsonl").read_text("utf-8").splitlines()
    ]
    assert report["documents"] == 1 and report["chunks"] == len(rows) == 2
    assert rows[0]["document"]["label_id"] == "label-1"
    assert (tmp_path / "chunk_report.md").exists()


def test_heading_only_section_is_skipped_but_short_answer_kept():
    rec = record(
        indications_and_usage="SUGGESTED USE:",
        warnings_and_cautions="Drug Facts",
        contraindications="None.",
    )
    assert [c.section for c in chunk_label(rec)] == ["Contraindications"]


def test_clean_text_keeps_boxed_warning_title_and_fixes_spacing():
    out = clean_text("WARNING: BLEEDING RISK Can cause bleeding [see Warnings ( 5.1 ) ] .")
    assert out == "WARNING: BLEEDING RISK Can cause bleeding [see Warnings (5.1)]."


@pytest.mark.parametrize("field_name", ["warnings_and_cautions", "warnings", "precautions"])
def test_old_and_new_warning_fields_are_both_chunked(field_name):
    chunks = chunk_label(record(**{field_name: "Some warning text."}))
    assert [c.section for c in chunks] == [SECTION_MAP[field_name]]
