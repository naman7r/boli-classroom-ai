import { useEffect, useState } from "react";
import JSZip from "jszip";
import {
  createLesson,
  languages as fetchLanguages,
  simplify,
  speak,
  translate,
} from "../api";
import {
  capabilityBadge,
  nativeName,
  speaksWithoutPedagogy,
  translateTargetFor,
} from "../capability";
import AudioPlayer from "../components/AudioPlayer";
import CorrectionForm from "../components/CorrectionForm";
import PrintWorksheet from "../components/PrintWorksheet";

export default function Result({
  hindiText,
  grade = 2,
  chapterSentences = [],
  sourceType,
  selectedLangs,
  onBack,
  onNavigateTab,
}) {
  const [stage, setStage] = useState("Loading languages…");
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState([]);
  const [adapted, setAdapted] = useState(null);
  const [translations, setTranslations] = useState([]);
  const [audio, setAudio] = useState({});
  const [lessonId, setLessonId] = useState(null);
  const [simplifyError, setSimplifyError] = useState("");
  const [chapterResults, setChapterResults] = useState([]);
  const [isZipping, setIsZipping] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const sentenceList =
        chapterSentences && chapterSentences.length > 0
          ? chapterSentences
          : [hindiText].filter(Boolean);

      if (sentenceList.length === 0) return;

      const fullLessonText = sentenceList.join(" ").trim();

      try {
        const all = await fetchLanguages();
        if (cancelled) return;
        const picked = all.filter((l) => selectedLangs.includes(l.code));
        setChosen(picked);

        // 0. Record lesson submission in background
        createLesson({
          sourceText: fullLessonText,
          sourceType,
          languages: selectedLangs,
        })
          .then((lesson) => {
            if (!cancelled && lesson?.id) setLessonId(lesson.id);
          })
          .catch(() => {});

        // 1. Kick off pedagogical simplification in BACKGROUND (never blocks translation)
        simplify(fullLessonText, grade)
          .then((res) => {
            if (!cancelled) setAdapted(res);
          })
          .catch((e) => {
            if (!cancelled) {
              console.warn("Pedagogy simplification failed:", e);
              setSimplifyError(e.message);
            }
          });

        // 2. Handle Single Sentence Mode (Instantaneous & Streaming)
        if (sentenceList.length === 1) {
          const currentText = sentenceList[0];
          setStage(`Translating lesson…`);

          // Fast parallel translation: stream each language into state as soon as it resolves
          const transPromises = picked.map(async (language) => {
            const target = translateTargetFor(language);
            if (!target) return;
            try {
              const res = await translate(currentText, target);
              if (cancelled) return;
              const transObj = {
                code: language.code,
                name: language.name,
                sentence: currentText,
                translated: res.translated,
                contaminated: res.script_contamination,
              };

              setTranslations((prev) => {
                const filtered = prev.filter((t) => t.code !== language.code);
                return [...filtered, transObj];
              });

              // Synthesize full voice speech as soon as translation arrives
              if (
                language.tts === "full" &&
                !speaksWithoutPedagogy(language) &&
                res.translated
              ) {
                speak(res.translated, language.code)
                  .then((audioRes) => {
                    if (!cancelled) {
                      setAudio((prev) => ({
                        ...prev,
                        [language.code]: { ...audioRes, text: res.translated },
                      }));
                    }
                  })
                  .catch((err) => {
                    if (!cancelled) {
                      setAudio((prev) => ({
                        ...prev,
                        [language.code]: { kind: "error", error: err.message },
                      }));
                    }
                  });
              }

              return transObj;
            } catch (err) {
              console.warn(`Translation error for ${language.name}:`, err);
            }
          });

          // Concurrently speak phrase-bank languages
          for (const language of picked.filter(speaksWithoutPedagogy)) {
            speak(currentText, language.code)
              .then((audioRes) => {
                if (!cancelled) {
                  setAudio((prev) => ({
                    ...prev,
                    [language.code]: { ...audioRes, text: currentText },
                  }));
                }
              })
              .catch((err) => {
                if (!cancelled) {
                  setAudio((prev) => ({
                    ...prev,
                    [language.code]: { kind: "error", error: err.message },
                  }));
                }
              });
          }

          await Promise.all(transPromises);
          if (!cancelled) setStage("");
          return;
        }

        // 3. Handle Multi-sentence Chapter Mode (Progressive Streaming)
        setStage(`Translating chapter (${sentenceList.length} sentences)…`);
        const accumulatedResults = [];

        // Helper to translate one sentence across all picked languages
        async function processSentence(sentText, sIdx) {
          const sentTranslations = [];
          const sAudio = {};

          await Promise.all(
            picked.map(async (language) => {
              const target = translateTargetFor(language);
              if (!target) return;
              try {
                const res = await translate(sentText, target);
                sentTranslations.push({
                  code: language.code,
                  name: language.name,
                  sentence: sentText,
                  translated: res.translated,
                  contaminated: res.script_contamination,
                });
              } catch (e) {
                console.warn(`Translation error for ${language.name}:`, e);
              }
            })
          );

          // Synthesize audio for sentence 0 immediately for instant playback
          if (sIdx === 0) {
            await Promise.all(
              picked.map(async (language) => {
                let textToSpeak = sentText;
                const mine = sentTranslations.find((t) => t.code === language.code);
                if (mine?.translated && language.tts === "full" && !speaksWithoutPedagogy(language)) {
                  textToSpeak = mine.translated;
                }
                try {
                  const aRes = await speak(textToSpeak, language.code);
                  sAudio[language.code] = { ...aRes, text: textToSpeak };
                } catch (err) {
                  sAudio[language.code] = { kind: "error", error: err.message };
                }
              })
            );
            if (!cancelled) {
              setAudio(sAudio);
              setTranslations(sentTranslations);
            }
          }

          return {
            sentenceIndex: sIdx,
            sourceText: sentText,
            translations: sentTranslations,
            audio: sAudio,
          };
        }

        // Step A: Immediately translate & render Sentence 1
        const firstResult = await processSentence(sentenceList[0], 0);
        if (cancelled) return;
        accumulatedResults.push(firstResult);
        setChapterResults([...accumulatedResults]);
        setStage(sentenceList.length > 1 ? `Sentence 1 ready. Processing remaining chapter…` : "");

        // Step B: Progressively translate remaining sentences
        for (let i = 1; i < sentenceList.length; i++) {
          if (cancelled) break;
          const result = await processSentence(sentenceList[i], i);
          if (cancelled) break;
          accumulatedResults.push(result);
          setChapterResults([...accumulatedResults]);
        }

        if (!cancelled) setStage("");
      } catch (e) {
        if (cancelled) return;
        setError(e.message);
        setStage("");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [hindiText, grade, chapterSentences, sourceType, selectedLangs]);

  async function generateAudioForSentence(sentenceIdx, langCode) {
    const item = chapterResults[sentenceIdx];
    if (!item) return;
    const language = chosen.find((c) => c.code === langCode);
    if (!language) return;

    let textToSpeak = item.sourceText;
    const mine = item.translations?.find((t) => t.code === langCode);
    if (
      mine?.translated &&
      language.tts === "full" &&
      !speaksWithoutPedagogy(language)
    ) {
      textToSpeak = mine.translated;
    }

    setChapterResults((prev) => {
      const copy = [...prev];
      copy[sentenceIdx] = {
        ...copy[sentenceIdx],
        audio: {
          ...(copy[sentenceIdx].audio || {}),
          [langCode]: { kind: "loading" },
        },
      };
      return copy;
    });

    try {
      const res = await speak(textToSpeak, langCode);
      setChapterResults((prev) => {
        const copy = [...prev];
        copy[sentenceIdx] = {
          ...copy[sentenceIdx],
          audio: {
            ...(copy[sentenceIdx].audio || {}),
            [langCode]: { ...res, text: textToSpeak },
          },
        };
        return copy;
      });
    } catch (e) {
      setChapterResults((prev) => {
        const copy = [...prev];
        copy[sentenceIdx] = {
          ...copy[sentenceIdx],
          audio: {
            ...(copy[sentenceIdx].audio || {}),
            [langCode]: { kind: "error", error: e.message },
          },
        };
        return copy;
      });
    }
  }

  async function handleDownloadOfflinePack() {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      let summaryText = "BOLI — Multilingual Classroom Lesson Pack\n";
      summaryText += `Grade Level: Class ${grade}\n`;
      summaryText += `Total Sentences: ${chapterResults.length || 1}\n\n`;

      const audioFolder = zip.folder("audio");
      const resultsToExport =
        chapterResults.length > 0
          ? chapterResults
          : [
              {
                sentenceIndex: 0,
                sourceText: hindiText,
                adapted,
                translations,
                audio,
              },
            ];

      resultsToExport.forEach((item, idx) => {
        summaryText += `==============================================\n`;
        summaryText += `Sentence ${idx + 1}: ${item.sourceText}\n`;
        if (item.adapted) {
          summaryText += `Concept: ${item.adapted.concept}\n`;
          summaryText += `Simplified Hindi: ${item.adapted.adapted_hindi.join(" ")}\n`;
          if (item.adapted.substitutions?.length > 0) {
            summaryText += `Cultural Substitutions:\n`;
            item.adapted.substitutions.forEach((sub) => {
              summaryText += `  - ${sub.from} -> ${sub.to} (${sub.why})\n`;
            });
          }
        }
        if (item.translations?.length > 0) {
          summaryText += `Translations:\n`;
          item.translations.forEach((t) => {
            summaryText += `  [${t.name}]: ${t.translated}\n`;
          });
        }
        summaryText += "\n";

        if (item.audio) {
          Object.entries(item.audio).forEach(([langCode, data]) => {
            if (data.kind === "audio" && data.blob) {
              audioFolder.file(`sentence_${idx + 1}_${langCode}.wav`, data.blob);
            }
          });
        }
      });

      zip.file("summary.txt", summaryText);
      zip.file("data.json", JSON.stringify(resultsToExport, null, 2));

      const htmlContent = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>BOLI — Offline Classroom Pack</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; }
    h1 { color: #1E3A5F; }
    .card { background: #F1F4F8; padding: 1.25rem; margin-bottom: 1.25rem; border-radius: 10px; border-left: 5px solid #1B6B45; }
    .meta { color: #555; font-size: 0.9rem; }
    .trans-box { margin-top: 0.6rem; padding: 0.6rem; background: #fff; border-radius: 6px; }
    audio { display: block; margin-top: 0.5rem; width: 100%; }
  </style>
</head>
<body>
  <h1>BOLI — Offline Classroom Lesson</h1>
  <p class="meta">Class ${grade} · Zero-Connectivity Classroom Player</p>
  ${resultsToExport
    .map(
      (item, idx) => `
    <div class="card">
      <h3>Sentence ${idx + 1}</h3>
      <p><strong>Original Hindi:</strong> ${item.sourceText}</p>
      ${
        item.adapted
          ? `<p><strong>Simplified Hindi:</strong> ${item.adapted.adapted_hindi.join(" ")}</p>`
          : ""
      }
      ${(item.translations || [])
        .map(
          (t) => `
        <div class="trans-box">
          <strong>${t.name}:</strong> ${t.translated}
        </div>`
        )
        .join("")}
      ${Object.entries(item.audio || {})
        .filter(([, a]) => a.kind === "audio")
        .map(
          ([langCode, a]) => `
        <div class="trans-box">
          <strong>Audio (${langCode}):</strong> <em>${a.targetText || a.text || ""}</em>
          <audio controls src="audio/sentence_${idx + 1}_${langCode}.wav"></audio>
        </div>`
        )
        .join("")}
    </div>`
    )
    .join("")}
</body>
</html>`;
      zip.file("index.html", htmlContent);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boli_class_${grade}_offline_pack.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to create offline pack: " + err.message);
    } finally {
      setIsZipping(false);
    }
  }

  async function playPhrase(lang, phrase) {
    try {
      const result = await speak(phrase.hindi_source, lang);
      setAudio((prev) => ({
        ...prev,
        [lang]: { ...result, text: phrase.target_text },
      }));
    } catch (e) {
      setAudio((prev) => ({
        ...prev,
        [lang]: { kind: "error", error: e.message },
      }));
    }
  }

  return (
    <section aria-labelledby="result-heading">
      <div className="section-eyebrow">
        <span className="eyebrow-tag">STEP 03</span>
        <span>LESSON AUDIO & SYNTHESIS</span>
      </div>
      <h1 id="result-heading" className="screen-title">A lesson, ready to be heard.</h1>
      <p className="screen-subtitle">
        Check the wording and listen to the audio before presenting to your class.
      </p>

      {/* Export & Share Tools */}
      <div className="ps-deliverables-banner sun-card-shadow">
        <div className="ps-deliverables-header">
          <div className="ps-deliverables-title">
            <span className="material-symbols-outlined text-green-700">share</span>
            <span>Export & Share (शिक्षण सामग्री)</span>
          </div>
          <span className="text-xs text-secondary font-mono">Aligned with NIPUN Bharat FLN Goals</span>
        </div>

        <div className="ps-deliverables-grid">
          {/* Print-Ready Worksheet */}
          <div className="ps-deliverable-card">
            <div className="ps-deliverable-content">
              <span className="ps-deliverable-badge">
                <span className="material-symbols-outlined text-xs">description</span>
                Worksheet
              </span>
              <h3 className="ps-deliverable-name">Print-Ready Worksheet</h3>
              <p className="ps-deliverable-desc">
                A4 bilingual sheet with school stamp, NIPUN learning outcome codes, and QR code for audio playback.
              </p>
            </div>
            <button
              type="button"
              className="ps-deliverable-btn primary"
              onClick={() => setIsPrintModalOpen(true)}
            >
              <span className="material-symbols-outlined text-sm">print</span>
              <span>Open & Print Worksheet</span>
            </button>
          </div>

          {/* Bilingual Flashcards */}
          <div className="ps-deliverable-card">
            <div className="ps-deliverable-content">
              <span className="ps-deliverable-badge">
                <span className="material-symbols-outlined text-xs">style</span>
                Flashcards
              </span>
              <h3 className="ps-deliverable-name">Bilingual Flashcards</h3>
              <p className="ps-deliverable-desc">
                Visual flashcards connecting Hindi vocabulary to mother-tongue translations with audio.
              </p>
            </div>
            <button
              type="button"
              className="ps-deliverable-btn"
              onClick={() => onNavigateTab ? onNavigateTab("flashcards") : null}
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              <span>View Vocabulary Flashcards</span>
            </button>
          </div>

          {/* Offline Classroom Pack */}
          <div className="ps-deliverable-card">
            <div className="ps-deliverable-content">
              <span className="ps-deliverable-badge">
                <span className="material-symbols-outlined text-xs">volume_up</span>
                Offline Pack
              </span>
              <h3 className="ps-deliverable-name">Offline Classroom Pack</h3>
              <p className="ps-deliverable-desc">
                Synthesized speech audio packaged with an offline HTML player for classrooms without internet.
              </p>
            </div>
            <button
              type="button"
              className="ps-deliverable-btn"
              onClick={handleDownloadOfflinePack}
              disabled={isZipping || stage !== ""}
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>{isZipping ? "Packaging ZIP…" : "Download Offline Pack"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Action Toolbar */}
      <div className="result-toolbar">
        <div className="result-toolbar-meta">
          <strong>Class {grade} Lesson</strong>
          {chapterResults.length > 1 && (
            <span style={{ marginLeft: "0.5rem", color: "var(--text-light)" }}>
              ({chapterResults.length} chapter sentences)
            </span>
          )}
        </div>

        <div className="result-toolbar-actions">
          <button
            type="button"
            className="button button--secondary tactile-btn-secondary"
            onClick={() => setIsPrintModalOpen(true)}
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>Print Worksheet (with QR)</span>
          </button>
          <button
            type="button"
            className="button button--primary tactile-btn-primary"
            onClick={handleDownloadOfflinePack}
            disabled={isZipping || stage !== ""}
          >
            <span className="material-symbols-outlined text-base">folder_zip</span>
            <span>{isZipping ? "Creating ZIP…" : "Download Offline Pack (.zip)"}</span>
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite">
        {stage && (
          <p className="stage">
            <span className="spinner" aria-hidden="true" />
            {stage}
          </p>
        )}
      </div>
      {error && <p className="error">{error}</p>}

      {simplifyError && (
        <div className="panel">
          <h2>Simplified Hindi</h2>
          <p className="error">
            The lesson could not be simplified this time. {simplifyError}
          </p>
          <p className="note">
            Anything below that does not need this step is unaffected.
          </p>
        </div>
      )}

      {adapted && (
        <div className="panel panel--simplified">
          <div className="panel-header">
            <h2>
              Simplified Hindi <span lang="hi">(आसान हिंदी)</span>
            </h2>
            <span className="concept-badge">Class {grade}</span>
          </div>
          <p className="group-blurb">
            <strong>Concept:</strong> {adapted.concept} — rewritten for a child
            whose mother tongue is not Hindi.
          </p>
          <ol className="sentence-list" lang="hi">
            {adapted.adapted_hindi.map((sentence, i) => (
              <li key={i}>{sentence}</li>
            ))}
          </ol>
          {adapted.substitutions?.length > 0 && (
            <ul className="subs">
              {adapted.substitutions.map((s, i) => (
                <li key={i}>
                  <strong>{s.from}</strong> → <strong>{s.to}</strong> — {s.why}
                </li>
              ))}
            </ul>
          )}
          {adapted.readability && (
            <p className="note">
              Readability: {adapted.readability.before_wps} words/sentence
              originally →{" "}
              <strong>{adapted.readability.after_wps} words/sentence</strong>{" "}
              adapted.
            </p>
          )}
        </div>
      )}

      {chapterResults.length > 1 ? (
        /* Multi-sentence Chapter Mode */
        <div
          className="chapter-results-list"
          style={{ display: "grid", gap: "1.5rem" }}
        >
          {chapterResults.map((item, idx) => (
            <article
              key={idx}
              className="panel"
            >
              <div className="panel-header">
                <span className="eyebrow" style={{ margin: 0 }}>
                  Sentence {idx + 1} of {chapterResults.length}
                </span>
                <span className="group-tag group-tag--ai">Class {grade}</span>
              </div>

              <p
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  margin: "0.25rem 0 0.75rem 0",
                }}
                lang="hi"
              >
                {item.sourceText}
              </p>

              {item.translations?.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  {item.translations.map((t, tIdx) => (
                    <div key={tIdx} className="hero-script-display">
                      <div className="lang-card-header">
                        <span className="lang-name">{t.name}</span>
                        <span className="chip-badge chip-badge--full">
                          {capabilityBadge(t)}
                        </span>
                      </div>
                      <div className="target-script-large" lang={t.code}>
                        {t.translated}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: "1rem" }}>
                {chosen.map((language) => {
                  const langCode = language.code;
                  const langName = language.name;
                  const a = item.audio ? item.audio[langCode] : null;

                  return (
                    <div key={langCode} style={{ marginBottom: "0.75rem" }}>
                      {a?.kind === "audio" && (
                        <div
                          className="hero-script-display"
                        >
                          <div className="lang-card-header">
                            <span className="lang-name">{langName}</span>
                            <span className="chip-badge chip-badge--phrase_bank">
                              Classroom voice
                            </span>
                          </div>
                          {a.targetText ? (
                            <div className="target-script-large" lang={langCode}>
                              {a.targetText}
                            </div>
                          ) : (
                            <div className="target-script-large" lang="hi">
                              {a.text}
                            </div>
                          )}
                          <AudioPlayer
                            blob={a.blob}
                            label={`${langName} spoken audio`}
                          />
                        </div>
                      )}
                      {a?.kind === "loading" && (
                        <p
                          className="note"
                          style={{
                            margin: "0.25rem 0",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            className="spinner"
                            aria-hidden="true"
                            style={{
                              width: "14px",
                              height: "14px",
                              margin: 0,
                            }}
                          />
                          Synthesizing {langName} audio…
                        </p>
                      )}
                      {(!a || a?.kind === "error") && language.tts === "full" && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginTop: "0.25rem",
                          }}
                        >
                          <button
                            type="button"
                            className="button button--secondary"
                            style={{
                              padding: "0.25rem 0.6rem",
                              fontSize: "0.8rem",
                            }}
                            onClick={() =>
                              generateAudioForSentence(idx, langCode)
                            }
                          >
                            <span className="material-symbols-outlined text-sm">
                              volume_up
                            </span>
                            <span>Generate {langName} Voice</span>
                          </button>
                          {a?.kind === "error" && (
                            <span
                              className="error"
                              style={{ fontSize: "0.75rem" }}
                            >
                              {a.error}
                            </span>
                          )}
                        </div>
                      )}
                      {a?.kind === "phrase_bank_only" && (
                        <p className="note" style={{ margin: "0.25rem 0" }}>
                          {langName}: Phrase bank only.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        /* Single Sentence Mode */
        <>

          {chosen.map((language) => {
            const mine = translations.filter((t) => t.code === language.code);
            const spoken = audio[language.code];
            const isBank = language.translation === "phrase_bank";

            return (
              <article
                key={language.code}
                className={"panel result-card chip-" + language.translation}
                aria-labelledby={"result-" + language.code}
              >
                <div className="result-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 id={"result-" + language.code} style={{ margin: 0 }}>
                    {language.name}{" "}
                    {nativeName(language) && (
                      <span className="lang-native" lang={language.code}>
                        ({nativeName(language)})
                      </span>
                    )}
                  </h2>
                  <span className={`chip-badge chip-badge--${language.translation}`}>
                    {capabilityBadge(language)}
                  </span>
                </div>

                {isBank && (
                  <p className="group-desc" style={{ marginTop: "0.5rem" }}>
                    This entry comes from the curated classroom phrase bank for {language.name} — pending validation by a native speaker.
                  </p>
                )}

                {simplifyError && !isBank && (
                  <p className="error">
                    No {language.name} translation this time: it depends on the simplification step, which failed. The other languages on this page were not affected.
                  </p>
                )}

                {mine.length > 0 && (
                  <>
                    <div className="hero-script-display">
                      {mine.map((t, i) => (
                        <div key={i}>
                          <div className="target-script-large" lang={language.code}>
                            {t.translated}
                          </div>
                        </div>
                      ))}
                    </div>
                    <CorrectionForm
                      lang={language.code}
                      original={mine.map((t) => t.translated).join(" ")}
                      lessonId={lessonId}
                    />
                  </>
                )}

                {language.tts === "none" && (
                  <p className="note">
                    {language.note ?? "There is no voice for this language."} This is text only.
                  </p>
                )}

                {spoken?.kind === "audio" && (
                  <>
                    <div className="hero-script-display">
                      <span className="field-label" style={{ fontSize: "0.8rem" }}>
                        {isBank ? "Spoken Phrase (Real Target Script):" : "Spoken Audio:"}
                      </span>
                      {isBank && (
                        <div className="target-script-large" lang={language.code}>
                          {spoken.targetText || spoken.text}
                        </div>
                      )}
                      <AudioPlayer
                        blob={spoken.blob}
                        label={language.name + " audio"}
                      />
                    </div>
                    {isBank && (
                      <CorrectionForm
                        lang={language.code}
                        original={spoken.targetText || spoken.text}
                        lessonId={lessonId}
                      />
                    )}
                  </>
                )}

                {spoken?.kind === "phrase_bank_only" && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <p className="note">{spoken.reason}</p>
                    <p className="field-label" style={{ marginTop: "0.5rem" }}>
                      What BOLI can say in {language.name} today:
                    </p>
                    <ul className="phrase-options" style={{ paddingLeft: "1.2rem", margin: "0.25rem 0" }}>
                      {spoken.options.map((phrase) => (
                        <li key={phrase.id} style={{ marginBottom: "0.35rem" }}>
                          {phrase.hindi_source} —{" "}
                          <strong lang={language.code}>{phrase.target_text}</strong>{" "}
                          <button
                            type="button"
                            className="button button--secondary"
                            style={{ padding: "0.2rem 0.6rem", fontSize: "0.78rem", marginLeft: "0.5rem" }}
                            onClick={() => playPhrase(language.code, phrase)}
                          >
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                              play_arrow
                            </span>
                            <span>Play</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {spoken?.kind === "error" && (
                  <p className="error">Could not generate audio. {spoken.error}</p>
                )}
              </article>
            );
          })}
        </>
      )}

      <div className="actions">
        <button className="button button--secondary tactile-btn-secondary" onClick={onBack}>
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span>Change languages</span>
        </button>
      </div>

      {/* Printable Worksheet Modal with QR Code */}
      <PrintWorksheet
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        hindiText={hindiText}
        adapted={adapted}
        translations={translations}
        grade={grade}
        audio={audio}
      />
    </section>
  );
}
