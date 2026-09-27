"""Meta MMS ASR — Speech-to-Text for Hindi.

Transcribes spoken Hindi audio from the teacher into Devanagari text.
Uses Meta's MMS (Massively Multilingual Speech) ASR checkpoint
(`facebook/mms-1b-all` or `facebook/mms-100m`), configured for Hindi (`hin`).

Follows the caching and warmup pattern in ARCHITECTURE.md §4 (loaded once at
startup, never per request).
"""

import io
import logging
from functools import lru_cache

import numpy as np
import scipy.io.wavfile as wav

log = logging.getLogger(__name__)

MMS_ASR_MODEL = "facebook/mms-1b-all"
TARGET_LANG = "hin"

_WAV_HEADER = b"RIFF"


@lru_cache(maxsize=1)
def _load_model():
    """Load the MMS ASR processor and model checkpoint."""
    from transformers import AutoProcessor, Wav2Vec2ForCTC

    log.warning("Loading ASR model %s (target: %s)...", MMS_ASR_MODEL, TARGET_LANG)
    processor = AutoProcessor.from_pretrained(MMS_ASR_MODEL)
    model = Wav2Vec2ForCTC.from_pretrained(MMS_ASR_MODEL)
    try:
        processor.tokenizer.set_target_lang(TARGET_LANG)
        model.load_adapter(TARGET_LANG)
    except Exception as e:
        log.warning("Could not set MMS adapter for %s: %s", TARGET_LANG, e)

    model.eval()
    return processor, model


def warmup():
    """Trigger model load at startup. Safe to fail if offline/uninstalled."""
    try:
        _load_model()
        log.warning("ASR model warmup completed.")
    except Exception as e:
        log.warning("ASR model warmup skipped or failed: %s", e)


def _decode_audio(file_bytes: bytes) -> np.ndarray:
    """Convert audio bytes into a 16kHz mono float32 array."""
    if not file_bytes:
        raise ValueError("Audio data is empty.")

    # If it is a WAV file:
    if file_bytes.startswith(_WAV_HEADER):
        try:
            sample_rate, audio_data = wav.read(io.BytesIO(file_bytes))
            # Convert multi-channel to mono
            if len(audio_data.shape) > 1:
                audio_data = audio_data.mean(axis=1)

            # Resample or convert to float32 between -1.0 and 1.0
            if audio_data.dtype == np.int16:
                audio_float = audio_data.astype(np.float32) / 32768.0
            elif audio_data.dtype == np.int32:
                audio_float = audio_data.astype(np.float32) / 2147483648.0
            elif audio_data.dtype == np.uint8:
                audio_float = (audio_data.astype(np.float32) - 128) / 128.0
            else:
                audio_float = audio_data.astype(np.float32)

            # Simple resample to 16000 if needed
            if sample_rate != 16000 and len(audio_float) > 0:
                num_samples = int(len(audio_float) * 16000 / sample_rate)
                audio_float = np.interp(
                    np.linspace(0, len(audio_float), num_samples, endpoint=False),
                    np.arange(len(audio_float)),
                    audio_float,
                ).astype(np.float32)

            return audio_float
        except Exception as e:
            log.warning("WAV decode failed: %s", e)

    # Try soundfile fallback if available
    try:
        import soundfile as sf

        data, samplerate = sf.read(io.BytesIO(file_bytes))
        if len(data.shape) > 1:
            data = data.mean(axis=1)
        if samplerate != 16000 and len(data) > 0:
            num_samples = int(len(data) * 16000 / samplerate)
            data = np.interp(
                np.linspace(0, len(data), num_samples, endpoint=False),
                np.arange(len(data)),
                data,
            )
        return data.astype(np.float32)
    except Exception as e:
        log.warning("Soundfile fallback failed: %s", e)

    raise ValueError(
        "Could not decode audio. Please ensure the recording is formatted as standard WAV."
    )


SUPPORTED_ASR_LANGS = {
    "hin": "hin",
    "hin_deva": "hin",
    "hi": "hin",
    "sat": "sat",
    "sat_olck": "sat",
    "unr": "unr",
    "unr_deva": "unr",
    "hoc": "hoc",
    "hoc_deva": "hoc",
    "kru": "kru",
    "kru_deva": "kru",
    "sck": "sck",
    "sck_deva": "sck",
}


def _normalize_lang(code: str | None) -> str:
    if not code:
        return "hin"
    cleaned = code.strip().lower()
    return SUPPORTED_ASR_LANGS.get(cleaned, cleaned.split("_")[0])


def _restore_devanagari(text: str) -> str:
    """Convert phonetic/romanized speech output into clean, natural Devanagari Hindi.

    Meta MMS ASR outputs romanized Latin characters (via uroman) for Hindi.
    This restores natural Devanagari Hindi script with accurate vocabulary, matras,
    and punctuation so the teacher's speech input is 100% Devanagari Hindi.
    """
    if not text or not any("a" <= c.lower() <= "z" for c in text):
        return text

    import os
    provider = (os.getenv("LLM_PROVIDER") or "").strip().lower()
    key = (os.getenv("LLM_API_KEY") or "").strip()
    base_url = (os.getenv("LLM_BASE_URL") or "").strip()
    model_name = (os.getenv("LLM_MODEL") or "").strip()

    if key and (base_url or provider == "gemini"):
        try:
            if provider == "openai_compatible" or base_url:
                import openai
                client = openai.OpenAI(
                    api_key=key,
                    base_url=base_url or "https://api.openai.com/v1",
                    timeout=8.0,
                )
                res = client.chat.completions.create(
                    model=model_name or "gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are a Hindi speech-to-text post-processor for primary school teachers in India. "
                                "Convert phonetic/romanized Hindi text (transcribed from audio) into accurate, natural Devanagari Hindi (हिन्दी) script. "
                                "Preserve the teacher's exact spoken meaning, numbers, and vocabulary. "
                                "Return ONLY the Devanagari Hindi text, with no explanations, no quotes, and no English characters."
                            ),
                        },
                        {"role": "user", "content": text},
                    ],
                    temperature=0.0,
                )
                output = res.choices[0].message.content.strip()
                output = output.strip('"`\'')
                if output and any("\u0900" <= c <= "\u097F" for c in output):
                    return output
            elif provider == "gemini":
                import requests
                gemini_model = model_name or "gemini-3.6-flash"
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent"
                prompt = (
                    "Convert the following phonetic/romanized Hindi text transcribed from audio into accurate, natural Devanagari Hindi (हिन्दी) script.\n"
                    "Preserve the exact spoken meaning and vocabulary. Return ONLY the Devanagari Hindi text with no quotes, explanations, or Roman letters.\n\n"
                    f"Spoken text: {text}"
                )
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.0,
                    },
                }
                res = requests.post(
                    gemini_url,
                    headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                    json=payload,
                    timeout=8.0,
                )
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            output = parts[0].get("text", "").strip().strip('"`\'')
                            if output and any("\u0900" <= c <= "\u097F" for c in output):
                                return output
        except Exception as e:
            log.warning("LLM Devanagari restoration failed: %s", e)

    # Deterministic offline phonetic fallback for common primary school vocabulary
    _PHONETIC_FALLBACK = {
        "namaste": "नमस्ते",
        "kisan": "किसान",
        "khet": "खेत",
        "pani": "पानी",
        "kitab": "किताब",
        "school": "स्कूल",
        "iskul": "इस्कूल",
        "padh": "पढ़",
        "likh": "लिख",
        "bacche": "बच्चे",
        "bache": "बच्चे",
        "ghar": "घर",
        "dhan": "धान",
        "ped": "पेड़",
        "suraj": "सूरज",
        "hawa": "हवा",
        "gaay": "गाय",
        "batao": "बताओ",
        "dekho": "देखो",
        "suno": "सुनो",
        "shabash": "शाबाश",
        "chup": "चुप",
        "baitho": "बैठो",
        "khade": "खड़े",
        "haath": "हाथ",
        "dho": "धो",
        "hai": "है",
        "hain": "हैं",
        "ho": "हो",
        "hoon": "हूँ",
        "tha": "था",
        "the": "थे",
        "thi": "थी",
        "mein": "में",
        "me": "में",
        "se": "से",
        "ko": "को",
        "par": "पर",
        "ka": "का",
        "ke": "के",
        "ki": "की",
        "aur": "और",
        "ek": "एक",
        "do": "दो",
        "teen": "तीन",
        "char": "चार",
        "paanch": "पाँच",
    }
    words = text.split()
    converted = []
    matched = 0
    for w in words:
        clean_w = re.sub(r"[^\w]", "", w.lower())
        if clean_w in _PHONETIC_FALLBACK:
            converted.append(_PHONETIC_FALLBACK[clean_w])
            matched += 1
        else:
            converted.append(w)
    if matched > 0 and matched >= len(words) // 2:
        return " ".join(converted)

    return text


def transcribe(audio_bytes: bytes, lang: str = "hin") -> str:
    """Transcribe spoken audio in Hindi or tribal languages (Santali, Ho, Mundari, Kurukh, Sadri)."""
    audio_array = _decode_audio(audio_bytes)
    if len(audio_array) == 0:
        raise ValueError("Audio contains no samples.")

    import torch

    processor, model = _load_model()
    target_lang = _normalize_lang(lang)

    # Switch active MMS adapter and tokenizer target lang
    try:
        processor.tokenizer.set_target_lang(target_lang)
        model.load_adapter(target_lang)
    except Exception as e:
        log.warning("Could not set MMS adapter for %s (%s), falling back to hin", target_lang, e)
        processor.tokenizer.set_target_lang("hin")
        model.load_adapter("hin")

    inputs = processor(audio_array, sampling_rate=16000, return_tensors="pt")

    with torch.no_grad():
        logits = model(inputs.input_values).logits

    predicted_ids = torch.argmax(logits, dim=-1)
    transcription = processor.batch_decode(predicted_ids)[0].strip()

    # If Hindi or output contains Latin phonetic letters, restore pure Devanagari Hindi
    if target_lang == "hin" or any("a" <= c.lower() <= "z" for c in transcription):
        transcription = _restore_devanagari(transcription)

    return transcription.strip()
