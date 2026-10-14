"""app/services/precheck.py keyword rules."""

import pytest

from app.services.precheck import escalation_reason


@pytest.mark.parametrize(
    ("question", "reason"),
    [
        # personal dosing (English)
        ("What DOSE for my son?", "personal_dosing"),
        ("How much ibuprofen should I take?", "personal_dosing"),
        ("How many tablets of Panadol can I take in a day?", "personal_dosing"),
        ("How often should I take amoxicillin?", "personal_dosing"),
        ("What dose of cetirizine for my child?", "personal_dosing"),
        ("Tell me the right dosage for me", "personal_dosing"),
        # personal dosing (Roman Urdu)
        ("Panadol kitni leni hai?", "personal_dosing"),
        ("Mujhe azithromycin kitni dose leni chahiye?", "personal_dosing"),
        ("Panadol kitni dafa le sakte hain?", "personal_dosing"),
        ("bachay ko brufen syrup kitna dena hai?", "personal_dosing"),
        ("bachay ko dose kitni deni hai?", "personal_dosing"),
        ("din mein kitni goliyan le sakta hoon?", "personal_dosing"),
        ("kitni dose, I am pregnant", "personal_dosing"),  # first rule wins
        # pregnancy / breastfeeding
        ("Can I take it while pregnant?", "pregnancy_or_child"),
        ("Kya pregnancy mein amlodipine le sakte hain?", "pregnancy_or_child"),
        ("main hamil hoon, brufen le sakti hoon?", "pregnancy_or_child"),
        ("Is metformin safe during breastfeeding?", "pregnancy_or_child"),
        ("Is it ok when breast-feeding?", "pregnancy_or_child"),
        ("bachay ko doodh pilati hoon, panadol le sakti hoon?", "pregnancy_or_child"),
        # general information: answered with RAG
        ("What happens in an atenolol overdose?", None),
        ("What are the symptoms of paracetamol overdose?", None),
        ("What is the usual adult dose of amoxicillin?", None),
        ("How many tablets are in one pack?", None),
        ("Panadol kitni der mein asar karti hai?", None),
        ("ciprofloxacin ke saath doodh pi sakte hain?", None),
        ("What are the side effects of amoxicillin?", None),
        ("Can I take ibuprofen with food?", None),
    ],
)
def test_escalation_reason(question, reason):
    assert escalation_reason(question) == reason
