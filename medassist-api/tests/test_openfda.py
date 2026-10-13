"""openFDA downloader. No real network: every request goes to an httpx.MockTransport."""

import json

import httpx
import pytest

from app.ingest.openfda import download, pick_label, queries, slug


def label(generic: str, *, effective: str = "20240101", sections: int = 3, id_: str = "L1") -> dict:
    fields = ["boxed_warning", "indications_and_usage", "adverse_reactions", "drug_interactions"]
    return {
        "id": id_,
        "effective_time": effective,
        "openfda": {"generic_name": [generic.upper()]},
        **{f: ["text"] for f in fields[:sections]},
    }


def mock_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def results(*labels) -> httpx.Response:
    return httpx.Response(200, json={"results": list(labels)})


def test_slug_and_queries():
    assert slug("Amoxicillin and Clavulanate Potassium") == "amoxicillin-and-clavulanate-potassium"
    exact, phrase = queries("acetaminophen")
    assert exact == 'openfda.generic_name.exact:"ACETAMINOPHEN"'
    assert phrase == 'openfda.generic_name:"acetaminophen"'


def test_pick_label_prefers_exact_then_sections_then_newest():
    combo = label("acetaminophen and codeine", sections=4, id_="combo")
    old = label("acetaminophen", effective="20200101", id_="old")
    new = label("acetaminophen", effective="20240101", id_="new")
    few = label("acetaminophen", sections=1, effective="20250101", id_="few")
    assert pick_label([combo, old, new, few], "acetaminophen")["id"] == "new"
    assert pick_label([], "acetaminophen") is None


async def test_downloads_saves_record_and_reports(tmp_path):
    seen = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(dict(req.url.params))
        return results(label("ibuprofen", id_="ibu"))

    async with mock_client(handler) as client:
        r = await download(client, ["ibuprofen"], tmp_path, delay=0)

    assert r.downloaded == ["ibuprofen"] and not r.missing and not r.skipped
    saved = json.loads((tmp_path / "ibuprofen.json").read_text(encoding="utf-8"))
    assert saved["drug"] == "ibuprofen"
    assert saved["label"]["id"] == "ibu"
    assert saved["query"] == 'openfda.generic_name.exact:"IBUPROFEN"'
    assert seen[0]["limit"] == "10" and "api_key" not in seen[0]


async def test_falls_back_to_phrase_search_for_combinations(tmp_path):
    def handler(req: httpx.Request) -> httpx.Response:
        if ".exact:" in req.url.params["search"]:
            return httpx.Response(404, json={"error": {"code": "NOT_FOUND"}})
        return results(label("amoxicillin and clavulanate potassium"))

    async with mock_client(handler) as client:
        r = await download(client, ["amoxicillin and clavulanate potassium"], tmp_path, delay=0)

    assert r.downloaded == ["amoxicillin and clavulanate potassium"]
    saved = json.loads((tmp_path / "amoxicillin-and-clavulanate-potassium.json").read_text("utf-8"))
    assert saved["query"].startswith("openfda.generic_name:")


async def test_no_label_is_missing_not_an_error(tmp_path):
    async with mock_client(lambda req: httpx.Response(404)) as client:
        r = await download(client, ["domperidone"], tmp_path, delay=0)

    assert r.missing == ["domperidone"]
    assert not list(tmp_path.glob("*.json"))


async def test_existing_file_is_skipped_unless_forced(tmp_path):
    (tmp_path / "ibuprofen.json").write_text("{}", encoding="utf-8")
    calls = []

    def handler(req):
        calls.append(req)
        return results(label("ibuprofen"))

    async with mock_client(handler) as client:
        skipped = await download(client, ["ibuprofen"], tmp_path, delay=0)
        forced = await download(client, ["ibuprofen"], tmp_path, delay=0, force=True)

    assert skipped.skipped == ["ibuprofen"]
    assert forced.downloaded == ["ibuprofen"]
    assert len(calls) == 1


async def test_retries_rate_limit_and_server_errors(tmp_path):
    replies = iter([httpx.Response(429), httpx.Response(503), results(label("ibuprofen"))])

    async with mock_client(lambda req: next(replies)) as client:
        r = await download(client, ["ibuprofen"], tmp_path, delay=0, retry_wait=0)

    assert r.downloaded == ["ibuprofen"]


async def test_gives_up_after_repeated_server_errors(tmp_path):
    async with mock_client(lambda req: httpx.Response(500)) as client:
        with pytest.raises(httpx.HTTPStatusError):
            await download(client, ["ibuprofen"], tmp_path, delay=0, retry_wait=0)


async def test_api_key_is_sent_but_never_saved(tmp_path):
    keys = []

    def handler(req):
        keys.append(req.url.params.get("api_key"))
        return results(label("ibuprofen"))

    async with mock_client(handler) as client:
        await download(client, ["ibuprofen"], tmp_path, delay=0, api_key="secret-test-key")

    assert keys == ["secret-test-key"]
    assert "secret-test-key" not in (tmp_path / "ibuprofen.json").read_text(encoding="utf-8")


async def test_error_message_never_contains_the_key(tmp_path):
    async with mock_client(lambda req: httpx.Response(500)) as client:
        with pytest.raises(httpx.HTTPStatusError) as err:
            await download(
                client, ["ibuprofen"], tmp_path, delay=0, retry_wait=0, api_key="secret-test-key"
            )

    assert "secret-test-key" not in str(err.value)
