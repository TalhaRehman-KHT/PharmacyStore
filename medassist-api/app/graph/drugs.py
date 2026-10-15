"""Which drugs a question is about, in the names our knowledge base uses.

Two lists from the DB, cached for a few minutes (they change at most once a day):
- drug_synonyms: local brand or generic -> US label name (Panadol -> acetaminophen,
  Augmentin -> "amoxicillin and clavulanate potassium").
- drug_documents.generic_name: the drugs whose FDA label is really loaded (searchable).

A US name rarely equals a loaded name word for word ("metformin hydrochloride" vs "metformin",
"bisoprolol" vs "bisoprolol fumarate"), so names are compared word by word: one must be the
other plus extra words at the end (a salt such as hydrochloride / fumarate / potassium).
"""

import re
import time
from collections.abc import Iterable
from dataclasses import dataclass, field

from app.repositories.knowledge import list_documents, list_synonyms

CACHE_TTL_S = 600.0
_SPLIT = re.compile(r"\s*(?:\+|/|,|\band\b|\bwith\b)\s*")  # parts of a combination name


def _norm(name: str) -> str:
    return " ".join(name.lower().split())


def _parts(name: str) -> list[str]:
    """The drugs of a combination name ("a and b potassium" -> ["a", "b potassium"])."""
    return [p for p in _SPLIT.split(name) if p]


def same_drug(a: str, b: str) -> bool:
    """True when the shorter name is the start of the longer one, word by word."""
    short, long = sorted((a, b), key=len)
    return long == short or long.startswith(short + " ")


@dataclass(frozen=True)
class DrugCatalog:
    synonyms: dict[str, str] = field(default_factory=dict)  # brand/generic (lower) -> US name
    loaded: tuple[str, ...] = ()  # generic names in drug_documents

    def us_name(self, name: str) -> str:
        """US label name of a brand or local generic (Brufen -> ibuprofen), else the name itself."""
        return self.synonyms.get(_norm(name), _norm(name))

    def to_loaded(self, name: str) -> list[str]:
        """The loaded drugs a name stands for (a combination gives several), [] if none."""
        found: list[str] = []
        for part in _parts(self.us_name(name)):
            found += [d for d in self.loaded if same_drug(part, d) and d not in found]
        return found

    def mentioned(self, text: str) -> list[str]:
        """Brands, local generics and loaded names found in `text` as whole words, mapped to their
        US names, in order of appearance ("Brufen aur Panadol" -> ibuprofen, acetaminophen)."""
        low = _norm(text)
        hits: list[tuple[int, str]] = []
        for term in {*self.synonyms, *self.loaded}:
            m = re.search(rf"\b{re.escape(term)}\b", low)
            if m:
                hits.append((m.start(), self.synonyms.get(term, term)))
        out: list[str] = []
        for _, name in sorted(hits):
            if name not in out:
                out.append(name)
        return out

    def unique(self, names: Iterable[str]) -> list[str]:
        """US names without repeats. A single drug already covered by an earlier name is a repeat:
        "metformin" after "metformin hydrochloride", "clavulanate" after
        "amoxicillin and clavulanate potassium"."""
        out: list[str] = []
        for name in filter(None, (self.us_name(n) for n in names)):
            covered = len(_parts(name)) == 1 and any(
                same_drug(name, part) for n in out for part in _parts(n)
            )
            if name not in out and not covered:
                out.append(name)
        return out

    def loaded_of(self, names: Iterable[str]) -> list[str]:
        """All loaded drugs behind `names`, no duplicates, order kept."""
        out: list[str] = []
        for name in names:
            out += [d for d in self.to_loaded(name) if d not in out]
        return out


async def load_catalog(db) -> DrugCatalog:
    """Build the catalog from drug_synonyms + drug_documents (two requests)."""
    synonyms: dict[str, str] = {}
    for row in await list_synonyms(db):
        us = _norm(row["us_name"])
        synonyms[_norm(row["brand_name"])] = us
        synonyms.setdefault(_norm(row["generic_name"]), us)  # paracetamol -> acetaminophen
    loaded = tuple(sorted({_norm(d["generic_name"]) for d in await list_documents(db)}))
    return DrugCatalog(synonyms, loaded)


class CatalogCache:
    """load_catalog at most once per CACHE_TTL_S (one instance per app)."""

    def __init__(self, ttl_s: float = CACHE_TTL_S) -> None:
        self.ttl_s = ttl_s
        self._value: DrugCatalog | None = None
        self._at = 0.0

    async def get(self, db) -> DrugCatalog:
        if self._value is None or time.monotonic() - self._at > self.ttl_s:
            self._value, self._at = await load_catalog(db), time.monotonic()
        return self._value
