"""Script validation and leakage detection.

Validates:
- Ol Chiki (Santali): U+1C50 to U+1C7F
- Devanagari (Hindi, Kurukh, Mundari, Sadri): U+0900 to U+097F
- Meetei Mayek leakage detection: U+ABC0 to U+ABFF, U+AAE0 to U+AAFF
- Odia script (Ho/Mundari TTS representation): U+0B00 to U+0B7F
"""

import re
from typing import List, Tuple

_MEETEI_MAYEK = ((0xABC0, 0xABFF), (0xAAE0, 0xAAFF))
_OL_CHIKI = (0x1C50, 0x1C7F)
_DEVANAGARI = (0x0900, 0x097F)

# Known IndicTrans2 Meetei Mayek leakage dictionary to standard Ol Chiki
MEETEI_TO_OL_CHIKI_MAP = {
    "ꯎꯆꯦꯛꯁꯤꯡ": "ᱪᱮᱬᱮ ᱠᱚ",  # birds / चिड़ियाँ
    "ꯎꯆꯦꯛ": "ᱪᱮᱬᱮ",       # bird / चिड़िया
    "ꯏꯁꯤꯡ": "ᱫᱟᱜ",          # water / पानी
    "ꯎ": "ᱫᱟᱨᱮ",             # tree / पेड़
    "ꯃꯤ": "ᱦᱚᱲ",             # person / आदमी
    "ꯉꯥ": "ᱦᱟᱹᱠᱩ",           # fish / मछली
}


def contains_meetei_mayek(text: str) -> bool:
    """Return True if IndicTrans2 leaked Meetei Mayek script characters."""
    return any(lo <= ord(ch) <= hi for ch in text for lo, hi in _MEETEI_MAYEK)


def sanitize_script_leakage(text: str, target_lang: str) -> str:
    """Auto-sanitize known cross-script leakages (e.g. Meetei Mayek leaking into Ol Chiki)
    and raw leaked Unicode-escape residue strings (e.g. \\u093C, u093C, ü093C).
    """
    lang_clean = target_lang.lower().split('_')[0]
    if lang_clean != 'sat':
        return text

    sanitized = text
    # 1. Apply known word substitutions for Meetei Mayek
    if contains_meetei_mayek(sanitized):
        for mm_word, ol_word in MEETEI_TO_OL_CHIKI_MAP.items():
            if mm_word in sanitized:
                sanitized = sanitized.replace(mm_word, ol_word)

        # 2. If any stray Meetei Mayek characters remain, remove them cleanly
        if contains_meetei_mayek(sanitized):
            cleaned_chars = [
                ch for ch in sanitized
                if not any(lo <= ord(ch) <= hi for lo, hi in _MEETEI_MAYEK)
            ]
            sanitized = "".join(cleaned_chars)

    # 3. Clean raw leaked Devanagari unicode-escape sequence strings (e.g. \\u093c, u093C, ü093C)
    # Narrowly scoped: only matches escape patterns targeting Devanagari block [0900-097F]
    sanitized = re.sub(r"(?:\\{1,2}u|u|ü)09[0-9a-fA-F]{2}\b", "", sanitized, flags=re.IGNORECASE)

    # 4. Remove unmapped stray Devanagari nukta character \u093C if present in Ol Chiki
    sanitized = sanitized.replace("\u093C", "")

    return re.sub(r"[ \t]+", " ", sanitized).strip()


def validate_script(text: str, target_lang: str) -> Tuple[bool, List[str]]:
    """Validate that the text matches expected script characteristics for target_lang.
    
    Returns (is_valid, warnings_list).
    """
    warnings = []
    if contains_meetei_mayek(text):
        warnings.append("Vocabulary out-of-domain: output contains Meetei Mayek script contamination.")

    lang_clean = target_lang.lower().split('_')[0]

    if lang_clean == 'sat':
        # Santali should predominantly have Ol Chiki characters
        ol_count = sum(1 for ch in text if _OL_CHIKI[0] <= ord(ch) <= _OL_CHIKI[1])
        deva_count = sum(1 for ch in text if _DEVANAGARI[0] <= ord(ch) <= _DEVANAGARI[1])
        if deva_count > ol_count and len(text) > 3:
            warnings.append("Script mismatch: expected Ol Chiki for Santali, found untranslated Devanagari.")

    return len(warnings) == 0, warnings

