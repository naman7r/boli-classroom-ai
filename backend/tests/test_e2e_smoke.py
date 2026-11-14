"""End-to-end smoke test covering all BOLI platform endpoints and pipelines."""

import io
import os
import sys
import wave
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_full_smoke():
    print("\n--- 1. Health & Languages ---")
    h = client.get("/health")
    assert h.status_code == 200
    assert h.json()["ok"] is True
    print("  [OK] /health:", h.json())

    langs = client.get("/languages")
    assert langs.status_code == 200
    assert len(langs.json()) == 5
    print("  [OK] /languages returned 5 active languages")

    print("\n--- 2. Translation & Translation+TTS Across All 5 Languages ---")
    targets = [
        ("sat_Olck", "sat", "Santali (Neural MT)"),
        ("kru_Deva", "kru", "Kurukh (Neural MT)"),
        ("unr_Deva", "unr", "Mundari (Linguistic Transfer)"),
        ("hoc_Deva", "hoc", "Ho (Linguistic Transfer)"),
        ("sck_Deva", "sck", "Sadri (Morphological Transfer)"),
    ]
    test_sentence = "किसान खेत में धान उगाता है।"

    for tgt_code, iso_code, label in targets:
        # A. Translation
        t_res = client.post("/translate", json={"text": test_sentence, "target": tgt_code})
        assert t_res.status_code == 200, f"Translate failed for {tgt_code}: {t_res.text}"
        t_data = t_res.json()
        assert t_data["translation"] and len(t_data["translation"].strip()) > 0
        print(f"  [OK] /translate -> {label}: {t_data['translation'][:40]}... (mode: {t_data['mode']})")

        # B. Direct Speak
        spk_res = client.post("/speak", json={"text": t_data["translation"], "lang": iso_code})
        assert spk_res.status_code == 200, f"Speak failed for {iso_code}: {spk_res.text}"
        assert spk_res.headers["content-type"] == "audio/wav"
        assert spk_res.content.startswith(b"RIFF")
        print(f"  [OK] /speak -> {iso_code}: {len(spk_res.content)} bytes of WAV")

        # C. Translate-and-speak
        tas_res = client.post("/translate-and-speak", json={"text": test_sentence, "target": tgt_code})
        assert tas_res.status_code == 200, f"Translate-and-speak failed for {tgt_code}: {tas_res.text}"
        tas_data = tas_res.json()
        assert tas_data["audio_url"] is not None
        assert tas_data["duration_seconds"] > 0
        print(f"  [OK] /translate-and-speak -> {tgt_code}: audio_url={tas_data['audio_url']} (duration={tas_data['duration_seconds']}s)")

        # Verify static audio serving
        stat_res = client.get(tas_data["audio_url"])
        assert stat_res.status_code == 200
        assert stat_res.content.startswith(b"RIFF")

    print("\n--- 3. Chapter Extraction ---")
    chapter_sample = "पेड़ हमें ताज़ी हवा देते हैं। नदियाँ हमें पानी देती हैं॥"
    ch_res = client.post("/chapter/extract", files={"file": ("test_ch.txt", chapter_sample.encode("utf-8"), "text/plain")})
    assert ch_res.status_code == 200
    ch_data = ch_res.json()
    assert ch_data["count"] == 2
    print(f"  [OK] /chapter/extract split {ch_data['count']} sentences successfully")

    print("\n--- 4. Pedagogical Simplification ---")
    simp_res = client.post("/simplify", json={"text": "किसान खेत में कठिन परिश्रम करके गेहूं की फसल काटता है।", "grade": 2, "fallback": True})
    assert simp_res.status_code == 200
    print("  [OK] /simplify (Grade 2):", simp_res.json())

    print("\n--- 5. Lessons & Corrections ---")
    les_res = client.post("/lessons", json={"source_text": test_sentence, "source_type": "typed", "languages_requested": ["sat", "kru"]})
    assert les_res.status_code == 200
    les_id = les_res.json()["id"]
    print(f"  [OK] /lessons created lesson ID {les_id}")

    cor_res = client.post("/correct", json={"lesson_id": les_id, "original": test_sentence, "corrected": "किसान खेत में धान उपजाएला।", "lang": "sck"})
    assert cor_res.status_code == 200
    print("  [OK] /correct logged:", cor_res.json())

    cnt_res = client.get("/corrections/count")
    assert cnt_res.status_code == 200
    print(f"  [OK] /corrections/count: {cnt_res.json()['count']}")

    print("\n=======================================================")
    print("      ALL END-TO-END SMOKE TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    test_full_smoke()
