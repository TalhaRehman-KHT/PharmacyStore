"""Escalation scoping through the app: admin/doctor see all; a vendor sees their own pharmacies
plus general questions (pharmacy_id NULL, R13 BUG-R1), never another vendor's pharmacy."""

from datetime import UTC, datetime, timedelta

import pytest

REPLY = {"reply": "Please take it after food and ask your doctor."}


@pytest.fixture
def world(db, make_user):
    """Two vendors with one pharmacy each, plus three pending escalations:
    one at A's pharmacy, one at B's, one general question (pharmacy_id NULL)."""
    customer_id, customer = make_user(name="Ali Khan")
    vendor_a, a_headers = make_user("vendor", name="Vendor A")
    vendor_b, b_headers = make_user("vendor", name="Vendor B")
    pharmacy_a = db.seed("pharmacies", vendor_id=vendor_a, name="A Pharmacy")["id"]
    pharmacy_b = db.seed("pharmacies", vendor_id=vendor_b, name="B Pharmacy")["id"]
    session = db.seed("chat_sessions", user_id=customer_id)["id"]

    def escalation(pharmacy_id, question):
        message = db.seed(
            "chat_messages", session_id=session, user_id=customer_id, role="assistant", content="x"
        )
        return db.seed(
            "escalations",
            message_id=message["id"],
            session_id=session,
            user_id=customer_id,
            question=question,
            reason="personal_dosing",
            status="pending",
            pharmacy_id=pharmacy_id,
        )

    return {
        "customer": customer,
        "customer_id": customer_id,
        "a": a_headers,
        "b": b_headers,
        "esc_a": escalation(pharmacy_a, "A question"),
        "esc_b": escalation(pharmacy_b, "B question"),
        "esc_general": escalation(None, "General question"),
    }


def questions(client, headers, status="pending"):
    res = client.get(f"/escalations?status={status}", headers=headers)
    assert res.status_code == 200
    return sorted(e["question"] for e in res.json())


def test_vendor_lists_own_pharmacy_and_general(client, world):
    assert questions(client, world["a"]) == ["A question", "General question"]
    assert questions(client, world["b"]) == ["B question", "General question"]


def test_vendor_cannot_answer_other_vendors_escalation(client, db, world):
    res = client.post(f"/escalations/{world['esc_b']['id']}/reply", json=REPLY, headers=world["a"])

    assert res.status_code == 404
    assert res.json() == {"status": 404, "message": "Escalation not found"}
    row = next(r for r in db.rows("escalations") if r["id"] == world["esc_b"]["id"])
    assert row["status"] == "pending"


def test_vendor_can_answer_own_escalation(client, world):
    res = client.post(f"/escalations/{world['esc_a']['id']}/reply", json=REPLY, headers=world["a"])

    assert res.status_code == 204
    assert questions(client, world["a"], "answered") == ["A question"]
    assert questions(client, world["b"], "answered") == []


def test_any_vendor_can_answer_a_general_question_once(client, world):
    res = client.post(
        f"/escalations/{world['esc_general']['id']}/reply", json=REPLY, headers=world["a"]
    )
    assert res.status_code == 204
    assert questions(client, world["b"], "answered") == ["General question"]

    again = client.post(
        f"/escalations/{world['esc_general']['id']}/reply", json=REPLY, headers=world["b"]
    )
    assert again.status_code == 409


def test_vendor_without_pharmacy_sees_only_general(client, make_user, world):
    _, lonely = make_user("vendor", name="No Pharmacy")
    assert questions(client, lonely) == ["General question"]
    res = client.post(f"/escalations/{world['esc_a']['id']}/reply", json=REPLY, headers=lonely)
    assert res.status_code == 404
    assert client.get("/insights", headers=lonely).json() == {
        "unhelpfulLast7Days": 0,
        "pendingCount": 1,
    }


@pytest.mark.parametrize("role", ["admin", "doctor"])
def test_admin_and_doctor_see_and_answer_all(client, make_user, world, role):
    _, headers = make_user(role)

    assert questions(client, headers) == ["A question", "B question", "General question"]
    res = client.post(
        f"/escalations/{world['esc_general']['id']}/reply", json=REPLY, headers=headers
    )
    assert res.status_code == 204


def test_customer_gets_403_on_escalations_and_insights(client, world):
    assert client.get("/escalations", headers=world["customer"]).status_code == 403
    assert client.get("/insights", headers=world["customer"]).status_code == 403


def test_insights_respect_the_scope(client, db, make_user, world):
    recent = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    old = (datetime.now(UTC) - timedelta(days=10)).isoformat()
    uid = world["customer_id"]

    def rate(message_id, rating, created_at):
        db.seed(
            "feedback", message_id=message_id, user_id=uid, rating=rating, created_at=created_at
        )

    rate(world["esc_a"]["message_id"], -1, recent)  # counts for A and for admin
    rate(world["esc_b"]["message_id"], -1, recent)  # counts for B and for admin
    rate(world["esc_general"]["message_id"], -1, old)  # older than 7 days: never counts
    other = db.seed("chat_messages", session_id=world["esc_a"]["session_id"], user_id=uid,
                    role="assistant", content="not escalated")
    rate(other["id"], -1, recent)  # not escalated: only admin/doctor see it
    _, admin = make_user("admin")

    assert client.get("/insights", headers=world["a"]).json() == {
        "unhelpfulLast7Days": 1,
        "pendingCount": 2,  # A + general
    }
    assert client.get("/insights", headers=world["b"]).json() == {
        "unhelpfulLast7Days": 1,
        "pendingCount": 2,  # B + general
    }
    assert client.get("/insights", headers=admin).json() == {
        "unhelpfulLast7Days": 3,
        "pendingCount": 3,
    }


def test_insights_pending_count_drops_after_reply(client, world):
    client.post(f"/escalations/{world['esc_a']['id']}/reply", json=REPLY, headers=world["a"])

    assert client.get("/insights", headers=world["a"]).json()["pendingCount"] == 1  # general left
