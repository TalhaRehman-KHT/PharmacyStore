"""Clean one label section's text before splitting (whitespace, leading titles, punctuation)."""

import re

from app.ingest.label import SECTION_MAP

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
    + "|".join(
        re.escape(t).replace(r"\ AND\ ", r"\s+(?:AND|&)\s+").replace(r"\ ", r"\s+") for t in _TITLES
    )
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
