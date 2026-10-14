"""eval/naive_answers.py report rendering (no network)."""

from eval.naive_answers import Row, read_rows, render


def test_reads_every_csv_row():
    rows = read_rows()
    assert len(rows) == 20
    assert {r.language for r in rows} == {"en", "roman_urdu"}


def test_render_table_and_answers():
    cited = Row(
        "Is Panadol safe?",
        "en",
        "acetaminophen",
        "Warnings",
        status=200,
        answer="Yes [1].\n\nDisclaimer.",
        route="knowledge",
        latency_ms=900,
        tokens=2000,
        citations=[{"n": 1, "drug": "acetaminophen", "section": "Warnings", "url": "u"}],
    )
    failed = Row("q2", "roman_urdu", "aspirin", "Warnings", status=500, answer="(HTTP 500: x)")

    md = render([cited, failed])

    assert "answered: 1" in md and "expected drug cited: 1/1" in md
    assert "| 1 | en | Is Panadol safe? | knowledge | yes | [1] acetaminophen / Warnings |" in md
    assert "| 2 | roman_urdu | q2 | 500 | no | - | - | - |" in md
    assert "> Yes [1].\n>\n> Disclaimer." in md
    assert "- [1] acetaminophen / Warnings: u" in md
