"""GET /escalations and POST /escalations/{id}/reply (scoping: test_escalation_scope.py)."""

from uuid import uuid4

from tests.unit.api.helpers import REPLY, escalate, messages_of, vendor_with_pharmacy


def test_customer_cannot_use_escalations(client, db, make_user):
    _, customer = make_user()
    esc = escalate(db, client, customer)

    assert client.get("/escalations", headers=customer).status_code == 403
    res = client.post(f"/escalations/{esc['id']}/reply", json=REPLY, headers=customer)
    assert res.status_code == 403
    assert db.rows("escalations")[0]["status"] == "pending"


def test_list_escalations_shows_first_name_and_sources(client, db, make_user):
    _, customer = make_user(name="Ali Khan")
    _, vendor, pharmacy_id = vendor_with_pharmacy(db, make_user)
    esc = escalate(db, client, customer, pharmacy_id)
    cited = [{"n": 1, "drug": "paracetamol", "section": "Dosage", "url": "https://x.test"}]
    next(m for m in db.rows("chat_messages") if m["id"] == esc["message_id"])["citations"] = cited

    res = client.get("/escalations", headers=vendor)

    assert res.status_code == 200
    [item] = res.json()
    assert item["id"] == esc["id"]
    assert item["customerFirstName"] == "Ali"
    assert item["question"] == "Mujhe kitni dose leni chahiye?"
    assert item["reason"] == "personal_dosing"
    assert item["status"] == "pending"
    assert item["sources"] == cited
    assert "reply" not in item
    assert client.get("/escalations?status=answered", headers=vendor).json() == []


def test_reply_answers_and_adds_pharmacist_message(client, db, make_user):
    customer_id, customer = make_user()
    vendor_id, vendor, pharmacy_id = vendor_with_pharmacy(db, make_user)
    esc = escalate(db, client, customer, pharmacy_id)

    res = client.post(f"/escalations/{esc['id']}/reply", json=REPLY, headers=vendor)

    assert res.status_code == 204
    row = db.rows("escalations")[0]
    assert (row["status"], row["pharmacist_id"], row["reply"]) == (
        "answered",
        vendor_id,
        REPLY["reply"],
    )
    reply_msg = messages_of(db, esc["session_id"])[-1]
    assert (reply_msg["role"], reply_msg["user_id"]) == ("pharmacist", customer_id)
    answered = client.get("/escalations?status=answered", headers=vendor).json()
    assert [e["reply"] for e in answered] == [REPLY["reply"]]


def test_second_reply_returns_409(client, db, make_user):
    _, customer = make_user()
    _, vendor, pharmacy_id = vendor_with_pharmacy(db, make_user)
    _, admin = make_user("admin")
    esc = escalate(db, client, customer, pharmacy_id)
    url = f"/escalations/{esc['id']}/reply"
    client.post(url, json=REPLY, headers=vendor)

    res = client.post(url, json={"reply": "A different answer entirely."}, headers=admin)

    assert res.status_code == 409
    assert res.json() == {"status": 409, "message": "Escalation already answered"}
    assert db.rows("escalations")[0]["reply"] == REPLY["reply"]


def test_reply_to_unknown_escalation_returns_404(client, make_user):
    _, vendor = make_user("vendor")

    res = client.post(f"/escalations/{uuid4()}/reply", json=REPLY, headers=vendor)

    assert res.status_code == 404
    assert res.json() == {"status": 404, "message": "Escalation not found"}
