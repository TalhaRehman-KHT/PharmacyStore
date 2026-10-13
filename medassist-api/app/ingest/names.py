"""Turn free-text medicine names from the shop into clean US generic names.

"Paracetamol 500mg Tablets" -> ["acetaminophen"];
"Amoxicillin + Clavulanic Acid 625 mg" -> ["amoxicillin", "clavulanate"].
"""

import csv
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

US_NAMES_CSV = Path(__file__).resolve().parents[2] / "data" / "us_names.csv"

_BRACKETS = re.compile(r"\([^)]*\)|\[[^\]]*\]")
_UNIT = r"(?:mcg|mg|g|kg|ml|l|iu|i\.u\.|units?|%|dose|doses|puffs?)"
_STRENGTH = re.compile(
    rf"\d+(?:[.,]\d+)?\s*{_UNIT}(?:\s*/\s*\d*(?:[.,]\d+)?\s*{_UNIT})?(?![a-z])"
)
_CONCENTRATION = re.compile(r"\bw\s*/\s*[vw]\b")
_BARE_NUMBER = re.compile(r"\b\d+(?:[.,]\d+)?\b")
_SPLIT = re.compile(r"\s*(?:\+|/|&|,|\band\b|\bwith\b)\s*")
_NON_WORD = re.compile(r"[^a-z0-9\- ]+")

DOSAGE_FORMS = frozenset(
    """
    tablet tablets tab tabs capsule capsules cap caps syrup suspension susp injection injections inj
    cream ointment gel drops drop eye ear nasal inhaler inhalers solution lotion spray
    sachet sachets powder suppository suppositories infusion vial vials ampoule ampoules amp
    oral film coated
    film-coated chewable dispersible effervescent sr xr er cr mr dt ds forte plus elixir emulsion
    granules lozenge lozenges patch topical
    mcg mg ml iu unit units
    """.split()
)

SALT_WORDS = frozenset(
    """
    hydrochloride hcl hydrobromide sodium potassium calcium magnesium maleate mesylate mesilate
    besylate besilate sulfate sulphate citrate tartrate bitartrate fumarate succinate acetate
    phosphate bromide trihydrate monohydrate dihydrate anhydrous
    """.split()
)
# Words that are the drug itself together with a salt ("ferrous sulfate", "zinc sulfate").
_ION_WORDS = frozenset("zinc ferrous ferric iron lithium aluminium aluminum".split())


@lru_cache
def us_name_map() -> dict[str, str]:
    """British/INN name -> US name, from data/us_names.csv (empty if the file is missing)."""
    if not US_NAMES_CSV.exists():
        return {}
    with US_NAMES_CSV.open(encoding="utf-8", newline="") as f:
        return {
            row["name"].strip().lower(): row["us_name"].strip().lower()
            for row in csv.DictReader(f)
            if row.get("name") and row.get("us_name")
        }


def to_us(name: str) -> str:
    """Map one cleaned generic name to its US name (unchanged when there is no difference)."""
    return us_name_map().get(name, name)


def _fold(raw: str) -> str:
    """Lowercase, ASCII-fold and spell 'sulph' the US way."""
    text = raw.replace("µ", "mc").replace("μ", "mc")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return text.lower().replace("sulph", "sulf")


def _strip_noise(text: str) -> str:
    """Remove brackets, strengths and units; keep separators for splitting."""
    text = _BRACKETS.sub(" ", text)
    text = _CONCENTRATION.sub(" ", text)
    text = _STRENGTH.sub(" ", text)
    return _BARE_NUMBER.sub(" ", text)


def _clean_part(part: str) -> str:
    """Drop dosage forms and punctuation, then trailing salts while a real drug word remains."""
    words = [w.strip("-") for w in _NON_WORD.sub(" ", part).split()]
    words = [w for w in words if w and w not in DOSAGE_FORMS]
    while len(words) > 1 and words[-1] in SALT_WORDS:
        rest = words[:-1]
        if all(w in SALT_WORDS or w in _ION_WORDS for w in rest):
            break
        words = rest
    return " ".join(words)


def _dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(i for i in items if i))


def clean_generic(raw: str | None) -> list[str]:
    """Generic name parts as written (INN), without strengths, forms or removable salts."""
    if not raw or not raw.strip():
        return []
    text = _strip_noise(_fold(raw))
    return _dedupe([_clean_part(p) for p in _SPLIT.split(text)])


def normalize_generic(raw: str | None) -> list[str]:
    """Generic name parts in US naming, deduped, in their original order."""
    return _dedupe([to_us(p) for p in clean_generic(raw)])


def clean_label(raw: str | None) -> str:
    """A product name without strength and form, kept whole ("Augmentin 625mg" -> "augmentin")."""
    if not raw or not raw.strip():
        return ""
    text = _strip_noise(_fold(raw))
    words = [w.strip("-") for w in _NON_WORD.sub(" ", text).split()]
    return " ".join(w for w in words if w and w not in DOSAGE_FORMS)
