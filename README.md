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
# Run test suite
python tests/test_router.py
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

## Honest Product Truthfulness Policy
1. **Santali & Kurukh** utilize deep neural models trained on parallel corpora.
2. **Ho, Mundari, and Sadri** utilize linguistic transfer engines reflecting authentic regional pronouns, copulas, and verbal aspects. They are never falsely labeled as end-to-end neural translation.
3. No native speaker validation is claimed until certified by tribal educators in the field.
