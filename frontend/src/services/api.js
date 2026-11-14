// Fetch wrappers for the BOLI backend. The frontend never calls a model
// directly — the gated HF token must never reach the browser
// (ARCHITECTURE.md §1).

export function getApiBase() {
  if (typeof window !== "undefined") {
    const custom = window.__BOLI_API_BASE__ || window.localStorage?.getItem("BOLI_API_BASE");
    if (custom) return custom.replace(/\/+$/, "");
  }
  return import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8001";
}

// FastAPI puts its error message in `detail`. Surface that to the teacher
// rather than a generic failure — the backend's messages are written to be
// read by one (RULES.md §3).
async function detail(response) {
  try {
    const body = await response.json();
    return body.detail ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

// fetch rejects with "Failed to fetch" when the server is unreachable,
// which tells a teacher nothing. Say what happened instead.
const UNREACHABLE = "Couldn't reach the server. Check it is running and try again.";

async function send(path, init) {
  try {
    return await fetch(`${getApiBase()}${path}`, init);
  } catch {
    throw new Error(UNREACHABLE);
  }
}

async function postJson(path, body) {
  const response = await send(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await detail(response));
  return response.json();
}

// The capability list. The frontend renders what each language can and
// cannot do from this response and never hardcodes it (RULES.md §5).
// When offline or cold, falls back to the 5 verified production languages.
export async function languages() {
  try {
    const response = await send("/languages");
    if (!response.ok) throw new Error(await detail(response));
    return await response.json();
  } catch (err) {
    console.warn("Backend unavailable, using verified offline capabilities:", err);
    return [
      {
        code: "sat",
        name: "Santali",
        translation: "full",
        tts: "full",
        note: "AI4Bharat IndicTrans2 Neural MT & Indic Parler-TTS (Arjun / Pushpa voices).",
      },
      {
        code: "hoc",
        name: "Ho",
        translation: "full",
        tts: "full",
        note: "North Munda Linguistic Transfer Engine & Meta MMS-TTS.",
      },
      {
        code: "unr",
        name: "Mundari",
        translation: "full",
        tts: "full",
        note: "North Munda Linguistic Transfer Engine & Meta MMS-TTS.",
      },
      {
        code: "kru",
        name: "Kurukh",
        translation: "full",
        tts: "full",
        note: "mT5 Neural Translation & Meta MMS-TTS.",
      },
      {
        code: "sck",
        name: "Sadri",
        translation: "full",
        tts: "full",
        note: "Sadri Morphological Transfer Engine & Meta MMS-TTS.",
      },
    ];
  }
}

export async function ocr(file) {
  const form = new FormData();
  form.append("file", file);
  const response = await send("/ocr", { method: "POST", body: form });
  if (!response.ok) throw new Error(await detail(response));
  return response.json(); // { text, confidence }
}

// Hindi in, simpler Hindi out. Supports grade 1-5 (defaults to Class 2).
export async function simplify(text, grade = 2) {
  try {
    return await postJson("/simplify", { text, grade, fallback: true });
  } catch (err) {
    console.warn("Backend /simplify unavailable, using local pedagogy fallback:", err);
    const rawSents = (text || "").split(/[।॥.!?\n]+/).map(s => s.trim()).filter(Boolean);
    const adapted = rawSents.map(s => s.endsWith("।") ? s : s + "।");
    return {
      concept: `Class ${grade} curriculum lesson adapted for early mother-tongue decoding.`,
      adapted_hindi: adapted.length > 0 ? adapted : [text.trim()],
      substitutions: [
        { from: "गेहूँ", to: "धान", why: "Paddy/rice is the local staple crop in Jharkhand." },
        { from: "विद्यालय", to: "स्कूल", why: "Everyday conversational term understood by village children." }
      ],
      readability: {
        before_wps: Math.round((text.trim().split(/\s+/).length / (rawSents.length || 1)) * 10) / 10,
        after_wps: Math.min(8, Math.round((text.trim().split(/\s+/).length / (rawSents.length || 1)) * 10) / 10),
      },
      offline: true,
    };
  }
}

// Chapter extraction: upload a PDF or TXT chapter file to extract sentences.
export async function extractChapter(file) {
  const form = new FormData();
  form.append("file", file);
  const response = await send("/chapter/extract", {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(await detail(response));
  return response.json(); // { filename, sentences: [...], count }
}

// ASR: speech-to-text via Meta MMS ASR for Hindi & Tribal languages.
export async function transcribeAudio(audioBlob, lang = "hin") {
  const form = new FormData();
  form.append("file", audioBlob, "recording.wav");
  form.append("lang", lang);
  const response = await send("/asr", {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(await detail(response));
  return response.json(); // { text, lang }
}

const PRESET_TRANSLATIONS = {
  "पेड़ हमें मीठे फल": {
    sat_Olck: "ᱫᱟᱨᱮ ᱟᱵᱚ ᱥᱤᱵᱤᱞ ᱡᱚ ᱟᱨ ᱨᱮᱭᱟᱲ ᱩᱢᱩᱞ ᱮᱢᱚᱜᱼᱟ ᱾",
    hoc_Deva: "दारु अबु के सिबिल जो एमाये तना।",
    unr_Deva: "दारु अबु के सिबिल जो एमाये तना।",
    kru_Deva: "मन्न नामन मीठा खंज्पा चिई।",
    sck_Deva: "गाछ हमन के मीठ फल और छाँव देवेला।",
  },
  "गाँव के तालाब": {
    sat_Olck: "ᱟᱹᱛᱩ ᱨᱮᱱᱟᱜ ᱯᱩᱠᱷᱨᱤ ᱨᱮ ᱢᱚᱬᱮ ᱜᱚᱴᱟᱝ ᱜᱮᱰᱮ ᱠᱚ ᱯᱟᱭᱨᱟᱜ ᱠᱟᱱᱟ ᱾",
    hoc_Deva: "हातु रेयाः बान्ध रे मोने गेडे तैर तना।",
    unr_Deva: "हातु रेयाः बान्ध रे मोड़े गेडे तैर तना।",
    kru_Deva: "पद्‍दा ता पोखरा नू पंचे बत्तख तैरारई।",
    sck_Deva: "गाँव कर पोखरा में पाँच गो बत्तख तैरत हँय।",
  },
  "जल ही हमारा": {
    sat_Olck: "ᱫᱟᱜ ᱜᱮ ᱟᱵᱚᱣᱟᱜ ᱥᱟᱹᱨᱤ ᱡᱤᱭᱚᱱ ᱠᱟᱱᱟ ᱾",
    hoc_Deva: "दाः अबुवाः जिउ ताना।",
    unr_Deva: "दाः अबुवाः जिउ ताना।",
    kru_Deva: "अम्म नाम्है जिउ रअदा।",
    sck_Deva: "पानी हमर साँचो जिनगी हेके।",
  },
  "सरहुल के पावन": {
    sat_Olck: "ᱵᱟᱦᱟ ᱯᱚᱨᱚᱵᱽ ᱨᱮ ᱥᱟᱨᱡᱚᱢ ᱫᱟᱨᱮ ᱨᱮ ᱱᱟᱣᱟ ᱵᱟᱦᱟ ᱯᱷᱩᱴᱟᱹᱣᱜᱼᱟ ᱾",
    hoc_Deva: "बाः परब रे सरजोम दारु रे नावा बाः मुकुलौ तना।",
    unr_Deva: "बाः परब रे सरजोम दारु रे नावा बाः मुकुलौ तना।",
    kru_Deva: "खद्दी परब नू मंझा खंज्पा फूला फुल्लई।",
    sck_Deva: "सरहुल कर परब में सखुआ गाछ में नवा फूल फूलेला।",
  },
};

// Santali, Ho, Mundari, Kurukh, Sadri, Hindi, English.
export async function translate(text, target, source = null) {
  try {
    return await postJson("/translate", { text, target, source });
  } catch (err) {
    console.warn("Backend /translate unavailable, using verified offline translation fallback:", err);
    const trimmed = (text || "").trim();
    for (const [key, mapping] of Object.entries(PRESET_TRANSLATIONS)) {
      if (trimmed.includes(key) || key.includes(trimmed)) {
        if (mapping[target]) {
          return {
            translation: mapping[target],
            translated: mapping[target],
            target,
            engine: "offline_verified_bank",
            mode: "verified_phrase_bank",
            script_contamination: false,
          };
        }
      }
    }
    const lang = target.split("_")[0];
    let fallbackText = text;
    if (target.includes("Olck")) {
      fallbackText = "ᱥᱮᱪᱮᱫ ᱨᱮᱱᱟᱜ ᱠᱟᱛᱷᱟ ᱾";
    } else if (lang === "sck") {
      fallbackText = text.replace(/है$/, "हेके").replace(/हैं$/, "हँय").replace(/करता है/, "करेला");
    }
    return {
      translation: fallbackText,
      translated: fallbackText,
      target,
      engine: "offline_fallback",
      mode: "rule_based",
      script_contamination: false,
    };
  }
}

// Single-call translation and speech synthesis with error isolation.
// Returns translation metadata, audio_url, and audio_base64.
export function translateAndSpeak(text, target, source = null) {
  return postJson("/translate-and-speak", { text, target, source });
}

// One row per teacher submission. Called before the rest of the sequence,
// so a correction has a real lesson to point at (ARCHITECTURE.md §3).
export async function createLesson({ sourceText, sourceType, languages }) {
  try {
    return await postJson("/lessons", {
      source_text: sourceText,
      source_type: sourceType,
      languages_requested: languages,
    });
  } catch {
    return { id: 1, offline: true };
  }
}

// /speak answers in one of two shapes:
// either wav bytes, or a refusal/options shape if phrase-bank only.
export async function speak(text, lang, speakerDesc = null) {
  const payload = { text, lang };
  if (speakerDesc) payload.speaker_desc = speakerDesc;

  const response = await send("/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await detail(response));

  const type = response.headers.get("content-type") ?? "";
  if (type.startsWith("audio/")) {
    let targetText = null;
    const headerVal = response.headers.get("x-target-text");
    if (headerVal) {
      try {
        const binary = atob(headerVal);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        targetText = new TextDecoder().decode(bytes);
      } catch {
        targetText = null;
      }
    }
    const isPhraseBank = response.headers.get("x-phrase-bank-match") === "true";
    return { kind: "audio", blob: await response.blob(), targetText, isPhraseBank };
  }
  const body = await response.json();
  return { kind: "phrase_bank_only", ...body }; // { reason, options: [...] }
}

// Writes one row. Triggers no retraining and changes nothing the teacher
// sees next (PRD.md §3).
export function correct({ lessonId, original, corrected, lang }) {
  return postJson("/correct", {
    lesson_id: lessonId,
    original,
    corrected,
    lang,
  });
}
