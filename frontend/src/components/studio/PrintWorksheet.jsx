import { useEffect, useState } from "react";
import QRCode from "qrcode/lib/browser.js";

const LANGUAGE_METADATA = {
  sat: { name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ", script: "Ol Chiki (ᱚᱞ ᱪᱤᱠᱤ)", type: "Neural MT" },
  hoc: { name: "Ho", native: "ᱦᱳ / हो", script: "Devanagari / Warang Citi", type: "Linguistic Transfer" },
  unr: { name: "Mundari", native: "ᱢᱩᱱᱰᱟᱨᱤ / मुंडारी", script: "Devanagari / Mundari Bani", type: "Linguistic Transfer" },
  kru: { name: "Kurukh", native: "कुड़ुख़ / ᱳᱨᱟᱶ", script: "Devanagari / Tolong Siki", type: "Neural MT" },
  sck: { name: "Sadri", native: "सादरी / नागपुरी", script: "Devanagari", type: "Morphological Transfer" },
};

const NIPUN_COMPETENCY_CODES = {
  1: [
    { code: "LO-FLN-H1.02", desc: "ध्वनि पहचान व मौखिक बोध (Phonemic awareness in L1)" },
    { code: "LO-FLN-H1.05", desc: "सचित्र शब्द मिलान व पठन (Visual-word association)" },
    { code: "LO-FLN-M1.01", desc: "स्थानीय परिवेश आधारित संख्या ज्ञान (Contextual numeracy)" },
  ],
  2: [
    { code: "LO-FLN-H2.02", desc: "मातृभाषा-हिंदी सेतु पठन (Bilingual oral bridge)" },
    { code: "LO-FLN-H2.05", desc: "सरल वाक्य बोध व चित्र वर्णन (Sentence comprehension)" },
    { code: "LO-FLN-M2.03", desc: "दैनिक जीवन आधारित भाषा प्रयोग (Contextual vocabulary)" },
  ],
  3: [
    { code: "LO-FLN-H3.01", desc: "कक्षा संवाद व मौखिक अभिव्यक्ति (Oral expression in classroom)" },
    { code: "LO-FLN-H3.04", desc: "लोककथा पठन व नैतिक मूल्य (Folklore & cultural comprehension)" },
  ],
  4: [
    { code: "LO-FLN-H4.02", desc: "स्वतंत्र लेखन व व्याकरण सेतु (Grammar bridge & self-expression)" },
    { code: "LO-FLN-H4.05", desc: "पर्यावरण व पारंपरिक ज्ञान विस्तार (Indigenous ecological concepts)" },
  ],
  5: [
    { code: "LO-FLN-H5.01", desc: "मातृभाषा साहित्य व राज्य पाठ्यक्रम समन्वय (Curriculum integration)" },
    { code: "LO-FLN-H5.03", desc: "सामुदायिक संवाद व मौखिक प्रस्तुति (Community storytelling)" },
  ],
};

export default function PrintWorksheet({
  isOpen,
  onClose,
  hindiText,
  adapted,
  translations = [],
  chapterResults = [],
  grade = 2,
  audio = {},
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    // Use current URL or API base for audio link
    const audioUrl =
      window.location.origin +
      "/#audio-lesson-grade-" +
      grade;

    QRCode.toDataURL(audioUrl, {
      width: 140,
      margin: 1,
      color: { dark: "#004024", light: "#FFFFFF" },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code error:", err));
  }, [isOpen, grade]);

  if (!isOpen) return null;

  function handlePrint() {
    window.print();
  }

  // Deduplicate and assemble mother-tongue items
  const displayLangs = [];
  const seenCodes = new Set();

  const sourceTranslations = translations.length > 0
    ? translations
    : (chapterResults || []).flatMap((c) => c.translations || []);

  for (const t of sourceTranslations) {
    if (!t.translated) continue;
    const meta = LANGUAGE_METADATA[t.code] || { name: t.name || t.code, native: "", script: "Devanagari", type: "Translation" };
    displayLangs.push({
      code: t.code,
      name: meta.name,
      native: meta.native,
      script: meta.script,
      type: meta.type,
      text: t.translated,
      source: "translation",
    });
    seenCodes.add(t.code);
  }

  for (const [langCode, a] of Object.entries(audio)) {
    if (seenCodes.has(langCode) || a.kind !== "audio" || !a.targetText) continue;
    const meta = LANGUAGE_METADATA[langCode] || { name: langCode, native: "", script: "Devanagari", type: "Spoken Phrase" };
    displayLangs.push({
      code: langCode,
      name: meta.name,
      native: meta.native,
      script: meta.script,
      type: meta.type,
      text: a.targetText,
      source: "audio_target",
    });
    seenCodes.add(langCode);
  }

  return (
    <div className="modal-backdrop worksheet-modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content worksheet-modal-dialog">
        {/* Interactive Top Actions (Hidden during physical print) */}
        <div className="worksheet-modal-toolbar no-print">
          <div className="toolbar-left">
            <span className="material-symbols-outlined text-primary">description</span>
            <div>
              <h2 className="toolbar-title">Printable Classroom Worksheet</h2>
              <p className="toolbar-sub">A4 Ready-to-print activity sheet with QR audio link for Jharkhand teachers</p>
            </div>
          </div>
          <div className="toolbar-actions">
            <button className="button button--primary tactile-btn-primary" onClick={handlePrint}>
              <span className="material-symbols-outlined text-base">print</span>
              <span>Print / Save as PDF</span>
            </button>
            <button className="button button--secondary tactile-btn-secondary" onClick={onClose}>
              <span className="material-symbols-outlined text-base">close</span>
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Structured Printable A4 Sheet Document */}
        <article className="worksheet-document">
          {/* Header Banner with JEPC PALASH Institutional Stamping */}
          <header className="ws-header">
            <div className="ws-brand-cluster">
              <div className="ws-logo" aria-hidden="true">बो</div>
              <div className="ws-title-group">
                <div className="ws-jepc-seal">
                  BOLI Prototype · Mother-Tongue Multilingual Classroom Aid (SIH 2026)
                </div>
                <h1 className="ws-main-title">Multilingual Classroom Worksheet</h1>
                <p className="ws-tagline">
                  Mother Tongue-Based Multilingual Education & Bridge Pedagogy Aid · Aligned with Primary FLN Goals
                </p>
              </div>
            </div>
            <div className="ws-meta-pills">
              <span className="ws-grade-badge">Class {grade}</span>
              <span className="ws-sih-badge">BOLI MLE</span>
              <span className="ws-nipun-badge">FLN Practice</span>
            </div>
          </header>

          {/* Targeted Primary Learning Competency Codes Bar */}
          <div className="ws-nipun-code-bar">
            <span className="ws-nipun-bar-title">
              <span className="material-symbols-outlined ws-inline-icon">menu_book</span>
              <span>अधिगम दक्षताएं (Targeted Competencies):</span>
            </span>
            <div className="ws-nipun-tags">
              {(NIPUN_COMPETENCY_CODES[grade] || NIPUN_COMPETENCY_CODES[2]).map((comp, idx) => (
                <span key={idx} className="ws-nipun-tag" title={comp.desc}>
                  <strong>{comp.code}</strong>: {comp.desc}
                </span>
              ))}
            </div>
          </div>

          {/* Student & School Inspection Verification Bar */}
          <div className="ws-student-bar">
            <div className="ws-field ws-field--name">
              <span className="ws-label">विद्यार्थी (Name):</span>
              <span className="ws-line"></span>
            </div>
            <div className="ws-field ws-field--roll">
              <span className="ws-label">क्रमांक (Roll):</span>
              <span className="ws-line"></span>
            </div>
            <div className="ws-field ws-field--date">
              <span className="ws-label">दिनांक (Date):</span>
              <span className="ws-line"></span>
            </div>
            <div className="ws-field ws-field--udise">
              <span className="ws-label">U-DISE Code:</span>
              <span className="ws-line"></span>
            </div>
            <div className="ws-field ws-field--school">
              <span className="ws-label">विद्यालय (School):</span>
              <span className="ws-line"></span>
            </div>
            <div className="ws-field ws-field--block">
              <span className="ws-label">प्रखंड व जिला:</span>
              <span className="ws-line"></span>
            </div>
          </div>

          {/* Section 1: Original Hindi Lesson */}
          <section className="ws-section">
            <div className="ws-section-header">
              <span className="ws-step-num">1</span>
              <div>
                <h2 className="ws-section-title">Original Textbook Lesson (पाठ्यपुस्तक पाठ)</h2>
                <p className="ws-section-desc">Standard state curriculum source text</p>
              </div>
            </div>
            <div className="ws-card ws-card--hindi" lang="hi">
              <p className="ws-hindi-original-text">{hindiText}</p>
            </div>
          </section>

          {/* Section 2: Classroom Simplified & Culturally Adapted Hindi */}
          {adapted && (
            <section className="ws-section">
              <div className="ws-section-header">
                <span className="ws-step-num">2</span>
                <div className="ws-header-with-tag">
                  <h2 className="ws-section-title">Classroom Simplified Hindi (आसान हिंदी)</h2>
                  {adapted.concept && (
                    <span className="ws-concept-pill">
                      <span className="material-symbols-outlined ws-inline-icon">school</span>
                      Concept: {adapted.concept}
                    </span>
                  )}
                </div>
              </div>

              <div className="ws-card ws-card--simplified">
                <ol className="ws-simplified-list" lang="hi">
                  {adapted.adapted_hindi?.map((sent, idx) => (
                    <li key={idx} className="ws-sentence-item">
                      <span className="ws-sentence-bullet">{idx + 1}</span>
                      <span className="ws-sentence-text">{sent}</span>
                    </li>
                  ))}
                </ol>

                {adapted.substitutions?.length > 0 && (
                  <div className="ws-substitutions-panel">
                    <div className="ws-subs-title">
                      <span className="material-symbols-outlined ws-inline-icon">local_florist</span>
                      <span>Cultural Vocabulary Adaptations (स्थानीय भाषा अनुकूलन):</span>
                    </div>
                    <div className="ws-subs-grid">
                      {adapted.substitutions.map((sub, idx) => (
                        <div key={idx} className="ws-sub-chip">
                          <span className="ws-sub-from">{sub.from}</span>
                          <span className="ws-sub-arrow">→</span>
                          <strong className="ws-sub-to">{sub.to}</strong>
                          <span className="ws-sub-why">({sub.why})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 3: Structured Mother-Tongue Translations */}
          <section className="ws-section">
            <div className="ws-section-header">
              <span className="ws-step-num">3</span>
              <div>
                <h2 className="ws-section-title">Mother-Tongue Classroom Translations (मातृभाषा रूपांतरण)</h2>
                <p className="ws-section-desc">Regional tribal and local language adaptations with native script display</p>
              </div>
            </div>

            <div className="ws-languages-grid">
              {displayLangs.length > 0 ? (
                displayLangs.map((item, idx) => (
                  <div key={idx} className={`ws-lang-card ws-lang-${item.code}`}>
                    <div className="ws-lang-header">
                      <div className="ws-lang-titles">
                        <span className="ws-lang-name">{item.name}</span>
                        {item.native && <span className="ws-lang-native">{item.native}</span>}
                      </div>
                      <div className="ws-lang-tags">
                        <span className="ws-script-pill">{item.script}</span>
                        <span className="ws-engine-pill">{item.type}</span>
                      </div>
                    </div>
                    <div className="ws-lang-body" lang={item.code}>
                      <p className={`ws-translated-text ${item.code === "sat" ? "ws-ol-chiki-text" : ""}`}>
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className="ws-empty-translations"
                  style={{
                    padding: "1.25rem",
                    textAlign: "center",
                    color: "#475569",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px dashed #cbd5e1",
                    fontSize: "0.9rem",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    मातृभाषा अनुवाद तैयार हो रहा है (Translations are in progress…)
                  </p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                    Please wait a moment for neural MT and linguistic transfer to finish.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Section 4: Classroom Practice Exercises & FLN Evaluation (अभ्यास कार्य) */}
          <section className="ws-section ws-practice-section">
            <div className="ws-section-header">
              <span className="ws-step-num">4</span>
              <div>
                <h2 className="ws-section-title">Classroom Practice & FLN Exercises (अभ्यास और मूल्यांकन)</h2>
                <p className="ws-section-desc">Interactive mother-tongue word matching & oral reading drill</p>
              </div>
            </div>

            <div className="ws-practice-grid">
              {/* Exercise A: Match the Words */}
              <div className="ws-practice-card">
                <h3 className="ws-practice-subtitle">
                  <span className="material-symbols-outlined ws-inline-icon">draw</span>
                  <span>Exercise A: Match the Words (शब्द मिलान करें)</span>
                </h3>
                <p className="ws-practice-hint">Draw a line connecting the Hindi word with the mother-tongue word:</p>
                <div className="ws-match-columns">
                  <div className="ws-match-col">
                    <span className="ws-match-item">1. पानी (Water)</span>
                    <span className="ws-match-item">2. किताब (Book)</span>
                    <span className="ws-match-item">3. स्कूल (School)</span>
                    <span className="ws-match-item">4. बच्चे (Children)</span>
                  </div>
                  <div className="ws-match-dots">
                    <span>⚪ ┈┈┈ ⚪</span>
                    <span>⚪ ┈┈┈ ⚪</span>
                    <span>⚪ ┈┈┈ ⚪</span>
                    <span>⚪ ┈┈┈ ⚪</span>
                  </div>
                  <div className="ws-match-col">
                    <span className="ws-match-item">A. पुथी / ᱯᱩᱛᱷᱤ</span>
                    <span className="ws-match-item">B. हुनको / होनको</span>
                    <span className="ws-match-item">C. दाः / ᱫᱟᱜ</span>
                    <span className="ws-match-item">D. इटुन आसरा / इस्कुल</span>
                  </div>
                </div>
              </div>

              {/* Exercise B: Oral Reading Fluency Meter (NIPUN Bharat FLN) */}
              <div className="ws-practice-card">
                <h3 className="ws-practice-subtitle">
                  <span className="material-symbols-outlined ws-inline-icon">record_voice_over</span>
                  <span>Exercise B: Oral Reading Fluency (मौखिक पठन दक्षता — NIPUN Target)</span>
                </h3>
                <p className="ws-practice-hint">
                  शिक्षक मूल्यांकन (Teacher Evaluation mapped to LO-FLN-H{grade}.02 &gt; 35 wpm standard):
                </p>
                <div className="ws-fln-checklist">
                  <div className="ws-fln-row">
                    <span className="ws-fln-check">☐</span>
                    <span className="ws-fln-label">
                      <strong>LO-FLN-H{grade}.02:</strong> मातृभाषा ध्वनि पहचान व शुद्ध उच्चारण (Phonemic clarity)
                    </span>
                  </div>
                  <div className="ws-fln-row">
                    <span className="ws-fln-check">☐</span>
                    <span className="ws-fln-label">
                      <strong>LO-FLN-H{grade}.05:</strong> मातृभाषा से मानक हिंदी में अवधारणा सेतु बोध (Conceptual bridge)
                    </span>
                  </div>
                  <div className="ws-fln-row">
                    <span className="ws-fln-check">☐</span>
                    <span className="ws-fln-label">
                      <strong>NIPUN Target:</strong> धाराप्रवाह मौखिक पठन व आत्मविश्वास (Oral fluency & confidence)
                    </span>
                  </div>
                  <div className="ws-teacher-score">
                    <span>शिक्षक टिप्पणी (Remarks): ________________________________</span>
                    <span>FLN स्तर: ⭐⭐⭐⭐⭐</span>
                  </div>
                  <div className="ws-teacher-sign-row">
                    <span>शिक्षक हस्ताक्षर (Teacher Sign): ___________________</span>
                    <span>मुहर (School Seal): [                    ]</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Footer with QR Audio Code & Pedagogical Instructions */}
          <footer className="ws-footer">
            <div className="ws-qr-panel">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Scan to listen to spoken lesson audio in mother-tongues"
                  className="ws-qr-image"
                />
              ) : (
                <div className="ws-qr-placeholder">QR Code</div>
              )}
              <div className="ws-qr-text-block">
                <div className="ws-qr-headline">
                  <span className="material-symbols-outlined ws-inline-icon">volume_up</span>
                  <strong>Scan with Smartphone Camera to Play Audio</strong>
                </div>
                <p className="ws-qr-details">
                  Teachers and students can instantly hear fluent spoken pronunciation in Santali, Ho, Mundari, Kurukh, and Sadri directly in the classroom without internet lookup.
                </p>
              </div>
            </div>

            <div className="ws-footer-attribution">
              <div className="ws-project-info">
                <strong>BOLI (बोली)</strong> · Mother Tongue-Based Multilingual Education Suite
              </div>
              <div className="ws-mission-statement">
                Empowering Multilingual Primary Classrooms in Jharkhand · Bridging Mother-Tongues to State Curriculum
              </div>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
