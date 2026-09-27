"""MMS-TTS wrappers — real speech for Ho, Mundari, Kurukh, Sadri.

Ported from research/sih_2026.ipynb cell 8 (the run that produced the
four working wav files).

Each checkpoint expects a specific script that is undocumented on its
model card — Ho and Mundari were trained on Odia, not the Devanagari
Jharkhand actually writes them in (RULES.md §8). Feeding a checkpoint
the wrong script tokenises to nothing, so that case raises rather than
returning a silent empty wav.
"""

import io
import re
from functools import lru_cache

import numpy as np
import scipy.io.wavfile
import scipy.signal
import torch
from transformers import AutoTokenizer, VitsModel

# Santali uses AI4Bharat Indic Parler-TTS with Ol Chiki script.
# Ho, Mundari, Kurukh, and Sadri use Meta MMS-TTS checkpoints.
MODELS = {
    "sat": "ai4bharat/indic-parler-tts",
    "hoc": "facebook/mms-tts-hoc",
    "unr": "facebook/mms-tts-unr",
    "kru": "facebook/mms-tts-kru",
    "sck": "facebook/mms-tts-sck",
}

# What script each checkpoint was actually trained on — needed to write
# usable phrase-bank text, and to explain the error when input is wrong.
SCRIPTS = {
    "sat": "Ol Chiki",
    "hoc": "Odia",
    "unr": "Odia",
    "kru": "Devanagari",
    "sck": "Devanagari",
}

DEFAULT_SANTALI_SPEAKER = (
    "Arjun's voice is very clear and high quality, spoken at a moderate pace."
)


def _ensure_dac_patched():
    """transformers 4.45.2 has DacModel.decode missing = None on the first positional arg."""
    try:
        from transformers.models.dac.modeling_dac import DacModel

        if not getattr(DacModel, "_boli_patched", False):
            orig_decode = DacModel.decode

            def _patched_decode(
                self,
                quantized_representation=None,
                audio_codes=None,
                return_dict=None,
            ):
                return orig_decode(
                    self,
                    quantized_representation,
                    audio_codes=audio_codes,
                    return_dict=return_dict,
                )

            DacModel.decode = _patched_decode
            DacModel._boli_patched = True
    except Exception:
        pass


def _get_parler_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


@lru_cache(maxsize=1)
def _load_parler_tts():
    """Load once per process lifetime and stay cached (ARCHITECTURE.md §4)."""
    _ensure_dac_patched()
    from parler_tts import ParlerTTSForConditionalGeneration

    primary = MODELS["sat"]
    fallback = "RXD03/indic-parler-tts"

    model = None
    prompt_tok = None
    try:
        model = ParlerTTSForConditionalGeneration.from_pretrained(primary)
        prompt_tok = AutoTokenizer.from_pretrained(primary)
    except Exception:
        model = ParlerTTSForConditionalGeneration.from_pretrained(fallback)
        prompt_tok = AutoTokenizer.from_pretrained(fallback)

    device = _get_parler_device()
    model = model.to(device)
    model.eval()
    desc_model_path = model.config.text_encoder._name_or_path
    desc_tok = AutoTokenizer.from_pretrained(desc_model_path)
    return model, prompt_tok, desc_tok


@lru_cache(maxsize=4)
def _load_mms(lang: str):
    """Load once per language, keep for the process lifetime (ARCHITECTURE.md §4)."""
    ckpt = MODELS[lang]
    model = VitsModel.from_pretrained(ckpt)
    # SIH 2026 Acoustic Mastering for Low-Resource Tribal VITS:
    # 1. Speaking rate 0.78: Deliberate, clear primary school teacher pace (avoids rushed 0.6s chipmunk speech).
    # 2. Noise scale 0.15: Suppresses random latent variance, eliminating metallic rasp and phase jitter.
    # 3. Noise scale duration 0.3: Yields natural, stable phoneme durations.
    # 4. Stochastic duration off: Deterministic duration prediction for crisp syllable boundaries.
    model.speaking_rate = 0.78
    model.noise_scale = 0.15
    model.noise_scale_duration = 0.3
    model.use_stochastic_duration_prediction = False
    model.eval()
    return model, AutoTokenizer.from_pretrained(ckpt)


def warmup(langs=None):
    for lang in langs or MODELS:
        if lang == "sat":
            _load_parler_tts()
        else:
            _load_mms(lang)


def enhance_audio(waveform: np.ndarray, sample_rate: int = 16000) -> tuple[np.ndarray, int]:
    """DSP post-processing pipeline for MMS-TTS checkpoints.

    Meta MMS models (Ho, Mundari, Kurukh, Sadri) produce 16kHz VITS speech
    derived from field recordings, which suffer from high-frequency metallic
    hiss, sub-rumble, and low dynamic presence.

    Mastering Pipeline:
    1. 2nd-order Butterworth bandpass filter (90 Hz high-pass to remove mic thumps/rumble,
       7.0 kHz low-pass to eliminate harsh digital VITS aliasing & hiss).
    2. Warmth & De-hiss EQ: Gentle low-pass smoothing above 4.2 kHz to remove
       field-recording cassette hiss, combined with vocal presence enhancement.
    3. Soft-knee compression / dynamic leveler: np.tanh(smoothed * 1.4) / 1.15
       for rich, full, consistent classroom loudness without harsh clipping.
    4. Anti-aliased sinc polyphase upsampling to 24 kHz for clean browser playback.
    5. Final peak normalization to 0.94 (-0.5 dB headroom).
    """
    if len(waveform) == 0:
        return waveform, sample_rate

    # Ensure float32 in [-1.0, 1.0]
    peak = np.max(np.abs(waveform))
    if peak > 0:
        audio = (waveform / peak).astype(np.float32)
    else:
        audio = waveform.astype(np.float32)

    # 1. Bandpass filter: 90 Hz to 7000 Hz at sample_rate
    try:
        nyquist = sample_rate / 2.0
        low = max(0.001, 90.0 / nyquist)
        high = min(0.95, 7000.0 / nyquist)
        b, a = scipy.signal.butter(2, [low, high], btype="bandpass")
        bandpassed = scipy.signal.filtfilt(b, a, audio)
    except Exception:
        bandpassed = audio

    # 2. De-hiss & Warmth smoothing: tame harsh 4.2kHz VITS rasp while retaining vocal clarity
    try:
        b_shelf, a_shelf = scipy.signal.butter(1, 4200.0 / nyquist, btype="lowpass")
        smoothed = 0.85 * bandpassed + 0.15 * scipy.signal.filtfilt(b_shelf, a_shelf, bandpassed)
    except Exception:
        smoothed = bandpassed

    # 3. Dynamic range compression: soft-knee tanh curve for full, consistent classroom loudness
    compressed = np.tanh(smoothed * 1.4) / 1.15

    # 4. Resample to 24000 Hz using Fourier sinc/polyphase for crisp fidelity
    target_sr = 24000
    try:
        num_samples = int(len(compressed) * target_sr / sample_rate)
        resampled = scipy.signal.resample(compressed, num_samples)
    except Exception:
        resampled = compressed
        target_sr = sample_rate

    # 5. Final peak normalization with headroom (-0.5 dB)
    res_peak = np.max(np.abs(resampled))
    if res_peak > 0:
        norm = (resampled / res_peak) * 0.94
    else:
        norm = resampled

    audio_int16 = (norm * 32767).astype(np.int16)

    # 6. Silence padding (180ms lead-in, 220ms lead-out) with 10ms smooth fade
    # Ensures browser audio contexts and hardware speaker drivers do not clip initial consonants.
    lead_in = np.zeros(int(0.18 * target_sr), dtype=np.int16)
    lead_out = np.zeros(int(0.22 * target_sr), dtype=np.int16)
    fade_len = int(0.01 * target_sr)
    if len(audio_int16) > fade_len * 2:
        fade_in = np.linspace(0, 1, fade_len)
        fade_out = np.linspace(1, 0, fade_len)
        audio_int16[:fade_len] = (audio_int16[:fade_len] * fade_in).astype(np.int16)
        audio_int16[-fade_len:] = (audio_int16[-fade_len:] * fade_out).astype(np.int16)

    audio_int16 = np.concatenate([lead_in, audio_int16, lead_out])
    return audio_int16, target_sr


def deva_to_odia(text: str, target_lang: str = "hoc") -> str:
    """Convert Devanagari text into Odia script for Ho and Mundari MMS-TTS.

    Meta facebook/mms-tts-hoc and facebook/mms-tts-unr checkpoints were trained
    on Odia script tokens. This function maps Devanagari (U+0900..U+097F) to
    Odia (U+0B00..U+0B7F) via standard Unicode offset (+0x0200) and handles
    vowel decompositions, missing graphemes, and language-specific phonological
    substitutions for the checkpoint vocabularies.
    """
    # Strip punctuation unsupported by MMS checkpoints to avoid <unk> glitches
    text = re.sub(r"[!?,:;\"'()\\/\[\]{}]+", " ", text)

    # Specific Devanagari phoneme adaptations for Ho and Mundari
    deva_prep = {
        "\u0908": "\u0907",           # ई -> इ
        "\u090A": "\u0909",           # ऊ -> उ
        "\u090B": "\u0930\u093F",     # ऋ -> रि
        "\u0910": "\u0905\u0907",     # ऐ -> अइ
        "\u0913": "\u0905\u094B",     # ओ -> अो
        "\u0914": "\u0905\u0909",     # औ -> अउ
        "\u0937": "\u0938",           # ष -> स
        "\u0936": "\u0938",           # श -> स (Ho treats sibilants uniformly)
        "\u0943": "\u0941",           # ृ -> ु
        "\u0944": "\u0941",           # ॄ -> ु
    }
    for k, v in deva_prep.items():
        text = text.replace(k, v)

    res = []
    for ch in text:
        cp = ord(ch)
        if 0x0901 <= cp <= 0x094D:
            res.append(chr(cp + 0x0200))
        elif 0x0966 <= cp <= 0x096F:
            res.append(chr(cp + 0x0200))
        elif ch in ("\u0964", "\u0965"):
            res.append(" ")
        else:
            res.append(ch)
    odia_str = "".join(res)

    if target_lang == "hoc":
        # Checkpoint facebook/mms-tts-hoc vocab-specific mappings
        # In Ho phonology, voiced aspirates and unvoiced aspirates are de-aspirated
        # and unmapped Odia consonants map to available checkpoint tokens.
        hoc_map = {
            "\u0B16": "\u0B15",  # ଖ -> କ (kh -> k)
            "\u0B18": "\u0B17",  # ଘ -> ଗ (gh -> g)
            "\u0B1B": "\u0B1A",  # ଛ -> ଚ (ch -> c)
            "\u0B1D": "\u0B1C",  # ଝ -> ଜ (jh -> j)
            "\u0B20": "\u0B1F",  # ଠ -> ଟ (th -> t)
            "\u0B22": "\u0B21",  # ଢ -> ଡ (dh -> d)
            "\u0B25": "\u0B24",  # ଥ -> ତ (th -> t)
            "\u0B27": "\u0B26",  # ଧ -> ଦ (dh -> d)
            "\u0B2B": "\u0B2A",  # ଫ -> ପ (ph -> p)
            "\u0B2D": "\u0B2C",  # ଭ -> ବ (bh -> b)
            "\u0B3C": "",        # nukta dropped
            "\u0B37": "\u0B38",  # ଷ -> ସ
            "\u0B36": "\u0B38",  # ଶ -> ସ
            "\u0B2F": "\u0B5F",  # ଯ -> ୟ (ya glide)
            "\u0B42": "\u0B41",  # ୂ -> ୁ (long u -> short u)
            "\u0B40": "\u0B3F",  # ୀ -> ି (long i -> short i)
            "\u0B48": "\u0B47",  # ୈ -> େ
            "\u0B4C": "\u0B4B",  # ୌ -> ୋ
        }
        for k, v in hoc_map.items():
            odia_str = odia_str.replace(k, v)
    elif target_lang == "unr":
        unr_map = {
            "\u0B33": "\u0B32",  # ଳ -> ଲ
            "\u0B48": "\u0B47",  # ୈ -> େ
            "\u0B4C": "\u0B4B",  # ୌ -> ୋ
            "\u0B42": "\u0B41",  # ୂ -> ୁ
            "\u0B43": "\u0B3F",  # ୃ -> ି
        }
        for k, v in unr_map.items():
            odia_str = odia_str.replace(k, v)

    return odia_str


_TTS_AUDIO_CACHE: dict[tuple[str, str, str], bytes] = {}
_MAX_CACHE_SIZE = 512


def synthesize(text: str, lang: str, speaker_desc: str = None) -> bytes:
    """Return wav bytes. Raises ValueError on an unsupported or unspeakable input."""
    if lang not in MODELS:
        raise ValueError(
            f"No TTS checkpoint exists for '{lang}'. Available: {', '.join(MODELS)}."
        )

    # In-memory fast audio cache lookup (instant response for repeat playback & soundboard)
    cache_key = (lang, text.strip(), speaker_desc or "")
    if cache_key in _TTS_AUDIO_CACHE:
        return _TTS_AUDIO_CACHE[cache_key]

    if lang == "sat":
        model, prompt_tok, desc_tok = _load_parler_tts()
        device = _get_parler_device()
        prompt_inputs = prompt_tok(text, return_tensors="pt").to(device)
        if prompt_inputs["input_ids"].shape[1] == 0:
            raise ValueError(
                f"None of this text is in the {SCRIPTS[lang]} script, so there is nothing to speak."
            )

        description = speaker_desc or DEFAULT_SANTALI_SPEAKER
        desc_inputs = desc_tok(description, return_tensors="pt").to(device)

        # No artificial token limit: Parler-TTS generates whatever is required
        # for the complete text and stops naturally on EOS (up to model's full sequence length).
        with torch.inference_mode():
            generation = model.generate(
                input_ids=desc_inputs.input_ids,
                attention_mask=desc_inputs.attention_mask,
                prompt_input_ids=prompt_inputs.input_ids,
                prompt_attention_mask=prompt_inputs.attention_mask,
                do_sample=True,
                temperature=0.7,
            )

        audio_arr = generation.cpu().numpy().squeeze()
        max_val = np.max(np.abs(audio_arr))
        if max_val > 0:
            audio_norm = audio_arr / max(max_val, 1.0)
        else:
            audio_norm = audio_arr
        audio_int16 = (audio_norm * 32767).astype(np.int16)

        buf = io.BytesIO()
        scipy.io.wavfile.write(
            buf, rate=model.config.sampling_rate, data=audio_int16
        )
        wav_bytes = buf.getvalue()
        if len(_TTS_AUDIO_CACHE) >= _MAX_CACHE_SIZE:
            _TTS_AUDIO_CACHE.pop(next(iter(_TTS_AUDIO_CACHE)))
        _TTS_AUDIO_CACHE[cache_key] = wav_bytes
        return wav_bytes

    # Preprocess Devanagari to Odia script for Ho and Mundari MMS models
    target_text = text
    if lang in ("hoc", "unr"):
        if any(0x0900 <= ord(c) <= 0x097F for c in text):
            target_text = deva_to_odia(text, target_lang=lang)

    # MMS synthesis for hoc, unr, kru, sck
    model, tok = _load_mms(lang)
    words = len(text.strip().split())
    # Pedagogical pacing: deliberate, clear pronunciation for single vocabulary words
    if words <= 3:
        model.speaking_rate = 0.88
    else:
        model.speaking_rate = 1.0

    inputs = tok(target_text, return_tensors="pt")
    if inputs["input_ids"].shape[1] == 0:
        raise ValueError(
            f"None of this text is in the {SCRIPTS[lang]} script that the {lang} "
            "voice was trained on, so there is nothing to speak."
        )

    with torch.inference_mode():
        waveform = model(**inputs).waveform.cpu().float().numpy().squeeze()

    # Apply audio enhancement pipeline: filtering, warmth EQ, compression, anti-aliased 24kHz upsampling
    audio_int16, out_sr = enhance_audio(waveform, sample_rate=model.config.sampling_rate)

    buf = io.BytesIO()
    scipy.io.wavfile.write(buf, rate=out_sr, data=audio_int16)
    wav_bytes = buf.getvalue()
    if len(_TTS_AUDIO_CACHE) >= _MAX_CACHE_SIZE:
        _TTS_AUDIO_CACHE.pop(next(iter(_TTS_AUDIO_CACHE)))
    _TTS_AUDIO_CACHE[cache_key] = wav_bytes
    return wav_bytes
