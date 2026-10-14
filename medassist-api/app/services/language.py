"""Tell English and Roman Urdu questions apart (no API call).

Used for the fixed texts (escalation, no evidence) and to tell the answer LLM which language to use.
Roman Urdu = Urdu written in Latin letters: it is detected by common Urdu words that are not
English words. One such word is enough; anything else counts as English.
"""

import re
from typing import Literal

Language = Literal["en", "roman_urdu"]

# Common Roman Urdu words (with spelling variants) that never appear in English sentences.
ROMAN_URDU_WORDS = frozenset(
    """
    kya kia kyun kyon kaise kese kaisay kab kahan kitna kitni kitne konsi kaun
    hai hain hoon hota hoti hotay hote tha thi
    nahi nahin nai
    mein mai mujhe mujhay mera meri mere hum humein aap apna apni unhe usay
    ke ki ka ko se sy saath sath liye wala wali walay wale
    kar karo karna karein karen kr sakta sakti sakte saktay chahiye chahye lena leni lein
    doon dun diya aur bhi lekin agar phir
    dawa dawai goli raat subah shaam pait sar dard bukhar khana khane neend doodh paani
    """.split()
)  # English look-alikes (do, use, main, jab, ya, ho, mat) are left out on purpose.
_WORD = re.compile(r"[a-z]+")


def detect_language(text: str) -> Language:
    """'roman_urdu' when the text contains a Roman Urdu word, else 'en'."""
    words = _WORD.findall(text.lower())
    return "roman_urdu" if any(w in ROMAN_URDU_WORDS for w in words) else "en"
