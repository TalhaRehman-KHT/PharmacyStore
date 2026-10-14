"""app/services/language.py detect_language."""

import pytest

from app.services.language import detect_language


@pytest.mark.parametrize(
    ("text", "language"),
    [
        ("Can I take ibuprofen if I am on warfarin?", "en"),
        ("What are the side effects of amoxicillin?", "en"),
        ("Do I use the main dose in the morning?", "en"),  # do / use / main are English
        ("Is alprazolam habit forming?", "en"),
        ("kya brufen se pait mein khoon aa sakta hai?", "roman_urdu"),
        ("ciprofloxacin ke saath doodh pi sakte hain?", "roman_urdu"),
        ("Panadol kitni dose?", "roman_urdu"),
        ("Mujhe neend nahi aati", "roman_urdu"),
    ],
)
def test_detect_language(text, language):
    assert detect_language(text) == language
