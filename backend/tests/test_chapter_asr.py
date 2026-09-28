"""Unit tests for new chapter extraction, grade-level simplification, and ASR.

Run: python test_chapter_asr.py
"""

import sys
import unittest
from unittest.mock import MagicMock

from routes.chapter import split_hindi_sentences
from models.pedagogy import GRADE_GUIDANCE, SIMPLIFY_PROMPT


class TestChapterAndVoice(unittest.TestCase):
    def test_hindi_sentence_splitting(self):
        text = "कक्षा दो के बच्चे खेल रहे हैं। गुरुजी पाठ पढ़ाते हैं॥ क्या सब समझ आया? हाँ!"
        sentences = split_hindi_sentences(text)
        self.assertEqual(len(sentences), 4)
        self.assertEqual(sentences[0], "कक्षा दो के बच्चे खेल रहे हैं।")
        self.assertEqual(sentences[1], "गुरुजी पाठ पढ़ाते हैं॥")
        self.assertEqual(sentences[2], "क्या सब समझ आया?")
        self.assertEqual(sentences[3], "हाँ!")

    def test_grade_guidance_all_classes(self):
        for grade in range(1, 6):
            self.assertIn(grade, GRADE_GUIDANCE)
            prompt = SIMPLIFY_PROMPT.format(
                text="किसान खेत में काम करता है।",
                grade_instruction=GRADE_GUIDANCE[grade],
            )
            self.assertIn(f"Class {grade}", prompt)
            self.assertIn("किसान खेत में काम करता है।", prompt)

    def test_empty_sentence_splitting(self):
        self.assertEqual(split_hindi_sentences(""), [])
        self.assertEqual(split_hindi_sentences("   "), [])

    def test_indesign_corruption_detection(self):
        from app.api.chapter import is_usable_text
        # Clean Hindi must be accepted
        clean_text = "फूलों से नित हँसना सीखो, भौंरों से नित गाना।"
        self.assertTrue(is_usable_text(clean_text))

        # Detached matra (e.g. separated U+093F / ि) must be rejected for OCR fallback
        corrupted_matra = "फू लों से नित हसँ िा सीखो, भौंरों से नित गािा।"
        self.assertFalse(is_usable_text(corrupted_matra))

        # Halant followed by whitespace must be rejected
        corrupted_halant = "पथृ वी से सीखो प् ाणी की, सच्ी सेवा करिा।"
        self.assertFalse(is_usable_text(corrupted_halant))

        # InDesign metadata line must be rejected
        corrupted_metadata = "Unit 1 1 to 45.indd 1 30-Sep-25 12:47:43 PM Reprint 2026-27"
        self.assertFalse(is_usable_text(corrupted_metadata))

    def test_metadata_filtering(self):
        from app.api.chapter import clean_and_unwrap_text
        raw = (
            "फूलों से नित हँसना सीखो।\n"
            "Unit 1 1 to 45.indd 2 30-Sep-25 12:47:44 PM\n"
            "Reprint 2026-27\n"
            "तरु की झुकी डालियों से नित शीश झुकाना।\n"
        )
        cleaned = clean_and_unwrap_text(raw)
        self.assertNotIn("Unit 1", cleaned)
        self.assertNotIn(".indd", cleaned)
        self.assertNotIn("Reprint", cleaned)
        self.assertIn("फूलों से नित हँसना सीखो।", cleaned)
        self.assertIn("तरु की झुकी डालियों से नित शीश झुकाना।", cleaned)

    def test_unicode_escape_residue_sanitization(self):
        from app.translation.validation import sanitize_script_leakage
        # Santali Ol Chiki with leaked Devanagari nukta representations
        s1 = "ᱤᱱᱜᱮᱴᱫᱩᱱᱩᱞ ᱠᱷᱚᱱ ᱥᱮᱪ ᱦᱟᱛᱟᱣ ᱢᱮ u093C"
        s2 = "ᱫᱟᱯᱨᱟᱢ ᱠᱷᱚᱱ ᱥᱮᱪ ᱢᱮ ü093C"
        s3 = "ᱫᱟᱯᱨᱟᱢ ᱠᱷᱚᱱ ᱥᱮᱪ ᱢᱮ \\u093C"
        s4 = "ᱫᱟᱯᱨᱟᱢ ᱠᱷᱚᱱ ᱥᱮᱪ ᱢᱮ \u093C"

        self.assertEqual(sanitize_script_leakage(s1, "sat"), "ᱤᱱᱜᱮᱴᱫᱩᱱᱩᱞ ᱠᱷᱚᱱ ᱥᱮᱪ ᱦᱟᱛᱟᱣ ᱢᱮ")
        self.assertEqual(sanitize_script_leakage(s2, "sat"), "ᱫᱟᱯᱨᱟᱢ ᱠᱷᱚᱱ ᱥᱮᱪ ᱢᱮ")
        self.assertEqual(sanitize_script_leakage(s3, "sat"), "ᱫᱟᱯᱨᱟᱢ ᱠᱷᱚᱱ ᱥᱮᱪ ᱢᱮ")
        self.assertEqual(sanitize_script_leakage(s4, "sat"), "ᱫᱟᱯᱨᱟᱢ ᱠᱷᱚᱱ ᱥᱮᱪ ᱢᱮ")


if __name__ == "__main__":
    unittest.main()
