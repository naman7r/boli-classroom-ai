import { useState, useRef } from "react";
import { transcribeAudio, translate, speak, translateAndSpeak } from "../../api";
import AudioPlayer from "../AudioPlayer";
import { translateTargetFor } from "../../utils/capability";

export default function LiveClassroom({ onLoadIntoStudio, currentGrade = 2 }) {
  const [inputText, setInputText] = useState("");
  const [selectedLang, setSelectedLang] = useState("sat"); // "sat" | "hoc" | "unr" | "kru" | "sck"
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  // Results
  const [liveResult, setLiveResult] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [activeSoundboardTab, setActiveSoundboardTab] = useState(0);

  // PALASH MTB-MLE Teacher Classroom Soundboard (Bhasha-Sahayak)
  // Designed for non-native Hindi-medium teachers without prior tribal language training
  const TEACHER_SOUNDBOARD = [
    {
      category: "कक्षा अनुशासन व व्यवस्था",
      icon: "groups",
      color: "#E65100",
      commands: [
        {
          id: "cmd-sit",
          hindi: "सब बच्चे शांत बैठो",
          hint: "All children sit quietly",
          translations: {
            hoc: { native: "सोबेन होनको चुपचाप दुब पे", translit: "Soben honko chupchap dub pe" },
            unr: { native: "सोबेन हुनको थिर दुब पे", translit: "Soben hunko thir dub pe" },
            sat: { native: "ᱥᱟᱱᱟᱢ ᱜᱤᱫᱽᱨᱟᱹ ᱛᱷᱤᱨ ᱫᱩᱲᱩᱵᱽ ᱯᱮ", translit: "Sanam gidra thir durub pe" },
            kru: { native: "हुर्मर खद्दर चूपके उक्का", translit: "Hurmar khaddar chupke ukka" },
            sck: { native: "सब छौवा मन शांत बइसू", translit: "Sab chhauwa man shant baisu" },
          },
        },
        {
          id: "cmd-line",
          hindi: "कतार (लाइन) बनाओ",
          hint: "Form a queue",
          translations: {
            hoc: { native: "सोबेन को लाइन बाई पे", translit: "Soben ko line bai pe" },
            unr: { native: "सोबेन को कतार बाई पे", translit: "Soben ko katar bai pe" },
            sat: { native: "ᱥᱟᱱᱟᱢ ᱠᱚ ᱞᱟᱭᱤᱱ ᱵᱮᱱᱟᱣ ᱯᱮ", translit: "Sanam ko line benaw pe" },
            kru: { native: "पंती कम्मना", translit: "Panti kamna" },
            sck: { native: "सब कोई कतार बनाऊ", translit: "Sab koi katar banau" },
          },
        },
        {
          id: "cmd-listen",
          hindi: "मेरी बात ध्यान से सुनो",
          hint: "Listen to me carefully",
          translations: {
            hoc: { native: "अञाः कजी ध्यान ते आयुम पे", translit: "Aña' kaji dhyan te aayum pe" },
            unr: { native: "अञाः कजी ध्यान ते आयुम पे", translit: "Aña' kaji dhyan te aayum pe" },
            sat: { native: "ᱤᱧᱟᱜ ᱠᱟᱛᱷᱟ ᱫᱷᱮᱭᱟᱱ ᱛᱮ ᱟᱸᱡᱚᱢ ᱯᱮ", translit: "Iñag katha dhyan te añjom pe" },
            kru: { native: "एंगहै कथ्था ध्यान ती मेना", translit: "Enghai katha dhyan ti mena" },
            sck: { native: "मोर बात ध्यान से सुनू", translit: "Mor baat dhyan se sunu" },
          },
        },
        {
          id: "cmd-hands",
          hindi: "हाथ ऊपर करो",
          hint: "Raise your hands",
          translations: {
            hoc: { native: "ती चेटान राकाब पे", translit: "Ti chetan rakab pe" },
            unr: { native: "ती चेटान राकाब पे", translit: "Ti chetan rakab pe" },
            sat: { native: "ᱛᱤ ᱪᱮᱛᱟᱱ ᱨᱟᱠᱟᱵ ᱯᱮ", translit: "Ti chetan rakab pe" },
            kru: { native: "खेक्खा मय्या नन्ना", translit: "Khekha mayya nanna" },
            sck: { native: "हाथ ऊपर करू", translit: "Haath oopar karu" },
          },
        },
      ],
    },
    {
      category: "प्रशंसा व उत्साहवर्धन",
      icon: "sentiment_very_satisfied",
      color: "#2E7D32",
      commands: [
        {
          id: "cmd-praise",
          hindi: "बहुत बढ़िया! शाबाश!",
          hint: "Very good! Well done!",
          translations: {
            hoc: { native: "एतों बिशी बुगी! शाबाश!", translit: "Etong bishi bugi! Sabash!" },
            unr: { native: "अड़ि बुगी! शाबाश!", translit: "Adi bugi! Sabash!" },
            sat: { native: "ᱟᱹᱰᱤ ᱱᱟᱯᱟᱭ! ᱥᱟᱵᱟᱥ!", translit: "Adi napay! Sabas!" },
            kru: { native: "कोड़हा दव! शाबाश!", translit: "Kodha dav! Sabash!" },
            sck: { native: "बहुत बेस! शाबाश!", translit: "Bahut bes! Sabash!" },
          },
        },
        {
          id: "cmd-clap",
          hindi: "सब बच्चे ताली बजाओ!",
          hint: "Clap your hands together!",
          translations: {
            hoc: { native: "सोबेन होनको ताली ठोके पे!", translit: "Soben honko taali thoke pe!" },
            unr: { native: "सोबेन हुनको ताली साड़े पे!", translit: "Soben hunko taali sade pe!" },
            sat: { native: "ᱥᱟᱱᱟᱢ ᱜᱤᱫᱽᱨᱟᱹ ᱛᱷᱟᱹᱭᱟᱹ ᱯᱮ!", translit: "Sanam gidra thayo pe!" },
            kru: { native: "हुर्मर खद्दर ताली ठोका!", translit: "Hurmar khaddar taali thoka!" },
            sck: { native: "सब छौवा मन ताली बजाऊ!", translit: "Sab chhauwa man taali bajau!" },
          },
        },
        {
          id: "cmd-good",
          hindi: "आप बहुत अच्छे बच्चे हो",
          hint: "You are very good children",
          translations: {
            hoc: { native: "अपे एतों बुगी होनको पे", translit: "Ape etong bugi honko pe" },
            unr: { native: "अपे अड़ि बुगी हुनको पे", translit: "Ape adi bugi hunko pe" },
            sat: { native: "ᱟᱯᱮ ᱫᱚ ᱟᱹᱰᱤ ᱵᱷᱟᱹᱜᱤ ᱜᱤᱫᱽᱨᱟᱹ ᱠᱟᱱᱟ ᱯᱮ", translit: "Ape do adi bhagi gidra kana pe" },
            kru: { native: "नीम कोड़हा दव खद्दर रहअत", translit: "Neem kodha dav khaddar rahat" },
            sck: { native: "रउरे मन बहुत बेस छौवा हेकी", translit: "Raure man bahut bes chhauwa heki" },
          },
        },
      ],
    },
    {
      category: "दैनिक क्रिया व FLN अभ्यास",
      icon: "auto_stories",
      color: "#0288D1",
      commands: [
        {
          id: "cmd-book",
          hindi: "अपनी किताब खोलो",
          hint: "Open your book",
          translations: {
            hoc: { native: "अपन पुथी उगुड़े पे", translit: "Apan puthi ugude pe" },
            unr: { native: "अपन पुथी उगुड़े पे", translit: "Apan puthi ugude pe" },
            sat: { native: "ᱟᱯᱱᱟᱨ ᱯᱩᱛᱷᱤ ᱡᱷᱤᱡᱽ ᱯᱮ", translit: "Apnar puthi jhij pe" },
            kru: { native: "तम्है पोथी खोल्हा", translit: "Tamhai pothi kholha" },
            sck: { native: "अपन किताब खोलू", translit: "Apan kitab kholu" },
          },
        },
        {
          id: "cmd-write",
          hindi: "सफाई से लिखो",
          hint: "Write neatly and cleanly",
          translations: {
            hoc: { native: "सफा ते ओल पे", translit: "Safa te ol pe" },
            unr: { native: "सफा ते ओल पे", translit: "Safa te ol pe" },
            sat: { native: "ᱥᱟᱯᱷᱟ ᱛᱮ ᱚᱞ ᱢᱮ", translit: "Sapha te ol me" },
            kru: { native: "सफा ती टुड़ा", translit: "Safa ti tuda" },
            sck: { native: "सफा-सफा लिखू", translit: "Safa-safa likhu" },
          },
        },
        {
          id: "cmd-water",
          hindi: "पानी पीकर आओ",
          hint: "Go and drink water",
          translations: {
            hoc: { native: "दाः नू एते हिजुः मे", translit: "Daa' nu ete hiju' me" },
            unr: { native: "दाः नू एते हिजुः मे", translit: "Daa' nu ete hiju' me" },
            sat: { native: "ᱫᱟᱜ ᱧᱩ ᱟᱹᱜᱩᱭ ᱢᱮ", translit: "Daag ñu aguj me" },
            kru: { native: "अम्म उंना बारा", translit: "Amm unna bara" },
            sck: { native: "पानी पी के आवू", translit: "Paani pee ke aawu" },
          },
        },
        {
          id: "cmd-hands-wash",
          hindi: "हाथ धो लो",
          hint: "Wash your hands",
          translations: {
            hoc: { native: "ती अबुः मे", translit: "Ti abu' me" },
            unr: { native: "ती अबुः मे", translit: "Ti abu' me" },
            sat: { native: "ᱛᱤ ᱟᱹᱨᱩᱵᱽ ᱢᱮ", translit: "Ti arub me" },
            kru: { native: "खेक्खा नोरआ", translit: "Khekha nor'aa" },
            sck: { native: "हाथ धोई लेवू", translit: "Haath dhoi lewu" },
          },
        },
      ],
    },
  ];

  const DIALECTS = [
    { code: "sat", name: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)", target: "sat_Olck", type: "neural", badge: "Neural MT" },
    { code: "hoc", name: "Ho (हो Devanagari)", target: "hoc_Deva", type: "transfer", badge: "Linguistic Transfer" },
    { code: "unr", name: "Mundari (मुंडारी)", target: "unr_Deva", type: "transfer", badge: "Linguistic Transfer" },
    { code: "kru", name: "Kurukh (कुड़ुख़)", target: "kru_Deva", type: "neural", badge: "Neural MT" },
    { code: "sck", name: "Sadri (नागपुरी)", target: "sck_Deva", type: "transfer", badge: "Morphological Transfer" },
  ];

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setStatusMessage("Transcribing teacher's Hindi speech via Meta MMS ASR…");
        setIsProcessing(true);
        try {
          const res = await transcribeAudio(audioBlob, "hin");
          if (res.text) {
            setInputText(res.text);
            await processTeacherSentence(res.text, selectedLang);
          }
        } catch (err) {
          setError("Speech recognition failed: " + err.message);
        } finally {
          setIsProcessing(false);
          setStatusMessage("");
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError("Microphone access not available: " + err.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function processTeacherSentence(textToProcess, langCode) {
    const query = (textToProcess || inputText).trim();
    if (!query) return;

    setIsProcessing(true);
    setError("");
    setLiveResult(null);

    try {
      const dialectMeta = DIALECTS.find((d) => d.code === langCode);
      const target = translateTargetFor({ code: langCode, translation: "full" }) || (langCode === "sat" ? "sat_Olck" : `${langCode}_Deva`);

      setStatusMessage(`Translating & synthesizing ${dialectMeta?.name || langCode}…`);
      let resultData = null;
      let audioBlob = null;

      try {
        resultData = await translateAndSpeak(query, target);
        if (resultData.audio_base64) {
          const binary = atob(resultData.audio_base64);
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
          audioBlob = new Blob([bytes], { type: "audio/wav" });
        } else if (resultData.translated) {
          const audioRes = await speak(resultData.translation, langCode);
          if (audioRes.kind === "audio") audioBlob = audioRes.blob;
        }
      } catch (pipeErr) {
        // Direct translate + speak fallback
        const trans = await translate(query, target);
        const audioRes = await speak(trans.translated, langCode);
        resultData = {
          translation: trans.translated,
          script_contamination: trans.script_contamination,
          engine: trans.engine,
          mode: trans.mode,
        };
        if (audioRes.kind === "audio") audioBlob = audioRes.blob;
      }

      setLiveResult({
        originalHindi: query,
        targetScript: resultData.translation,
        transliteration: resultData.transliteration || null,
        isContaminated: resultData.script_contamination,
        audioBlob,
        langName: dialectMeta?.name || langCode,
        langCode,
        engine: resultData.engine,
        mode: resultData.mode,
      });
    } catch (err) {
      setError("Processing failed: " + err.message);
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  }

  // 1-Tap Soundboard Fast-Path Execution for Non-Native Teachers
  async function handleSoundboardCommand(cmd) {
    const tr = cmd.translations[selectedLang] || cmd.translations["sat"] || cmd.translations["hoc"] || {};
    const nativeText = tr.native || cmd.hindi;
    const translit = tr.translit || "";
    const dialectMeta = DIALECTS.find((d) => d.code === selectedLang);

    setInputText(cmd.hindi);
    setIsProcessing(true);
    setStatusMessage(`Synthesizing 1-tap ${dialectMeta?.name || selectedLang} phrase…`);
    setError("");

    try {
      const audioRes = await speak(nativeText, selectedLang);
      let audioBlob = null;
      if (audioRes.kind === "audio") {
        audioBlob = audioRes.blob;
        try {
          const audioUrl = URL.createObjectURL(audioBlob);
          const tempAudio = new Audio(audioUrl);
          tempAudio.play().catch(() => {});
        } catch (e) {
          console.warn("Autoplay blocked:", e);
        }
      }

      setLiveResult({
        originalHindi: cmd.hindi,
        targetScript: audioRes?.targetText || nativeText,
        transliteration: translit,
        isContaminated: false,
        audioBlob,
        langName: dialectMeta?.name || selectedLang,
        langCode: selectedLang,
        engine: "1-Tap MTB-MLE Classroom Soundboard",
        mode: "soundboard_fastpath",
        hint: cmd.hint,
      });
    } catch (err) {
      setError("Audio synthesis failed: " + err.message);
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  }

  return (
    <section className="live-classroom-section" aria-labelledby="live-heading">
      <div className="section-eyebrow">
        <span className="eyebrow-tag">कक्षा १–५ त्वरित मौखिक संवाद</span>
        <span>शिक्षक भाषा-सहायक · लाइव कक्षा उच्चारण (Teacher Oral Companion)</span>
      </div>
      <h1 id="live-heading" className="screen-title">
        Teacher Oral Companion <span lang="hi">(शिक्षक भाषा-सहायक)</span>
      </h1>
      <p className="screen-subtitle">
        Designed for non-native Hindi teachers in Jharkhand tribal schools. Use the 1-Tap Soundboard for essential routines, or speak any Hindi instruction aloud to generate tribal audio and phonetic pronunciation guides.
      </p>

      {/* Target Classroom Tongue Selector */}
      <div className="live-lang-picker sun-card-shadow">
        <span className="picker-label">Target Classroom Tongue:</span>
        <div className="picker-buttons">
          {DIALECTS.map((d) => (
            <button
              key={d.code}
              type="button"
              className={`live-lang-btn ${selectedLang === d.code ? "active" : ""}`}
              onClick={() => {
                setSelectedLang(d.code);
                if (liveResult) {
                  processTeacherSentence(inputText, d.code);
                }
              }}
            >
              <span className="lang-btn-name">{d.name}</span>
              <span className={`lang-btn-tag tag-${d.type}`}>{d.badge}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 1-Tap Teacher Classroom Soundboard (Bhasha-Sahayak) */}
      <div className="teacher-soundboard-panel sun-card-shadow">
        <div className="soundboard-header">
          <div className="soundboard-title-group">
            <span className="material-symbols-outlined soundboard-icon">volume_up</span>
            <div>
              <h2 className="soundboard-title">1-Tap Bhasha-Sahayak Soundboard (कक्षा भाषा-सहायक)</h2>
              <p className="soundboard-subtitle">
                Classroom routines with phonetic pronunciation guides for primary teachers
              </p>
            </div>
          </div>
          <div className="soundboard-active-meta">
            <span className="soundboard-dialect-pill">
              <span>Selected Dialect:</span>
              <strong>{DIALECTS.find((d) => d.code === selectedLang)?.name.split(" ")[0]}</strong>
            </span>
            <span className="soundboard-engine-pill">
              <span className="material-symbols-outlined text-xs">record_voice_over</span>
              {selectedLang === "sat" ? "Indic Parler-TTS (Arjun / Pushpa)" : "Meta MMS Speech Synthesis"}
            </span>
          </div>
        </div>

        {/* Soundboard Category Tabs */}
        <div className="soundboard-category-tabs">
          {TEACHER_SOUNDBOARD.map((cat, idx) => (
            <button
              key={idx}
              type="button"
              className={`soundboard-tab-btn ${activeSoundboardTab === idx ? "active" : ""}`}
              onClick={() => setActiveSoundboardTab(idx)}
            >
              <span className="material-symbols-outlined text-sm">{cat.icon}</span>
              <span>{cat.category}</span>
            </button>
          ))}
        </div>

        {/* 1-Tap Soundboard Command Grid */}
        <div className="soundboard-grid">
          {TEACHER_SOUNDBOARD[activeSoundboardTab].commands.map((cmd) => {
            const tr = cmd.translations[selectedLang] || cmd.translations["sat"] || cmd.translations["hoc"] || {};
            return (
              <div
                key={cmd.id}
                className="soundboard-chip-card"
                onClick={() => handleSoundboardCommand(cmd)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSoundboardCommand(cmd)}
              >
                <div className="sb-card-header">
                  <span className="sb-hindi-phrase">{cmd.hindi}</span>
                  <span
                    className="sb-play-btn"
                    title="Tap to speak aloud over classroom speaker"
                    aria-hidden="true"
                  >
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                  </span>
                </div>
                <div className="sb-native-phrase" lang={selectedLang}>
                  {tr.native}
                </div>
                {tr.translit && (
                  <div className="sb-phonetic-guide">
                    🗣️ <em>"{tr.translit}"</em>
                  </div>
                )}
                <div className="sb-hint-tag">{cmd.hint}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Classroom Control Console for Custom Sentences */}
      <div className="panel sun-card-shadow live-console-panel">
        <div className="live-mic-hero">
          <button
            type="button"
            className={`live-giant-mic-btn ${isRecording ? "recording-pulse" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            aria-label={isRecording ? "Stop dictation" : "Click to speak Hindi instruction aloud"}
            title="Click to speak Hindi instruction aloud"
          >
            <span className="material-symbols-outlined mic-giant-icon" style={{ fontVariationSettings: "'FILL' 1" }}>
              mic
            </span>
          </button>

          <div className="mic-hero-text">
            <h2>
              {isRecording
                ? "Listening to teacher… (Click when done)"
                : "Custom Speech Input (कक्षा में नया वाक्य बोलें)"}
            </h2>
            <p className="text-secondary text-sm">
              Speak any sentence in Hindi. BOLI instantly adapts, translates to the child's mother tongue, and plays synthesized tribal speech audio over classroom speakers.
            </p>
          </div>
        </div>

        {/* Input Text Box */}
        <div className="live-input-box">
          <input
            type="text"
            className="live-text-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                processTeacherSentence(inputText, selectedLang);
              }
            }}
            placeholder="यहाँ हिंदी वाक्य लिखें या बोलें... (उदा: आज हम पौधे के बारे में सीखेंगे)"
            lang="hi"
          />
          <button
            type="button"
            className="button button--primary tactile-btn-primary"
            onClick={() => processTeacherSentence(inputText, selectedLang)}
            disabled={isProcessing || !inputText.trim()}
          >
            <span>
              {isProcessing ? "Processing…" : "अनुवाद व उच्चारण (Translate & Speak)"}
            </span>
            <span className="material-symbols-outlined text-base">record_voice_over</span>
          </button>
        </div>

        {/* Live Processing Status */}
        {isProcessing && (
          <div className="live-status-alert" role="status">
            <span className="spinner" aria-hidden="true" />
            <span>{statusMessage || "Processing classroom instruction…"}</span>
          </div>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        {/* Live Result Screen for Kids in Class */}
        {liveResult && (
          <div className="live-output-card">
            <div className="output-card-header">
              <div className="output-meta">
                <span className="lang-badge">{liveResult.langName}</span>
                <span className="pedagogy-badge">Class {currentGrade} Pacing</span>
              </div>
            </div>

            {/* Giant Native Script for High Visibility */}
            <div className="giant-native-display" lang={liveResult.langCode}>
              {liveResult.targetScript}
            </div>

            {/* Phonetic Pronunciation Guide for Non-Native Hindi Teachers */}
            {liveResult.transliteration && (
              <div className="phonetic-teacher-guide-box">
                <span className="material-symbols-outlined guide-icon">record_voice_over</span>
                <div className="guide-content">
                  <span className="guide-label">गैर-जनजातीय शिक्षक उच्चारण निर्देश (Say Aloud):</span>
                  <strong className="guide-phonetic">"{liveResult.transliteration}"</strong>
                </div>
              </div>
            )}

            {liveResult.originalHindi && (
              <div className="simplified-subtext" lang="hi">
                <span>शिक्षक का वाक्य (Hindi): </span>
                <strong>{liveResult.originalHindi}</strong>
              </div>
            )}

            {/* Audio Player */}
            {liveResult.audioBlob && (
              <div className="live-audio-wrap">
                <AudioPlayer blob={liveResult.audioBlob} label={`${liveResult.langName} Spoken Audio`} />
              </div>
            )}

            {/* Classroom Chanting Guide */}
            <div className="classroom-chant-banner">
              <span className="material-symbols-outlined text-secondary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                groups
              </span>
              <div>
                <strong>कक्षा अभ्यास (Chant Together!):</strong>
                <p>शिक्षक एक बार ऑडियो बजाएं, फिर सभी बच्चे एक साथ तीन बार दोहराएं।</p>
              </div>
            </div>

            {/* Bridge to Studio */}
            {onLoadIntoStudio && (
              <div className="live-footer-actions">
                <button
                  type="button"
                  className="button button--secondary tactile-btn-secondary"
                  onClick={() => onLoadIntoStudio(liveResult.originalHindi)}
                >
                  <span className="material-symbols-outlined text-sm">auto_stories</span>
                  <span>Open in Full Lesson Studio</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
