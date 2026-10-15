"""Download one FDA drug label per drug from the openFDA API into data/raw/.

Input: data/drugs.txt (one US generic name per line, from `drug-list`).
Output, under data/:
- raw/<slug>.json: {"drug", "query", "downloaded_at", "label"} where label is one openFDA result
- missing.txt: drugs with no US label (local brands such as domperidone are expected here)

Already downloaded drugs are skipped unless force=True, so a re-run costs no requests.
Labels taken by mouth (openfda.route ORAL) are preferred: the shop sells tablets and syrups, so an
eye-drop or injection label of the same drug (ZERVIATE for cetirizine) answers the wrong questions.
Drugs that have no oral label (insulin) fall back to any route.
Without OPENFDA_API_KEY openFDA allows 1000 requests/day and 240/minute, enough for ~66 drugs.
The key is sent as a query parameter and never written to disk or printed.
"""

import asyncio
import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.http_retry import is_retryable
from app.paths import DATA_DIR

LABEL_URL = "https://api.fda.gov/drug/label.json"
CANDIDATES = 10  # labels fetched per query; the best one is kept
ROUTE = "ORAL"  # preferred openfda.route
DELAY_SEC = 0.3  # pause between drugs (stays far below 240 requests/minute)

# Sections that make a label useful for answers; used to rank candidate labels.
USEFUL_FIELDS = (
    "boxed_warning",
    "indications_and_usage",
    "dosage_and_administration",
    "contraindications",
    "warnings_and_cautions",
    "warnings",
    "adverse_reactions",
    "drug_interactions",
    "use_in_specific_populations",
)


@dataclass
class DownloadResult:
    downloaded: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)


def slug(drug: str) -> str:
    """File name for a drug: 'folic acid' -> 'folic-acid'."""
    return re.sub(r"[^a-z0-9]+", "-", drug.lower()).strip("-")


def queries(drug: str, route: str = ROUTE) -> list[str]:
    """openFDA search strings, strictest first; the first two only find labels of `route`.

    1. the whole generic_name equals the drug ("ACETAMINOPHEN"), so combinations are not picked
    2. the drug is a phrase inside generic_name (finds "CETIRIZINE HYDROCHLORIDE" and
       "AMOXICILLIN AND CLAVULANATE POTASSIUM")
    3. + 4. the same without the route filter (a drug that has no oral label, e.g. insulin)
    """
    name = drug.strip().replace('"', "")
    plain = [f'openfda.generic_name.exact:"{name.upper()}"', f'openfda.generic_name:"{name}"']
    return [f'{q} AND openfda.route:"{route}"' for q in plain] + plain


def routes(label: dict) -> list[str]:
    """openfda.route of a label, upper case (["ORAL"], ["OPHTHALMIC"], ...)."""
    return [r.upper() for r in label.get("openfda", {}).get("route", [])]


def _single(generics: list[str]) -> bool:
    """True when no generic name is a combination ("diclofenac sodium/misoprostol")."""
    return not any("/" in g or " and " in g for g in generics)


def _score(label: dict, drug: str, route: str = ROUTE) -> tuple:
    """Rank a candidate: exact generic match, the preferred route, one ingredient, more useful
    sections, then the newest label."""
    generics = [g.lower() for g in label.get("openfda", {}).get("generic_name", [])]
    exact = drug.lower() in generics
    sections = sum(1 for f in USEFUL_FIELDS if label.get(f))
    return (
        exact,
        route in routes(label),
        _single(generics),
        sections,
        label.get("effective_time", ""),
    )


def pick_label(results: list[dict], drug: str) -> dict | None:
    """The best label of one search, or None when there are no results."""
    return max(results, key=lambda r: _score(r, drug)) if results else None


async def search(
    client: httpx.AsyncClient, query: str, api_key: str | None, *, retry_wait: float = 2.0
) -> list[dict]:
    """One openFDA search. A 404 means "no match": an empty list, not an error."""
    params = {"search": query, "limit": CANDIDATES}
    if api_key:
        params["api_key"] = api_key
    async for attempt in AsyncRetrying(
        retry=retry_if_exception(is_retryable),  # a 404 (= no match) is never retried
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=retry_wait, max=30),
        reraise=True,
    ):
        with attempt:
            res = await client.get(LABEL_URL, params=params)
            if res.status_code == 404:
                return []
            if res.is_error:
                # Our own message: httpx's default one contains the full URL, including api_key.
                raise httpx.HTTPStatusError(
                    f"openFDA {res.status_code} for {query!r}", request=res.request, response=res
                )
            return res.json().get("results", [])
    return []  # not reached: tenacity either returns above or re-raises


async def fetch_label(
    client: httpx.AsyncClient, drug: str, api_key: str | None, *, retry_wait: float = 2.0
) -> tuple[str, dict] | None:
    """Try each query until one finds a label. Returns (query, label) or None."""
    for query in queries(drug):
        label = pick_label(await search(client, query, api_key, retry_wait=retry_wait), drug)
        if label:
            return query, label
    return None


def read_drugs(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip() and not line.startswith("#")]


async def download(
    client: httpx.AsyncClient,
    drugs: list[str],
    raw_dir: Path,
    *,
    api_key: str | None = None,
    force: bool = False,
    delay: float = DELAY_SEC,
    retry_wait: float = 2.0,
) -> DownloadResult:
    """Download a label for each drug into raw_dir. Errors other than 'not found' stop the run."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    result = DownloadResult()
    for i, drug in enumerate(drugs):
        target = raw_dir / f"{slug(drug)}.json"
        if target.exists() and not force:
            result.skipped.append(drug)
            continue
        if i and delay:
            await asyncio.sleep(delay)
        found = await fetch_label(client, drug, api_key, retry_wait=retry_wait)
        if not found:
            result.missing.append(drug)
            continue
        query, label = found
        record = {
            "drug": drug,
            "query": query,
            "downloaded_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "label": label,
        }
        target.write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
        result.downloaded.append(drug)
    return result


async def run(
    *,
    api_key: str | None = None,
    force: bool = False,
    limit: int | None = None,
    only: list[str] | None = None,
) -> DownloadResult:
    """CLI entry: data/drugs.txt -> data/raw/*.json + data/missing.txt.
    `only` = just these drugs (a re-download with force); missing.txt is then left as it is."""
    drugs = read_drugs(DATA_DIR / "drugs.txt")[:limit]
    if only is not None:
        wanted = {d.strip().lower() for d in only if d.strip()}
        drugs = [d for d in drugs if d.lower() in wanted]
    async with httpx.AsyncClient(timeout=30) as client:
        result = await download(client, drugs, DATA_DIR / "raw", api_key=api_key, force=force)
    if only is None:
        (DATA_DIR / "missing.txt").write_text(
            "".join(f"{d}\n" for d in sorted(result.missing)), encoding="utf-8"
        )
    return result


def route_report(raw_dir: Path | None = None, route: str = ROUTE) -> list[tuple[str, list[str]]]:
    """(drug, routes) of every saved label whose route is not `route` (read-only, no requests)."""
    out = []
    for path in sorted((raw_dir or DATA_DIR / "raw").glob("*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        found = routes(record["label"])
        if route not in found:
            out.append((record["drug"], found))
    return out
