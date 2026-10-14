"""app/services/precheck.py keyword rules."""

import pytest

from app.services.precheck import escalation_reason


@pytest.mark.parametrize(
    ("question", "reason"),
    [
        ("Panadol kitni leni hai?", "personal_dosing"),
        ("What DOSE for my son?", "personal_dosing"),
        ("Can I take it while pregnant?", "pregnancy_or_child"),
        ("main hamil hoon, brufen le sakti hoon?", "pregnancy_or_child"),
        ("kitni dose, I am pregnant", "personal_dosing"),  # first rule wins
        ("What are the side effects of amoxicillin?", None),
    ],
)
def test_escalation_reason(question, reason):
    assert escalation_reason(question) == reason
