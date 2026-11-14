# BOLI — Mother-Tongue Learning & Multilingual Classroom Studio

A modern AI classroom translation, pedagogical adaptation, and multilingual speech synthesis platform for primary schools, supporting **Santali, Kurukh, Ho, Mundari, and Sadri**.

---

## Architecture Overview

```
boli-personal/
├── frontend/                        # React 19 + Vite modern client
│   ├── src/
│   │   ├── components/
│   │   │   ├── motion/              # Framer motion primitives (Tilt, Spotlight, TextLoop)
│   │   │   ├── layout/              # Mascot, Forest atmosphere, Nav, Footers
│   │   │   ├── live/                # Live Classroom interactive ASR echo
│   │   │   ├── flashcards/          # Bilingual interactive vocabulary cards
│   │   │   ├── studio/              # Printable Worksheet & QR generator
│   │   │   └── common/              # AudioPlayer, LanguageChip, CorrectionForm
│   │   ├── screens/                 # Step 1 Capture, Step 2 Languages, Step 3 Result
│   │   ├── services/                # Centralized typed API client
│   │   └── utils/                   # Capabilities, script validation, offline pack
│
├── backend/                         # FastAPI Service (Port 8001)
│   ├── app/
│   │   ├── translation/             # Multi-engine translation core
│   │   │   ├── router.py            # Translation router with script-aware dispatch
│   │   │   ├── segmentation.py      # Unicode paragraph and danda tokenization
│   │   │   ├── validation.py        # Unicode script boundary validator
│   │   │   └── engines/
│   │   │       ├── indictrans.py    # Santali Neural MT (IndicTrans2 Ol Chiki)
│   │   │       ├── kurukh.py        # Kurukh Neural MT (mT5 bidirectional)
│   │   │       └── transfer/        # Ho, Mundari, Sadri linguistic transfer
│   │   ├── speech/                  # Unified TTS and ASR engine wrappers
│   │   │   ├── tts.py               # AI4Bharat Indic Parler-TTS & Meta MMS-TTS
│   │   │   └── asr.py               # Meta MMS-1B ASR engine
│   │   └── core/                    # Normalization, pedagogy prompts, phrase bank
│   └── tests/                       # Complete regression and validation suites
│
├── research/                        # Benchmark probes and model evaluations
└── docs/                            # PRD, Architecture, and Language notes
```

---

## Supported Target Dialects & Engines

| Language | ISO Code | Script | Translation Technology | Spoken Synthesis Engine |
|---|---|---|---|---|
| **Santali** | `sat` | Ol Chiki (`sat_Olck`) | Neural MT (AI4Bharat IndicTrans2) | AI4Bharat Indic Parler-TTS |
| **Kurukh** | `kru` | Devanagari (`kru_Deva`) | Neural MT (Fine-tuned mT5) | Meta MMS-TTS (`mms-tts-kru`) |
| **Ho** | `hoc` | Devanagari (`hoc_Deva`) | Linguistic Transfer Engine | Meta MMS-TTS (`mms-tts-hoc` via Odia mapping) |
| **Mundari** | `unr` | Devanagari (`unr_Deva`) | Linguistic Transfer Engine | Meta MMS-TTS (`mms-tts-unr` via Odia mapping) |
| **Sadri** | `sck` | Devanagari (`sck_Deva`) | Morphological Transfer Engine | Meta MMS-TTS (`mms-tts-sck`) |

---

## Running Locally

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run complete smoke & evaluation test suites
python tests/test_e2e_smoke.py
python tests/test_chapter_asr.py
```

### Frontend
```bash
cd frontend
npm install
npm test
npm run build
npm run dev
```

---

## Judge & Evaluator Guide

For SIH evaluators, jury panels, and technical reviewers:
- **Comprehensive Viva & Technical Defense:** [VIVA_MANUAL_2026.md](docs/VIVA_MANUAL_2026.md) *(Covers the 22 hardest jury questions, North Munda syntax breakdown, and empirical benchmark data).*
- **System Architecture & Dataflow:** [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Product Requirements & Non-Violable Truthfulness Rules:** [PRD.md](docs/PRD.md) & [RULES.md](docs/RULES.md)
- **Data Dictionary & Schema Specifications:** [DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md)

---

## Product Truthfulness & Linguistic Bounds
1. **Santali and Kurukh** use neural translation models evaluated on unseen test sets.
2. **Ho, Mundari, and Sadri** use deterministic linguistic transfer engines that map regional pronouns, copulas, and verbal aspects. They are not labeled as neural translation.
3. Native speaker validation is pending field verification with tribal educators in Jharkhand.
