"""End-to-end smoke test against a RUNNING API (http://localhost:8000) and the real Supabase.

Run from medassist-api/ (PowerShell):
    $env:SMOKE_CUSTOMER_EMAIL="..."; $env:SMOKE_VENDOR_EMAIL="..."; $env:SMOKE_ADMIN_EMAIL="..."
    python -m scripts.smoke_test

- Looks up the users' ids in public.users (read-only). SMOKE_ADMIN_EMAIL is optional.
- Every question starts with "[smoke]", so every session it creates has that title prefix.
  Those sessions (and their messages, feedback and escalations, by cascade) are deleted at the
  end, also when a step fails. Nothing else is written. Exit code 1 if any step fails.
- Optional SMOKE_API_URL (default http://localhost:8000). Secrets are never printed.
"""

import asyncio
import json
import os
import sys
from dataclasses import dataclass, field

import httpx
from supabase import AsyncClient

from app.config import get_settings
from app.db.client import create_db

PREFIX = "[smoke]"
API = os.environ.get("SMOKE_API_URL", "http://localhost:8000").rstrip("/")
CUSTOMER_ROLES = ("user", "doctor")
REPLY = f"{PREFIX} Please follow the label and ask your doctor about the dose."


class StepFailed(Exception):
    """A check did not hold; the message says what was seen."""


@dataclass
class Report:
    rows: list[tuple[str, str, str]] = field(default_factory=list)

    def add(self, name: str, result: str, detail: str = "") -> None:
        self.rows.append((name, result, detail))
        print(f"{result:<7} {name}" + (f"  ({detail})" if detail else ""), flush=True)

    @property
    def failed(self) -> bool:
        return any(r == "FAIL" for _, r, _ in self.rows)


def expect(condition: bool, detail: str) -> None:
    if not condition:
        raise StepFailed(detail)


async def find_user(db: AsyncClient, env_name: str, roles: tuple[str, ...]) -> dict | None:
    """Active public.users row for the email in env_name with one of roles (one email can have
    one account per role)."""
    email = os.environ.get(env_name, "").strip()
    if not email:
        return None
    res = await (
        db.table("users")
        .select("id, name, role, is_active")
        .eq("email", email)
        .in_("role", list(roles))
        .execute()
    )
    active = [u for u in res.data if u.get("is_active") is not False]
    if not active:
        raise SystemExit(f"{env_name}: no active user with role {'/'.join(roles)} for that email")
    return active[0]


async def vendor_pharmacy(db: AsyncClient, vendor_id: str) -> str | None:
    res = await db.table("pharmacies").select("id").eq("vendor_id", vendor_id).limit(1).execute()
    return res.data[0]["id"] if res.data else None


async def cleanup(db: AsyncClient, customer_id: str) -> int:
    """Delete only this customer's [smoke] sessions; messages, feedback, escalations cascade."""
    res = await (
        db.table("chat_sessions")
        .delete()
        .eq("user_id", customer_id)
        .like("title", f"{PREFIX}%")
        .execute()
    )
    return len(res.data or [])


def parse_sse(text: str) -> list[tuple[str, object]]:
    """Split a full SSE body into (event, json data) pairs."""
    events = []
    for block in text.replace("\r\n", "\n").split("\n\n"):
        name, data = "message", []
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line[6:].strip()
            elif line.startswith("data:"):
                data.append(line[5:].strip())
        if data:
            events.append((name, json.loads("\n".join(data))))
    return events


async def run(http: httpx.AsyncClient, db: AsyncClient, report: Report) -> None:
    customer = await find_user(db, "SMOKE_CUSTOMER_EMAIL", CUSTOMER_ROLES)
    vendor = await find_user(db, "SMOKE_VENDOR_EMAIL", ("vendor",))
    admin = await find_user(db, "SMOKE_ADMIN_EMAIL", ("admin",))
    if customer is None or vendor is None:
        raise SystemExit("Set SMOKE_CUSTOMER_EMAIL and SMOKE_VENDOR_EMAIL (admin optional)")
    as_customer = {"X-User-Id": customer["id"]}
    as_vendor = {"X-User-Id": vendor["id"]}
    as_admin = {"X-User-Id": admin["id"]} if admin else None

    # Who answers: the vendor if they own a pharmacy (the question is asked there), else admin.
    pharmacy_id = await vendor_pharmacy(db, vendor["id"])
    replier = ("vendor", as_vendor) if pharmacy_id else (("admin", as_admin) if admin else None)
    print(
        f"customer role={customer['role']}, vendor has pharmacy={bool(pharmacy_id)}, "
        f"admin={'yes' if admin else 'no'}, replier={replier[0] if replier else 'none'}\n"
    )

    removed = await cleanup(db, customer["id"])  # leftovers of a crashed run
    if removed:
        print(f"(removed {removed} old [smoke] session(s) first)\n")

    state: dict = {}

    async def step(name, fn, needs=()):
        if any(k not in state for k in needs):
            report.add(name, "SKIPPED", "an earlier step failed")
            return
        try:
            detail = await fn()
            report.add(name, "PASS", detail or "")
        except StepFailed as exc:
            report.add(name, "FAIL", str(exc))
        except httpx.HTTPError as exc:
            report.add(name, "FAIL", f"{type(exc).__name__}: {exc}")

    async def health():
        res = await http.get("/health")
        expect(res.status_code == 200 and res.json().get("status") == "ok", f"{res.status_code}")
        return res.json().get("version")

    async def ask_stream():
        # A knowledge question about a LOADED drug (amoxicillin): must come back with citations.
        body = {"question": f"{PREFIX} What are the side effects of amoxicillin?"}
        res = await http.post("/ask/stream", json=body, headers=as_customer)
        expect(res.status_code == 200, f"HTTP {res.status_code}: {res.text[:120]}")
        events = parse_sse(res.text)
        names = [n for n, _ in events]
        expect("error" not in names, f"error event: {events[-1][1]}")
        expect(names and names[0] == "token" and names[-1] == "done", f"events {names}")
        expect({"citations", "meta"} <= set(names), f"events {names}")
        meta = next(d for n, d in events if n == "meta")
        state["session_id"], state["answer_id"] = meta["sessionId"], meta["messageId"]
        citations = next(d for n, d in events if n == "citations")
        expect(meta.get("route") == "knowledge", f"route={meta.get('route')}")
        expect(len(citations) >= 1, "no citations")
        drugs = sorted({c["drug"] for c in citations})
        return (
            f"{names.count('token')} tokens, route={meta.get('route')}, "
            f"{len(citations)} citation(s) {drugs}, {meta.get('latencyMs')} ms"
        )

    async def ask_dose():
        body = {
            "question": f"{PREFIX} Mujhe kitni dose leni chahiye?",
            "sessionId": state["session_id"],
        }
        if pharmacy_id:
            body["pharmacyId"] = pharmacy_id
        res = await http.post("/ask", json=body, headers=as_customer)
        expect(res.status_code == 200, f"HTTP {res.status_code}: {res.text[:120]}")
        meta = res.json()["meta"]
        expect(meta["escalated"] is True, f"escalated={meta['escalated']}")
        expect(meta.get("escalationStatus") == "pending", f"status={meta.get('escalationStatus')}")
        state["dose_message_id"] = meta["messageId"]
        return f"reason={meta.get('escalationReason')}"

    async def sessions():
        res = await http.get("/sessions", headers=as_customer)
        expect(res.status_code == 200, f"HTTP {res.status_code}")
        mine = [s for s in res.json() if s["id"] == state["session_id"]]
        expect(len(mine) == 1, "session not in the list")
        expect(mine[0]["title"].startswith(PREFIX), f"title {mine[0]['title']!r}")
        return mine[0]["title"]

    async def messages():
        res = await http.get(f"/sessions/{state['session_id']}/messages", headers=as_customer)
        expect(res.status_code == 200, f"HTTP {res.status_code}")
        roles = [m["role"] for m in res.json()]
        expect(roles == ["user", "assistant", "user", "assistant"], f"roles {roles}")
        return "2 turns, oldest first"

    async def feedback():
        url = f"/messages/{state['answer_id']}/feedback"
        res = await http.post(url, json={"rating": 1}, headers=as_customer)
        expect(res.status_code == 204, f"HTTP {res.status_code}: {res.text[:120]}")
        res = await http.get(f"/sessions/{state['session_id']}/messages", headers=as_customer)
        rated = next(m for m in res.json() if m["id"] == state["answer_id"])
        expect(rated.get("feedback") == 1, f"feedback={rated.get('feedback')}")
        return "rating 1 stored"

    async def list_escalation():
        expect(replier is not None, "no replier: vendor has no pharmacy and no SMOKE_ADMIN_EMAIL")
        res = await http.get("/escalations?status=pending", headers=replier[1])
        expect(res.status_code == 200, f"HTTP {res.status_code}")
        mine = [e for e in res.json() if e["messageId"] == state["dose_message_id"]]
        expect(len(mine) == 1, f"{replier[0]} does not see the escalation")
        state["escalation_id"] = mine[0]["id"]
        seen = [replier[0]]
        if admin and replier[0] != "admin":
            res = await http.get("/escalations?status=pending", headers=as_admin)
            ids = [e["id"] for e in res.json()]
            expect(state["escalation_id"] in ids, "admin does not see it")
            seen.append("admin")
        return "seen by " + ", ".join(seen)

    async def reply():
        url = f"/escalations/{state['escalation_id']}/reply"
        res = await http.post(url, json={"reply": REPLY}, headers=replier[1])
        expect(res.status_code == 204, f"HTTP {res.status_code}: {res.text[:120]}")
        state["replied"] = True
        return f"by {replier[0]}"

    async def customer_sees_reply():
        res = await http.get(f"/sessions/{state['session_id']}/messages", headers=as_customer)
        msgs = res.json()
        expect(
            any(m["role"] == "pharmacist" and m["content"] == REPLY for m in msgs),
            "no pharmacist message",
        )
        dose = next(m for m in msgs if m["id"] == state["dose_message_id"])
        status = (dose.get("meta") or {}).get("escalationStatus")
        expect(status == "answered", f"escalationStatus={status}")
        return "pharmacist message + status answered"

    async def second_reply():
        url = f"/escalations/{state['escalation_id']}/reply"
        res = await http.post(url, json={"reply": REPLY + " again"}, headers=replier[1])
        expect(res.status_code == 409, f"HTTP {res.status_code}")
        return "409"

    async def customer_forbidden():
        res = await http.get("/escalations", headers=as_customer)
        expect(res.status_code == 403, f"HTTP {res.status_code}")
        return "403"

    async def no_header():
        res = await http.get("/sessions")
        expect(res.status_code == 401, f"HTTP {res.status_code}")
        return "401"

    try:
        await step("GET /health", health)
        await step("customer asks (stream): token..done", ask_stream)
        await step('customer asks "kitni dose": escalated', ask_dose, needs=["session_id"])
        await step("GET /sessions shows the session", sessions, needs=["session_id"])
        await step("GET messages shows both turns", messages, needs=["dose_message_id"])
        await step("feedback on the answer", feedback, needs=["answer_id"])
        await step("staff lists the escalation", list_escalation, needs=["dose_message_id"])
        await step("staff replies", reply, needs=["escalation_id"])
        await step("customer chat shows the reply", customer_sees_reply, needs=["replied"])
        await step("second reply -> 409", second_reply, needs=["replied"])
        await step("customer on /escalations -> 403", customer_forbidden)
        await step("no X-User-Id -> 401", no_header)
    finally:
        removed = await cleanup(db, customer["id"])
        print(
            f"\ncleanup: deleted {removed} [smoke] session(s) (messages, feedback, escalations"
            " cascade)"
        )


async def main() -> int:
    db = await create_db(get_settings())
    report = Report()
    async with httpx.AsyncClient(base_url=API, timeout=60) as http:
        await run(http, db, report)
    counts = {r: sum(1 for _, x, _ in report.rows if x == r) for r in ("PASS", "FAIL", "SKIPPED")}
    print(f"\nPASS {counts['PASS']} | FAIL {counts['FAIL']} | SKIPPED {counts['SKIPPED']}")
    return 1 if report.failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
