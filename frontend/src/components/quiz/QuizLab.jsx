import { useState, useMemo, useRef } from "react";
import { speak, extractChapter } from "../../api";

// Sound effects using Web Audio API (zero external audio asset dependencies)
function playQuizChime(isCorrect) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (isCorrect) {
      // Cheerful high-pitch arpeggio
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      // Soft gentle low buzz
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(200, now + 0.25);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch {
    // Autoplay or audio context policy catch
  }
}

// JCERT Foundational Literacy & Numeracy (FLN) Grade Metadata
const GRADE_METADATA = {
  1: {
    gradeNum: 1,
    title: "कक्षा 1 (Class 1)",
    label: "वर्ण, ध्वनि व आधारभूत वस्तु",
    focus: "चित्र पहचान, प्राथमिक ध्वनियाँ, शरीर के अंग और परिवार",
    color: "#E65100",
  },
  2: {
    gradeNum: 2,
    title: "कक्षा 2 (Class 2)",
    label: "दैनिक क्रिया व परिवेश",
    focus: "कक्षा निर्देश, दैनिक आदतें, पढ़ना, लिखना और प्राथमिक क्रियाएं",
    color: "#2E7D32",
  },
  3: {
    gradeNum: 3,
    title: "कक्षा 3 (Class 3)",
    label: "प्रकृति, पशु-पक्षी व EVS",
    focus: "झारखंड के वन्यजीव, सखुआ, महुआ, नदियाँ और ऋतुएं",
    color: "#0288D1",
  },
  4: {
    gradeNum: 4,
    title: "कक्षा 4 (Class 4)",
    label: "कृषि, हाट व समुदाय",
    focus: "साप्ताहिक ग्रामीण हाट, धान की खेती, स्थानीय शिल्प और सहयोग",
    color: "#6A1B9A",
  },
  5: {
    gradeNum: 5,
    title: "कक्षा 5 (Class 5)",
    label: "संस्कृति, लोक परंपरा व समझ",
    focus: "सरहुल, करमा पर्व, जल-जंगल-ज़मीन और उन्नत बहुभाषी समझ",
    color: "#C2185B",
  },
};

// Dialect Metadata
const LANGUAGE_LABELS = {
  sat: "Santali (ᱚᱞ ᱪᱤᱠᱤ)",
  hoc: "Ho (हो / 𑢹𑣉𑣉)",
  unr: "Mundari (मुंडारी)",
  kru: "Kurukh (कुड़ुख़)",
  sck: "Sadri (नागपुरी)",
};

// Target codes for /translate endpoint
const TRANSLATE_TARGETS = {
  sat: "sat_Olck",
  hoc: "hoc_Deva",
  unr: "unr_Deva",
  kru: "kru_Deva",
  sck: "sck_Deva",
};

// Curated 5-Grade Question Bank aligned with JCERT primary textbooks
const GRADE_WISE_QUESTION_BANK = {
  1: {
    sat: [
      {
        id: "sat-g1-1",
        type: "audio",
        prompt: "ध्वनि सुनें और सही वस्तु पहचानें (Listen & Identify):",
        audioWord: "ᱫᱟᱜ",
        audioTranslit: "Daag",
        options: [
          { text: "पानी / जल (Water)", correct: true },
          { text: "आग / लपट (Fire)", correct: false },
          { text: "मिट्टी (Soil)", correct: false },
          { text: "हवा (Air)", correct: false },
        ],
        explanation: "संथाली में पानी को 'ᱫᱟᱜ' (Daag) कहते हैं।",
      },
      {
        id: "sat-g1-2",
        type: "vocab",
        prompt: "शरीर का अंग: हिंदी शब्द 'आँख' को संथाली (Ol Chiki) में क्या कहते हैं?",
        subPrompt: "Word: आँख (Eye)",
        options: [
          { text: "ᱢᱮᱫ (Med)", correct: true },
          { text: "ᱞᱩᱛᱩᱨ (Lutur / कान)", correct: false },
          { text: "ᱛᱤ (Ti / हाथ)", correct: false },
          { text: "ᱡᱟᱝᱜᱟ (Janga / पैर)", correct: false },
        ],
        explanation: "संथाली में आँख = 'ᱢᱮᱫ' (Med), कान = 'ᱞᱩᱛᱩᱨ' (Lutur), हाथ = 'ᱛᱤ' (Ti)।",
      },
      {
        id: "sat-g1-3",
        type: "context",
        prompt: "कक्षा में नमस्ते / अभिवादन के लिए संथाली का कौन सा आदरसूचक शब्द प्रयोग करेंगे?",
        options: [
          { text: "ᱡᱚᱦᱟᱨ (Johar)", correct: true },
          { text: "ᱦᱮᱸ (Hẽ)", correct: false },
          { text: "ᱪᱟᱞᱟᱜ (Chalag)", correct: false },
          { text: "ᱚᱞ (Ol)", correct: false },
        ],
        explanation: "झारखंड के सभी आदिवासी समुदायों में 'जोहार' (ᱡᱚᱦᱟᱨ) आदरणीय अभिवादन है।",
      },
    ],
    hoc: [
      {
        id: "hoc-g1-1",
        type: "audio",
        prompt: "ध्वनि सुनें और सही अर्थ चुनें (Listen to Ho voice):",
        audioWord: "दाः",
        audioTranslit: "Daa' (𑢵𑢫)",
        options: [
          { text: "पानी / जल (Water)", correct: true },
          { text: "रोटी (Food)", correct: false },
          { text: "पेड़ (Tree)", correct: false },
          { text: "घर (Home)", correct: false },
        ],
        explanation: "हो भाषा में पानी को 'दाः' (Daa') कहते हैं।",
      },
      {
        id: "hoc-g1-2",
        type: "vocab",
        prompt: "हो (Ho) भाषा में 'घर' को क्या कहते हैं?",
        subPrompt: "Word: घर (Home)",
        options: [
          { text: "ओवाः (Owa' / 𑢪𑢲𑢫)", correct: true },
          { text: "दारु (Daru)", correct: false },
          { text: "मांडी (Mandi)", correct: false },
          { text: "इटुन (Itun)", correct: false },
        ],
        explanation: "हो भाषा में लेनिशन के कारण घर को 'ओवाः' (वारंग क्षिति: 𑢪𑢲𑢫) कहते हैं।",
      },
      {
        id: "hoc-g1-3",
        type: "vocab",
        prompt: "शरीर का अंग: 'आँख' को हो भाषा में क्या कहा जाता है?",
        options: [
          { text: "मेट् (Med / 𑢶𑢧)", correct: true },
          { text: "लुतुुर (Lutur)", correct: false },
          { text: "ती (Ti)", correct: false },
          { text: "काता (Kata)", correct: false },
        ],
        explanation: "हो भाषा में आँख = 'मेट्', कान = 'लुतुुर', हाथ = 'ती'।",
      },
    ],
    unr: [
      {
        id: "unr-g1-1",
        type: "audio",
        prompt: "ध्वनि पहचानें: मुंडारी शब्द 'दाः' का क्या अर्थ है?",
        audioWord: "दाः",
        audioTranslit: "Daa'",
        options: [
          { text: "पानी (Water)", correct: true },
          { text: "दूध (Milk)", correct: false },
          { text: "छांव (Shade)", correct: false },
          { text: "धूप (Sunlight)", correct: false },
        ],
        explanation: "मुंडारी में 'दाः' का अर्थ पानी / जल है।",
      },
      {
        id: "unr-g1-2",
        type: "vocab",
        prompt: "मुंडारी में 'घर' के लिए मानक शब्द कौन सा है?",
        subPrompt: "Word: घर / मकान",
        options: [
          { text: "ओड़ाः (Oda')", correct: true },
          { text: "दारु (Daru)", correct: false },
          { text: "हुन (Hun)", correct: false },
          { text: "बिर (Bir)", correct: false },
        ],
        explanation: "मुंडारी में घर को 'ओड़ाः' कहते हैं (हो में 'ओवाः')।",
      },
      {
        id: "unr-g1-3",
        type: "context",
        prompt: "मुंडारी में छोटे बच्चे को प्यार से क्या पुकारते हैं?",
        options: [
          { text: "हुन / होन (Hun / Hon)", correct: true },
          { text: "आलोर (Alor)", correct: false },
          { text: "मांडी (Mandi)", correct: false },
          { text: "सेने (Sene)", correct: false },
        ],
        explanation: "मुंडारी में संतान या छोटे बच्चे को 'हुन' या 'होन' कहा जाता है।",
      },
    ],
    kru: [
      {
        id: "kru-g1-1",
        type: "audio",
        prompt: "ध्वनि सुनें और सही अर्थ चुनें (Kurukh voice):",
        audioWord: "अम्म",
        audioTranslit: "Amm",
        options: [
          { text: "पानी (Water)", correct: true },
          { text: "रोटी (Bread)", correct: false },
          { text: "आकाश (Sky)", correct: false },
          { text: "हवा (Air)", correct: false },
        ],
        explanation: "कुड़ुख़ (उरांव) भाषा में पानी को 'अम्म' कहा जाता है।",
      },
      {
        id: "kru-g1-2",
        type: "vocab",
        prompt: "कुड़ुख़ में 'घर' को क्या कहते हैं?",
        options: [
          { text: "एड़पा (Edpa)", correct: true },
          { text: "मन (Mann)", correct: false },
          { text: "आल (Aal)", correct: false },
          { text: "बीड़ी (Bidi)", correct: false },
        ],
        explanation: "कुड़ुख़ में घर = 'एड़पा'।",
      },
      {
        id: "kru-g1-3",
        type: "vocab",
        prompt: "शरीर का अंग: कुड़ुख़ में 'आँख' को क्या कहते हैं?",
        options: [
          { text: "खन्न (Khann)", correct: true },
          { text: "खेब्दा (Khebda / कान)", correct: false },
          { text: "खेक्खा (Khekha / हाथ)", correct: false },
          { text: "खेद्द (Khedd / पैर)", correct: false },
        ],
        explanation: "कुड़ुख़ में आँख = खन्न, कान = खेब्दा, हाथ = खेक्खा।",
      },
    ],
    sck: [
      {
        id: "sck-g1-1",
        type: "vocab",
        prompt: "सादरी (नागपुरी) में 'बच्चा / बालक' के लिए प्रचलित शब्द:",
        options: [
          { text: "छौवा (Chhauwa)", correct: true },
          { text: "होन (Hon)", correct: false },
          { text: "खदरा (Khadra)", correct: false },
          { text: "गिदर (Gidar)", correct: false },
        ],
        explanation: "सादरी / नागपुरी में बच्चे को 'छौवा' कहते हैं।",
      },
      {
        id: "sck-g1-2",
        type: "context",
        prompt: "नागपुरी / सादरी में आदरणीय अभिवादन:",
        options: [
          { text: "गोड़ लागी / जोहार (God Laagi / Johar)", correct: true },
          { text: "गुड मॉर्निंग", correct: false },
          { text: "टाटा", correct: false },
          { text: "जाओ", correct: false },
        ],
        explanation: "सादरी संस्कृति में 'गोड़ लागी' और 'जोहार' सबसे सम्मानित अभिवादन हैं।",
      },
      {
        id: "sck-g1-3",
        type: "vocab",
        prompt: "सादरी में 'पानी' के छोटे प्राकृतिक स्रोत को क्या कहते हैं?",
        options: [
          { text: "डाँड़ी / चुआँ (Dandi / Chua)", correct: true },
          { text: "सड़क", correct: false },
          { text: "पहाड़", correct: false },
          { text: "मकान", correct: false },
        ],
        explanation: "झारखंड के गांवों में प्राकृतिक जलस्रोत को 'डाँड़ी' या 'चुआँ' कहते हैं।",
      },
    ],
  },
  2: {
    sat: [
      {
        id: "sat-g2-1",
        type: "audio",
        prompt: "ध्वनि सुनें: संथाली में शिक्षक की आज्ञा पहचानें:",
        audioWord: "ᱚᱞ ᱢᱮ",
        audioTranslit: "Ol me",
        options: [
          { text: "लिखो (Write)", correct: true },
          { text: "दौड़ो (Run)", correct: false },
          { text: "हँसो (Laugh)", correct: false },
          { text: "सो जाओ (Sleep)", correct: false },
        ],
        explanation: "संथाली में 'ᱚᱞ ᱢᱮ' का अर्थ 'लिखो' होता है। ᱯᱟᱲᱦᱟᱣ ᱢᱮ = पढ़ो।",
      },
      {
        id: "sat-g2-2",
        type: "context",
        prompt: "कक्षा निर्देश: शिक्षक कहते हैं 'यहाँ बैठो'। संथाली में सही वाक्य चुनें:",
        options: [
          { text: "ᱱᱚᱸᱰᱮ ᱫᱩᱲᱩᱵᱽ ᱢᱮ (Noṇḍe duṛub me)", correct: true },
          { text: "ᱦᱟᱱᱛᱮ ᱥᱮᱱᱚᱜ ᱢᱮ (Hante senog me)", correct: false },
          { text: "ᱠᱟᱛᱷᱟ ᱟᱞᱚᱢ ᱨᱚᱲᱟ (Katha alom roṛa)", correct: false },
          { text: "ᱫᱟᱹᱲ ᱢᱮ (Daṛ me)", correct: false },
        ],
        explanation: "यहाँ बैठो = 'ᱱᱚᱸᱰᱮ ᱫᱩᱲᱩᱵᱽ ᱢᱮ'।",
      },
      {
        id: "sat-g2-3",
        type: "vocab",
        prompt: "हिंदी शब्द 'किताब / पुस्तक' का संथाली रूप:",
        options: [
          { text: "ᱯᱩᱛᱷᱤ (Puthi)", correct: true },
          { text: "ᱠᱚᱞᱚᱢ (Kolom)", correct: false },
          { text: "ᱫᱟᱨᱮ (Dare)", correct: false },
          { text: "ᱚᱲᱟᱜ (Oṛag)", correct: false },
        ],
        explanation: "संथाली और मुंडा भाषाओं में किताब को 'ᱯᱩᱛᱷᱤ' (Puthi) कहते हैं।",
      },
    ],
    hoc: [
      {
        id: "hoc-g2-1",
        type: "context",
        prompt: "कक्षा अनुशासन: शिक्षक कहते हैं 'चुपचाप बैठो'। 'हो' भाषा में सही वाक्य:",
        options: [
          { text: "चुपचाप दुब मे (Chupchap dub me)", correct: true },
          { text: "सेने मे (Sene me)", correct: false },
          { text: "जोम मे (Jom me)", correct: false },
          { text: "उगुड़े मे (Ugude me)", correct: false },
        ],
        explanation: "हो भाषा में 'बैठना' = 'दुब'। अतः आज्ञा = 'दुब मे'।",
      },
      {
        id: "hoc-g2-2",
        type: "vocab",
        prompt: "'पढ़ना और लिखना' को हो भाषा में क्या कहते हैं?",
        options: [
          { text: "इटुन अड़ाः रे ओल-पाड़ाव (Ol-Padaw)", correct: true },
          { text: "राने-सेने", correct: false },
          { text: "जोम-नू", correct: false },
          { text: "गीतीः-उठौ", correct: false },
        ],
        explanation: "हो भाषा में 'ओल' = लिखना और 'पाड़ाव' = पढ़ना।",
      },
      {
        id: "hoc-g2-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: हो शब्द 'मांडी' का क्या अर्थ है?",
        audioWord: "मांडी",
        audioTranslit: "Mandi (𑢶𑢡𑢣𑢲)",
        options: [
          { text: "भात / पकाया हुआ अन्न (Cooked Rice/Food)", correct: true },
          { text: "कपड़ा (Cloth)", correct: false },
          { text: "जूता (Shoe)", correct: false },
          { text: "कलम (Pen)", correct: false },
        ],
        explanation: "हो भाषा में भात/भोजन को 'मांडी' (𑢶𑢡𑢣𑢲) कहते हैं।",
      },
    ],
    unr: [
      {
        id: "unr-g2-1",
        type: "context",
        prompt: "कक्षा अभ्यास: 'बच्चे स्कूल जाते हैं' - मुंडारी में 'जाते हैं' क्रिया रूप:",
        options: [
          { text: "सेनोःआ तनाको (Senowa tanako)", correct: true },
          { text: "ओलोः तनाको", correct: false },
          { text: "गीतीः तनाको", correct: false },
          { text: "जोम तनाको", correct: false },
        ],
        explanation: "मुंडारी में जाना = सेनोः, वर्तमान निरंतर = -तना, बहुवचन = -को।",
      },
      {
        id: "unr-g2-2",
        type: "vocab",
        prompt: "मुंडारी में 'किताब खोलो' का सही रूप क्या होगा?",
        options: [
          { text: "पुथी उगुड़े मे (Puthi ugude me)", correct: true },
          { text: "दाः नू मे", correct: false },
          { text: "ओड़ाः सेनोः मे", correct: false },
          { text: "सिंगी एरा मे", correct: false },
        ],
        explanation: "किताब = पुथी, खोलना = उगुड़े। 'पुथी उगुड़े मे' = किताब खोलो।",
      },
      {
        id: "unr-g2-3",
        type: "audio",
        prompt: "ध्वनि सुनें और सही अर्थ बताएं (Mundari audio):",
        audioWord: "दारु",
        audioTranslit: "Daru",
        options: [
          { text: "पेड़ / वृक्ष (Tree)", correct: true },
          { text: "घास (Grass)", correct: false },
          { text: "पक्षी (Bird)", correct: false },
          { text: "नदी (River)", correct: false },
        ],
        explanation: "मुंडारी में पेड़ को 'दारु' कहते हैं।",
      },
    ],
    kru: [
      {
        id: "kru-g2-1",
        type: "context",
        prompt: "शिक्षक निर्देश: 'यहाँ बैठो'। कुड़ुख़ में सही वाक्य चुनें:",
        options: [
          { text: "ईसन उक्का (Isan ukka)", correct: true },
          { text: "कला (Kala)", correct: false },
          { text: "मोखा (Mokha)", correct: false },
          { text: "टुड़ा (Tuda)", correct: false },
        ],
        explanation: "कुड़ुख़ में 'ईसन' = यहाँ, 'उक्का' = बैठो।",
      },
      {
        id: "kru-g2-2",
        type: "vocab",
        prompt: "कुड़ुख़ में 'लिखना' क्रिया को क्या कहते हैं?",
        options: [
          { text: "टुड़ना (Tudna)", correct: true },
          { text: "पड़ना (Padna)", correct: false },
          { text: "ओना (Ona)", correct: false },
          { text: "बेचना (Bechna)", correct: false },
        ],
        explanation: "कुड़ुख़ में लिखना = 'टुड़ना' (Tudna), पढ़ना = 'पड़ना'।",
      },
      {
        id: "kru-g2-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: कुड़ुख़ शब्द 'मन' का क्या अर्थ है?",
        audioWord: "मन",
        audioTranslit: "Mann",
        options: [
          { text: "पेड़ / वृक्ष (Tree)", correct: true },
          { text: "मनुष्य (Man)", correct: false },
          { text: "हृदय (Heart)", correct: false },
          { text: "पहाड़ (Mountain)", correct: false },
        ],
        explanation: "कुड़ुख़ में पेड़ / वृक्ष को 'मन' (Mann) कहा जाता है।",
      },
    ],
    sck: [
      {
        id: "sck-g2-1",
        type: "context",
        prompt: "कक्षा निर्देश: शिक्षक कहते हैं 'सफाई से लिखो'। सादरी (नागपुरी) में आदरार्थक वाक्य:",
        options: [
          { text: "सफा-सफा लिखू (Safa-safa likhu)", correct: true },
          { text: "किताब खोलू", correct: false },
          { text: "चुपचाप बइसू", correct: false },
          { text: "दौड़ के जा", correct: false },
        ],
        explanation: "सादरी में कक्षा आज्ञा में '-ऊ' आदरार्थक प्रत्यय लगता है: 'सफा-सफा लिखू'।",
      },
      {
        id: "sck-g2-2",
        type: "vocab",
        prompt: "सादरी में 'अपन जगह में बइसू' का क्या मतलब है?",
        options: [
          { text: "अपने स्थान पर बैठिए (Sit in your place)", correct: true },
          { text: "घर चले जाइए", correct: false },
          { text: "गाना गाइए", correct: false },
          { text: "किताब बंद करिए", correct: false },
        ],
        explanation: "बइसू = बैठिए, अपन जगह में = अपने स्थान पर।",
      },
      {
        id: "sck-g2-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: सादरी शब्द 'गाछ' का क्या अर्थ है?",
        audioWord: "गाछ",
        audioTranslit: "Gaachh",
        options: [
          { text: "पेड़ / वृक्ष (Tree)", correct: true },
          { text: "फूल (Flower)", correct: false },
          { text: "फल (Fruit)", correct: false },
          { text: "घास (Grass)", correct: false },
        ],
        explanation: "सादरी / नागपुरी में पेड़ को 'गाछ' या 'पेड़' कहते हैं।",
      },
    ],
  },
  3: {
    sat: [
      {
        id: "sat-g3-1",
        type: "audio",
        prompt: "ध्वनि सुनें: संथाली में इस प्राकृतिक शब्द का क्या अर्थ है?",
        audioWord: "ᱫᱟᱨᱮ",
        audioTranslit: "Dare",
        options: [
          { text: "पेड़ / वृक्ष (Tree)", correct: true },
          { text: "नदी (River)", correct: false },
          { text: "पहाड़ (Mountain)", correct: false },
          { text: "बादल (Cloud)", correct: false },
        ],
        explanation: "संथाली में पेड़ को 'ᱫᱟᱨᱮ' (Dare) कहते हैं। जैसे: ᱥᱟᱨᱡᱚᱢ ᱫᱟᱨᱮ (सखुआ का पेड़)।",
      },
      {
        id: "sat-g3-2",
        type: "vocab",
        prompt: "EVS पर्यावरण: संथाली में 'जंगल / वन' को क्या कहा जाता है?",
        subPrompt: "Word: जंगल (Forest)",
        options: [
          { text: "ᱵᱤᱨ (Bir)", correct: true },
          { text: "ᱜᱟᱰᱟ (Gada / नदी)", correct: false },
          { text: "ᱵᱩᱨᱩ (Buru / पहाड़)", correct: false },
          { text: "ᱦᱟᱥᱟ (Hasa / मिट्टी)", correct: false },
        ],
        explanation: "संथाली में जंगल = 'ᱵᱤᱨ' (Bir), नदी = 'ᱜᱟᱰᱟ' (Gada), पहाड़ = 'ᱵᱩᱨᱩ' (Buru)।",
      },
      {
        id: "sat-g3-3",
        type: "context",
        prompt: "ऋतु चक्र: संथाली में 'बारिश का मौसम / वर्षा ऋतु' को क्या कहेंगे?",
        options: [
          { text: "ᱫᱟᱜ ᱫᱤᱱ (Daag din)", correct: true },
          { text: "ᱥᱤᱛᱩᱝ ᱫᱤᱱ (Situng din / गर्मी)", correct: false },
          { text: "ᱨᱟᱵᱟᱝ ᱫᱤᱱ (Rabañ din / सर्दी)", correct: false },
          { text: "ᱦᱚᱭ ᱫᱤᱱ (Hoy din / आंधी)", correct: false },
        ],
        explanation: "वर्षा ऋतु = ᱫᱟᱜ ᱫᱤᱱ (पानी के दिन), ग्रीष्म = ᱥᱤᱛᱩᱝ ᱫᱤᱱ, शीत = ᱨᱟᱵᱟᱝ ᱫᱤᱱ।",
      },
    ],
    hoc: [
      {
        id: "hoc-g3-1",
        type: "vocab",
        prompt: "हो (Ho) EVS: सखुआ के पेड़ को हो भाषा में क्या कहते हैं?",
        options: [
          { text: "सरजोम दारु (Sarjom daru)", correct: true },
          { text: "मद दारु", correct: false },
          { text: "उलि दारु (आम का पेड़)", correct: false },
          { text: "कंटार दारु (कटहल)", correct: false },
        ],
        explanation: "सखुआ (साल) को हो और मुंडारी में 'सरजोम दारु' कहते हैं।",
      },
      {
        id: "hoc-g3-2",
        type: "audio",
        prompt: "ध्वनि पहचानें: हो शब्द 'गाड़ा' का क्या अर्थ है?",
        audioWord: "गाड़ा",
        audioTranslit: "Gada",
        options: [
          { text: "नदी / जलधारा (River)", correct: true },
          { text: "सड़क (Road)", correct: false },
          { text: "कुआं (Well)", correct: false },
          { text: "तालाब (Pond)", correct: false },
        ],
        explanation: "हो भाषा में नदी को 'गाड़ा' और पहाड़ को 'बुरु' कहते हैं।",
      },
      {
        id: "hoc-g3-3",
        type: "context",
        prompt: "हो लोक-विज्ञान: सरहुल में खिलने वाले सखुआ के फूल को क्या कहते हैं?",
        options: [
          { text: "सरजोम बाः (Sarjom baa')", correct: true },
          { text: "महुआ साकम", correct: false },
          { text: "गुलाप बाः", correct: false },
          { text: "दाः साकम", correct: false },
        ],
        explanation: "फूल = बाः। सरजोम बाः = सखुआ का फूल, जो बाः परोब में पूजनीय है।",
      },
    ],
    unr: [
      {
        id: "unr-g3-1",
        type: "vocab",
        prompt: "मुंडारी EVS: सूर्य और धूप के लिए मुंडारी शब्द क्या है?",
        options: [
          { text: "सिंगी (Singi)", correct: true },
          { text: "चांदूः (Chandu' / चंद्रमा)", correct: false },
          { text: "इपिल (Ipil / तारे)", correct: false },
          { text: "रिमिल (Rimil / बादल)", correct: false },
        ],
        explanation: "मुंडारी में सूर्य = सिंगी, चंद्रमा = चांदूः, तारे = इपिल, बादल = रिमिल।",
      },
      {
        id: "unr-g3-2",
        type: "context",
        prompt: "कक्षा 3 पर्यावरण: मुंडारी में 'जंगल में बड़े पेड़ और जंगली जानवर रहते हैं' - 'जंगल' क्या है?",
        options: [
          { text: "बिर (Bir)", correct: true },
          { text: "हातु (Hatu / गांव)", correct: false },
          { text: "खेत (Khet)", correct: false },
          { text: "पिठिया (Pithiya)", correct: false },
        ],
        explanation: "मुंडारी में जंगल = 'बिर', गांव = 'हातु'।",
      },
      {
        id: "unr-g3-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: मुंडारी शब्द 'चेणें' का क्या अर्थ है?",
        audioWord: "चेणें",
        audioTranslit: "Chene",
        options: [
          { text: "पक्षी / चिड़िया (Bird)", correct: true },
          { text: "मछली (Fish)", correct: false },
          { text: "बकरी (Goat)", correct: false },
          { text: "तितली (Butterfly)", correct: false },
        ],
        explanation: "मुंडारी और संथाली में पक्षी को 'चेणें' (Chene / ᱪᱮᱬᱮ) कहते हैं।",
      },
    ],
    kru: [
      {
        id: "kru-g3-1",
        type: "vocab",
        prompt: "कुड़ुख़ EVS: पक्षी / चिड़िया को कुड़ुख़ में क्या कहते हैं?",
        options: [
          { text: "ओड़ा (Oda)", correct: true },
          { text: "मंखा (Mankha / भैंस)", correct: false },
          { text: "एड़ा (Eda / बकरी)", correct: false },
          { text: "अल्ला (Alla / कुत्ता)", correct: false },
        ],
        explanation: "कुड़ुख़ में पक्षी = ओड़ा, कुत्ता = अल्ला, बकरी = एड़ा।",
      },
      {
        id: "kru-g3-2",
        type: "context",
        prompt: "कुड़ुख़ में 'झंख' (Jhankh) का क्या अर्थ है?",
        options: [
          { text: "घना जंगल / वन (Dense Forest)", correct: true },
          { text: "बड़ी नदी", correct: false },
          { text: "कच्ची सड़क", correct: false },
          { text: "खुला मैदान", correct: false },
        ],
        explanation: "कुड़ुख़ में वन / जंगल को 'झंख' कहते हैं।",
      },
      {
        id: "kru-g3-3",
        type: "audio",
        prompt: "ध्वनि सुनें: कुड़ुख़ शब्द 'पुंप' का अर्थ पहचानें:",
        audioWord: "पुंप",
        audioTranslit: "Pump",
        options: [
          { text: "फूल / पुष्प (Flower)", correct: true },
          { text: "फल (Fruit)", correct: false },
          { text: "पत्ता (Leaf)", correct: false },
          { text: "जड़ (Root)", correct: false },
        ],
        explanation: "कुड़ुख़ में फूल को 'पुंप' (Pump) कहते हैं।",
      },
    ],
    sck: [
      {
        id: "sck-g3-1",
        type: "vocab",
        prompt: "सादरी EVS: पक्षी / चिड़िया को स्थानीय बोली में क्या कहते हैं?",
        options: [
          { text: "चरई (Charai)", correct: true },
          { text: "बेंदरा (Bandar)", correct: false },
          { text: "बाघ", correct: false },
          { text: "मछरी (Machhli)", correct: false },
        ],
        explanation: "सादरी / नागपुरी में चिड़िया को 'चरई' कहा जाता है।",
      },
      {
        id: "sck-g3-2",
        type: "context",
        prompt: "झारखंड की प्रमुख मौसमी फसल 'धान' की रोपाई किस मौसम में होती है?",
        options: [
          { text: "बरसात में (Rainy season)", correct: true },
          { text: "कड़ाके की धूप में", correct: false },
          { text: "माघ की ठंड में", correct: false },
          { text: "चैत में", correct: false },
        ],
        explanation: "धान की खेती बरसात के आगमन पर आषाढ़-सावन में की जाती है।",
      },
      {
        id: "sck-g3-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: सादरी शब्द 'बोन' का क्या अर्थ है?",
        audioWord: "बोन",
        audioTranslit: "Bon",
        options: [
          { text: "जंगल / वन (Forest)", correct: true },
          { text: "खेत (Field)", correct: false },
          { text: "बाज़ार (Market)", correct: false },
          { text: "घर (Home)", correct: false },
        ],
        explanation: "सादरी में जंगल को 'बोन' कहा जाता है।",
      },
    ],
  },
  4: {
    sat: [
      {
        id: "sat-g4-1",
        type: "vocab",
        prompt: "ग्रामीण अर्थव्यवस्था: संथाली में 'साप्ताहिक बाज़ार' को क्या कहते हैं?",
        options: [
          { text: "ᱦᱟᱴ (Haat)", correct: true },
          { text: "ᱫᱩᱠᱟᱱ (Dukan)", correct: false },
          { text: "ᱠᱷᱮᱛ (Khet)", correct: false },
          { text: "ᱚᱲᱟᱜ (Oṛag)", correct: false },
        ],
        explanation: "झारखंड के गांवों में लगने वाले साप्ताहिक बाज़ार को संथाली में 'ᱦᱟᱴ' (Haat) कहते हैं।",
      },
      {
        id: "sat-g4-2",
        type: "context",
        prompt: "कृषि विज्ञान: संथाली में 'धान' की फसल को क्या कहते हैं?",
        subPrompt: "Word: धान / Paddy",
        options: [
          { text: "ᱦᱳᱲᱳ (Hoṛo)", correct: true },
          { text: "ᱪᱟᱣᱞᱮ (Chawle / चावल)", correct: false },
          { text: "ᱫᱟᱠᱟ (Daka / भात)", correct: false },
          { text: "ᱜᱩᱦᱩᱢ (Guhum / गेहूँ)", correct: false },
        ],
        explanation: "खेत में खड़ी फसल 'धान' = ᱦᱳᱲᱳ (Hoṛo), कूटा हुआ 'चावल' = ᱪᱟᱣᱞᱮ, और पका हुआ 'भात' = ᱫᱟᱠᱟ।",
      },
      {
        id: "sat-g4-3",
        type: "audio",
        prompt: "ध्वनि सुनें और सही अर्थ चुनें (Santali agri audio):",
        audioWord: "ᱥᱤ",
        audioTranslit: "Si",
        options: [
          { text: "हल जोतना / हल चलाना (Ploughing)", correct: true },
          { text: "फसल काटना (Harvesting)", correct: false },
          { text: "बीज बोना (Sowing)", correct: false },
          { text: "पानी देना (Irrigating)", correct: false },
        ],
        explanation: "संथाली में हल जोतने को 'ᱥᱤ' (Si) कहते हैं। जैसे: ᱠᱟᱰᱟ ᱛᱮ ᱠᱷᱮᱛ ᱥᱤ (भैंसों से खेत जोतना)।",
      },
    ],
    hoc: [
      {
        id: "hoc-g4-1",
        type: "vocab",
        prompt: "हो (Ho) कृषि शब्दावली: 'धान' की फसल को क्या कहते हैं?",
        options: [
          { text: "बाबा (Baba / 𑢯𑢡𑢯𑢡)", correct: true },
          { text: "मांडी (Mandi / भात)", correct: false },
          { text: "चाउली (Chauli / चावल)", correct: false },
          { text: "गुहुम (Guhum)", correct: false },
        ],
        explanation: "हो भाषा में धान = 'बाबा' (वारंग क्षिति: 𑢯𑢡𑢯𑢡), चावल = 'चाउली', भात = 'मांडी'।",
      },
      {
        id: "hoc-g4-2",
        type: "context",
        prompt: "हाट में खरीद-बिक्री: 'सब्जी बेचना' को हो भाषा में क्या कहेंगे?",
        options: [
          { text: "आराः अकिरिंग (Ara' akiring)", correct: true },
          { text: "दाः नू", correct: false },
          { text: "होनको सेने", correct: false },
          { text: "ओवाः गीतीः", correct: false },
        ],
        explanation: "हो भाषा में साग/सब्जी = 'आराः', बेचना = 'अकिरिंग'।",
      },
      {
        id: "hoc-g4-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: हो शब्द 'हातु' का क्या अर्थ है?",
        audioWord: "हातु",
        audioTranslit: "Hatu",
        options: [
          { text: "गांव / ग्राम (Village)", correct: true },
          { text: "शहर (City)", correct: false },
          { text: "दुकान (Shop)", correct: false },
          { text: "मेला (Fair)", correct: false },
        ],
        explanation: "हो और मुंडारी में गांव को 'हातु' (Hatu) कहा जाता है।",
      },
    ],
    unr: [
      {
        id: "unr-g4-1",
        type: "vocab",
        prompt: "मुंडारी में 'धान की खेती' को क्या कहते हैं?",
        options: [
          { text: "बाबा पइटी (Baba pairi)", correct: true },
          { text: "दारु रोपे", correct: false },
          { text: "पुथी ओल", correct: false },
          { text: "दाः नू", correct: false },
        ],
        explanation: "धान = 'बाबा', काम/खेती = 'पइटी'। 'बाबा पइटी' = धान की खेती।",
      },
      {
        id: "unr-g4-2",
        type: "context",
        prompt: "मुंडारी समुदाय में 'खलिहान' जहाँ अन्न दांयते हैं, उसे क्या कहते हैं?",
        options: [
          { text: "ओखोर / खरिहान (Okhor)", correct: true },
          { text: "ओड़ाः", correct: false },
          { text: "हातु", correct: false },
          { text: "गाड़ा", correct: false },
        ],
        explanation: "खलिहान को मुंडारी में 'ओखोर' या 'कोलोम' कहते हैं।",
      },
      {
        id: "unr-g4-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: मुंडारी शब्द 'पइटी' का क्या अर्थ है?",
        audioWord: "पइटी",
        audioTranslit: "Paiti",
        options: [
          { text: "काम / श्रम / कार्य (Work/Labour)", correct: true },
          { text: "खेल (Game)", correct: false },
          { text: "नींद (Sleep)", correct: false },
          { text: "गाना (Song)", correct: false },
        ],
        explanation: "मुंडारी में काम या परिश्रम को 'पइटी' कहते हैं।",
      },
    ],
    kru: [
      {
        id: "kru-g4-1",
        type: "vocab",
        prompt: "कुड़ुख़ कृषि: 'धान' की फसल को कुड़ुख़ में क्या कहते हैं?",
        options: [
          { text: "खेस्स (Khess)", correct: true },
          { text: "तिखील (Tikhil / चावल)", correct: false },
          { text: "मंडी (Mandi / भात)", correct: false },
          { text: "अम्म (Amm / पानी)", correct: false },
        ],
        explanation: "कुड़ुख़ में धान = 'खेस्स' (Khess), चावल = 'तिखील', भात = 'मंडी'।",
      },
      {
        id: "kru-g4-2",
        type: "context",
        prompt: "कुड़ुख़ में 'हल जोतना' के लिए कौन सा शब्द आता है?",
        options: [
          { text: "उयना (Uyna)", correct: true },
          { text: "मोखना (Mokhna)", correct: false },
          { text: "ओना (Ona)", correct: false },
          { text: "टुड़ना (Tudna)", correct: false },
        ],
        explanation: "कुड़ुख़ में खेत जोतना = 'उयना'।",
      },
      {
        id: "kru-g4-3",
        type: "audio",
        prompt: "ध्वनि सुनें: कुड़ुख़ शब्द 'पेठिया' का क्या अर्थ है?",
        audioWord: "पेठिया",
        audioTranslit: "Pethiya",
        options: [
          { text: "साप्ताहिक ग्रामीण बाज़ार / हाट (Weekly Market)", correct: true },
          { text: "बड़ी नदी", correct: false },
          { text: "रेलवे स्टेशन", correct: false },
          { text: "विद्यालय", correct: false },
        ],
        explanation: "कुड़ुख़ और सादरी अंचल में साप्ताहिक हाट को 'पेठिया' भी कहते हैं।",
      },
    ],
    sck: [
      {
        id: "sck-g4-1",
        type: "vocab",
        prompt: "सादरी कृषि: धान काटने के औजार 'हँसुआ' को क्या कहते हैं?",
        options: [
          { text: "हँसुआ / कतरनी (Hansua)", correct: true },
          { text: "कुदाल (Kudal)", correct: false },
          { text: "कुल्हाड़ी (Kulhari)", correct: false },
          { text: "खुरपी (Khurpi)", correct: false },
        ],
        explanation: "धान काटने का पारंपरिक औजार 'हँसुआ' है।",
      },
      {
        id: "sck-g4-2",
        type: "context",
        prompt: "सादरी में 'हाट में बिके वाला सामान' - 'हाट' का क्या महत्व है?",
        options: [
          { text: "गांव के किसान अपनी साग-सब्जी और अनाज बेचने आते हैं", correct: true },
          { text: "वहाँ केवल गाड़ियां मिलती हैं", correct: false },
          { text: "वहाँ केवल पढ़ाई होती है", correct: false },
          { text: "वहाँ केवल खेलकूद होता है", correct: false },
        ],
        explanation: "हाट स्थानीय अर्थव्यवस्था की रीढ़ है जहाँ किसान अपनी उपज बेचते हैं।",
      },
      {
        id: "sck-g4-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: सादरी शब्द 'रोपनी' का क्या अर्थ है?",
        audioWord: "रोपनी",
        audioTranslit: "Ropni",
        options: [
          { text: "धान के पौधों को खेत में रोपना (Transplanting paddy)", correct: true },
          { text: "रोटी बनाना", correct: false },
          { text: "कपड़े धोना", correct: false },
          { text: "मछली पकड़ना", correct: false },
        ],
        explanation: "आषाढ़-सावन में धान के बिचड़ों को खेत में लगाना 'रोपनी' कहलाता है।",
      },
    ],
  },
  5: {
    sat: [
      {
        id: "sat-g5-1",
        type: "context",
        prompt: "संथाली लोक संस्कृति: वसंत ऋतु में सखुआ फूल खिलने पर कौन सा महान पर्व मनाया जाता है?",
        options: [
          { text: "ᱵᱟᱦᱟ ᱯᱚᱨᱚᱵᱽ (Baha Parab)", correct: true },
          { text: "ᱥᱚᱦᱨᱟᱭ (Sohrai / मकर-गोवर्धन)", correct: false },
          { text: "ᱠᱟᱨᱟᱢ (Karam)", correct: false },
          { text: "ᱫᱟᱥᱟᱸᱭ (Dasai)", correct: false },
        ],
        explanation: "संथाल समुदाय का वसंतोत्सव 'ᱵᱟᱦᱟ ᱯᱚᱨᱚᱵᱽ' (बाहा परब) है, जिसमें सखुआ के नए फूलों की पूजा होती है।",
      },
      {
        id: "sat-g5-2",
        type: "vocab",
        prompt: "संथाली सामाजिक व्यवस्था: पारंपरिक ग्राम प्रधान को क्या कहा जाता है?",
        options: [
          { text: "ᱢᱟᱹᱧᱡᱷᱤ ᱦᱟᱲᱟᱢ (Manjhi Hadam)", correct: true },
          { text: "ᱱᱟᱭᱠᱮ (Naike / पुजारी)", correct: false },
          { text: "ᱜᱚᱰᱮᱛ (Godet / संदेशवाहक)", correct: false },
          { text: "ᱯᱟᱨᱟᱱᱤᱠ (Paranik / उप-प्रधान)", correct: false },
        ],
        explanation: "संथाल पारंपरिक स्वशासन व्यवस्था (मांझी परगना प्रणाली) में गांव के मुखिया को 'ᱢᱟᱹᱧᱡᱷᱤ ᱦᱟᱲᱟᱢ' कहते हैं।",
      },
      {
        id: "sat-g5-3",
        type: "audio",
        prompt: "ध्वनि सुनें और पहचानें (Santali cultural term):",
        audioWord: "ᱥᱚᱦᱨᱟᱭ",
        audioTranslit: "Sohrai",
        options: [
          { text: "फसल कटाई व गोधन पर्व (Harvest & Cattle festival)", correct: true },
          { text: "होली का त्योहार", correct: false },
          { text: "रक्षाबंधन", correct: false },
          { text: "दीपावली", correct: false },
        ],
        explanation: "'ᱥᱚᱦᱨᱟᱭ' (सोहराय) झारखंड का प्रमुख प्राकृतिक पर्व है जिसमें पशुधन और प्रकृति की वंदना होती है।",
      },
    ],
    hoc: [
      {
        id: "hoc-g5-1",
        type: "context",
        prompt: "हो (Ho) समाज की पारंपरिक स्वशासन व्यवस्था को किस नाम से जाना जाता है?",
        options: [
          { text: "मुंडा-मानकी व्यवस्था (Munda-Manki System)", correct: true },
          { text: "मांझी व्यवस्था", correct: false },
          { text: "पड़हा व्यवस्था", correct: false },
          { text: "नगर परिषद", correct: false },
        ],
        explanation: "कोल्हान क्षेत्र में हो समुदाय की पारंपरिक स्वशासन व्यवस्था 'मुंडा-मानकी व्यवस्था' कहलाती है।",
      },
      {
        id: "hoc-g5-2",
        type: "vocab",
        prompt: "हो लोक दर्शन: 'प्रकृति और धरती माता' को आदरपूर्वक क्या कहते हैं?",
        options: [
          { text: "ओते दिसुम / सिंगबोंगा (Ote Disum)", correct: true },
          { text: "आलोर अड़ाः", correct: false },
          { text: "हातु डंडा", correct: false },
          { text: "मांडी बाटी", correct: false },
        ],
        explanation: "हो भाषा में 'ओते दिसुम' = धरती भूमि, और 'सिंगबोंगा' = सर्वोच्च प्राकृतिक शक्ति।",
      },
      {
        id: "hoc-g5-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: हो पर्व 'माघे परोब' का संबंध किससे है?",
        audioWord: "माघे",
        audioTranslit: "Maghe",
        options: [
          { text: "माघ माह में फसल पूर्ण होने का उल्लास पर्व (Winter harvest fest)", correct: true },
          { text: "सावन का मेला", correct: false },
          { text: "दशहरा", correct: false },
          { text: "छठ पूजा", correct: false },
        ],
        explanation: "'माघे परोब' हो समुदाय का सबसे बड़ा वार्षिक उत्सव है जो माघ महीने में मनाया जाता है।",
      },
    ],
    unr: [
      {
        id: "unr-g5-1",
        type: "context",
        prompt: "मुंडारी संस्कृति: मुंडा गांव के पारंपरिक धार्मिक प्रधान (पुजारी) को क्या कहते हैं?",
        options: [
          { text: "पाहन (Pahan)", correct: true },
          { text: "मुंडा (Munda / प्रशासनिक मुखिया)", correct: false },
          { text: "महतो (Mahto)", correct: false },
          { text: "पुजारी जी", correct: false },
        ],
        explanation: "मुंडा परंपरा में 'पाहन गांव बनाता है, मुंडा गांव चलाता है'। पाहन धार्मिक प्रमुख हैं।",
      },
      {
        id: "unr-g5-2",
        type: "vocab",
        prompt: "मुंडारी में 'सरना' (पवित्र साल कुंज) को क्या कहा जाता है?",
        options: [
          { text: "जाहेर थान / सरना स्थल (Jaher Than / Sarna)", correct: true },
          { text: "पिठिया", correct: false },
          { text: "इटुन आसरा", correct: false },
          { text: "बाजार", correct: false },
        ],
        explanation: "प्राकृतिक शक्तियों के आराधना स्थल को 'जाहेर' या 'सरना' कहा जाता है।",
      },
      {
        id: "unr-g5-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: मुंडारी शब्द 'साकम' का क्या अर्थ है?",
        audioWord: "साकम",
        audioTranslit: "Sakam",
        options: [
          { text: "पत्ता (Leaf)", correct: true },
          { text: "फूल (Flower)", correct: false },
          { text: "जड़ (Root)", correct: false },
          { text: "तितली (Butterfly)", correct: false },
        ],
        explanation: "मुंडारी और संथाली में पत्ते को 'साकम' (Sakam / ᱥᱟᱠᱟᱢ) कहते हैं।",
      },
    ],
    kru: [
      {
        id: "kru-g5-1",
        type: "context",
        prompt: "कुड़ुख़ (उरांव) पारंपरिक स्वशासन पंचायत को क्या कहा जाता है?",
        options: [
          { text: "पड़हा पंचायत (Parha Panchayat)", correct: true },
          { text: "मांझी परगना", correct: false },
          { text: "मानकी संघ", correct: false },
          { text: "नगर पालिका", correct: false },
        ],
        explanation: "उरांव समुदाय में कई गांवों को मिलाकर बनी पारंपरिक सामाजिक व्यवस्था 'पड़हा पंचायत' है।",
      },
      {
        id: "kru-g5-2",
        type: "vocab",
        prompt: "कुड़ुख़ का सबसे बड़ा वसंत पर्व 'सरहुल' को कुड़ुख़ में क्या नाम दिया गया है?",
        options: [
          { text: "खद्दी परब (Khaddi Parab)", correct: true },
          { text: "फागु परब", correct: false },
          { text: "जानी शिकार", correct: false },
          { text: "सोहराय", correct: false },
        ],
        explanation: "कुड़ुख़ भाषा में सरहुल को 'खद्दी' (Khaddi) कहा जाता है, जिसमें साल वृक्ष का पूजन होता है।",
      },
      {
        id: "kru-g5-3",
        type: "audio",
        prompt: "ध्वनि सुनें और पहचानें (Kurukh community term):",
        audioWord: "धूमकुड़िया",
        audioTranslit: "Dhumkuriya",
        options: [
          { text: "पारंपरिक युवा शिक्षण व सांस्कृतिक केंद्र (Youth Dormitory)", correct: true },
          { text: "साप्ताहिक दुकान", correct: false },
          { text: "पहाड़ की चोटी", correct: false },
          { text: "नदी का पुल", correct: false },
        ],
        explanation: "उरांव समाज में युवाओं को जीवन मूल्य और संस्कृति सिखाने वाली पारंपरिक संस्था 'धूमकुड़िया' है।",
      },
    ],
    sck: [
      {
        id: "sck-g5-1",
        type: "context",
        prompt: "नागपुरी / सादरी संस्कृति में गांव का पारंपरिक सांस्कृतिक मंच जहाँ संगीत व नृत्य होता है:",
        options: [
          { text: "अखरा (Akhra)", correct: true },
          { text: "थाना", correct: false },
          { text: "स्टेडियम", correct: false },
          { text: "दुकान", correct: false },
        ],
        explanation: "'अखरा' झारखंड के गांवों का पारंपरिक सामुदायिक और सांस्कृतिक केंद्र है।",
      },
      {
        id: "sck-g5-2",
        type: "vocab",
        prompt: "सादरी में भाद्रपद एकादशी को मनाया जाने वाला भाई-बहन और प्रकृति का पावन पर्व:",
        options: [
          { text: "करमा परब (Karam Parab)", correct: true },
          { text: "दशहरा", correct: false },
          { text: "छठ", correct: false },
          { text: "मकर संक्रांति", correct: false },
        ],
        explanation: "करमा डाली की पूजा और जावा जगाना सादरी संस्कृति का प्राण 'करमा परब' है।",
      },
      {
        id: "sck-g5-3",
        type: "audio",
        prompt: "ध्वनि पहचानें: सादरी शब्द 'मांदर' का क्या अर्थ है?",
        audioWord: "मांदर",
        audioTranslit: "Mandar",
        options: [
          { text: "झारखंड का पारंपरिक ताल वाद्य (Traditional Clay Drum)", correct: true },
          { text: "बांसुरी", correct: false },
          { text: "झांझ", correct: false },
          { text: "नगाड़ा", correct: false },
        ],
        explanation: "मांदर (Mandar) झारखंड का सबसे प्रमुख मिट्टी का बना पारंपरिक ताल वाद्य है।",
      },
    ],
  },
};

// Sample JCERT textbook chapters for 1-click test without needing manual PDF
const SAMPLE_CHAPTERS = [
  {
    id: "jcert-evs-3",
    title: "JCERT कक्षा 3: हमारी प्रकृति और नदियाँ (EVS)",
    sampleText: "झारखंड में बहुत घने जंगल और सुंदर पहाड़ हैं। जंगल में सखुआ और महुआ के बड़े पेड़ हैं। बच्चे सुबह खुशी-खुशी स्कूल जाते हैं। बरसात में कुएं और डाड़ी का पानी साफ रहता है। किसान खेत में धान की रोपाई करते हैं। शाम को चिड़िया अपने घोंसले में लौटती हैं।",
  },
  {
    id: "jcert-hindi-2",
    title: "JCERT कक्षा 2: गांव का साप्ताहिक हाट (Hindi)",
    sampleText: "हमारे गांव में हर गुरुवार को साप्ताहिक हाट लगता है। किसान खेत से ताजी सब्जियां लाते हैं। हाट में बहुत भीड़ होती है। बच्चे अपने माता-पिता के साथ खिलौने और मिठाई खरीदने जाते हैं। हाट से गांव के सभी लोगों को जरूरत का सामान मिलता है।",
  },
];

// Native Mother Tongue Spoken Instructions (NEP 2020 Transitional Bilingual Education)
const NATIVE_PROMPT_MAP = {
  audio: {
    sat: { native: "ᱥᱟᱰᱮ ᱟᱸᱡᱚᱢ ᱢᱮ ᱟᱨ ᱴᱷᱤᱠ ᱡᱤᱱᱤᱥ ᱵᱟᱪᱷᱟᱣ ᱢᱮ", translit: "Sade añjom me ar thik jinis bachhaw me" },
    hoc: { native: "साड़े आयुम मे अड़ोः सतीः जिनिस सालाय मे", translit: "Sade aayum me ado' satih jinis saalay me" },
    unr: { native: "साड़ी आयुम मे अड़ोः सही चीज सालाय मे", translit: "Sari aayum me ado' sahi cheez saalay me" },
    kru: { native: "कथ्था मेनना अरा सही चीझ बाछना", translit: "Katha menna ara sahi cheej bachna" },
    sck: { native: "आवाज़ सुनू और सही जिनिस चुनू", translit: "Aawaz sunu aur sahi jinis chunu" },
  },
  vocab: {
    sat: { native: "ᱱᱚᱣᱟ ᱠᱟᱛᱷᱟ ᱨᱮᱭᱟᱜ ᱴᱷᱤᱠ ᱢᱮᱱᱮᱛ ᱵᱟᱪᱷᱟᱣ ᱢᱮ", translit: "Nowa katha reyag thik menet bachhaw me" },
    hoc: { native: "नेयाः जुत साबात् सालाय मे", translit: "Neya' jut sabat saalay me" },
    unr: { native: "नेयाः सही शब्द सालाय मे", translit: "Neya' sahi shabd saalay me" },
    kru: { native: "इदिही सही कथ्था बाछना", translit: "Idihi sahi katha bachna" },
    sck: { native: "सही शब्द चुनू", translit: "Sahi shabd chunu" },
  },
  context: {
    sat: { native: "ᱠᱞᱟᱥ ᱨᱮ ᱪᱮᱫ ᱦᱩᱭᱩᱜ ᱠᱟᱱᱟ? ᱴᱷᱤᱠ ᱛᱮᱞᱟ ᱮᱢ ᱢᱮ", translit: "Class re ched huyug kana? Thik tela em me" },
    hoc: { native: "इटुन अड़ाः रे चिकनाः? सतीः तेला एम मे", translit: "Itun ada' re chikna'? Satih tela em me" },
    unr: { native: "इस्कुल रे चिकनाः? सही उत्तर एम मे", translit: "Iskul re chikna'? Sahi uttar em me" },
    kru: { native: "इस्कूल मन्नू सही कथ्था बाछना", translit: "Iskool mannu sahi katha bachna" },
    sck: { native: "कक्षा अभ्यास: सही जवाब चुनू", translit: "Kaksha abhyas: sahi jawab chunu" },
  },
};

function getPromptForQuestion(q, lang) {
  const typePrompts = NATIVE_PROMPT_MAP[q?.type] || NATIVE_PROMPT_MAP.context;
  return typePrompts[lang] || typePrompts.sat;
}

export default function QuizLab({ lessonText, currentGrade = 2 }) {
  // Main states
  const [selectedGrade, setSelectedGrade] = useState(currentGrade || 2);
  const [selectedLang, setSelectedLang] = useState("sat");
  const [quizMode, setQuizMode] = useState("curated"); // 'curated' | 'chapter_pdf'
  
  // Chapter PDF upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [chapterFile, setChapterFile] = useState(null);
  const [extractedSentences, setExtractedSentences] = useState([]);
  const [chapterQuizQuestions, setChapterQuizQuestions] = useState([]);
  const [uploadError, setUploadError] = useState(null);

  // Active quiz traversal states
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isPlayingInstruction, setIsPlayingInstruction] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [quizSeed, setQuizSeed] = useState(1);

  const fileInputRef = useRef(null);

  // Helper to pseudo-randomly shuffle options so the correct answer is not always Option A
  function shuffleOptions(options, seedStr = "") {
    if (!options || options.length <= 1) return options;
    const arr = options.map((opt) => ({ ...opt }));
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed * 31 + seedStr.charCodeAt(i)) & 0xffffffff;
    }
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(seed) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Active questions determined by mode with shuffled options
  const questions = useMemo(() => {
    let raw = [];
    if (quizMode === "chapter_pdf" && chapterQuizQuestions.length > 0) {
      raw = chapterQuizQuestions;
    } else {
      const gradeBank = GRADE_WISE_QUESTION_BANK[selectedGrade] || GRADE_WISE_QUESTION_BANK[2];
      raw = gradeBank[selectedLang] || gradeBank.sat;
    }

    return raw.map((q, idx) => ({
      ...q,
      options: shuffleOptions(
        q.options,
        `${q.id || idx}-${selectedGrade}-${selectedLang}-${quizSeed}`
      ),
    }));
  }, [quizMode, chapterQuizQuestions, selectedGrade, selectedLang, quizSeed]);

  const currentQ = questions[currentIndex] || questions[0];

  function resetQuiz(grade = selectedGrade, lang = selectedLang) {
    setSelectedGrade(grade);
    setSelectedLang(lang);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsFinished(false);
    setAudioError(null);
    setQuizSeed((s) => s + 1);
  }

  function handleSelectOption(optionIndex) {
    if (isAnswered) return;
    setSelectedOption(optionIndex);
    setIsAnswered(true);

    const isCorrect = currentQ.options[optionIndex]?.correct;
    if (isCorrect) {
      setScore((s) => s + 1);
      playQuizChime(true);
    } else {
      playQuizChime(false);
    }
  }

  function handleNext() {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setAudioError(null);
    } else {
      setIsFinished(true);
    }
  }

  async function playAudioWord(word) {
    if (!word) return;
    setIsPlayingAudio(true);
    setAudioError(null);
    try {
      const res = await speak(word, selectedLang);
      if (res.kind === "audio" && res.blob) {
        const audioUrl = URL.createObjectURL(res.blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => {
          setIsPlayingAudio(false);
          setAudioError("Audio playback error");
        };
        await audio.play();
      } else {
        // Fallback speech using browser synthesis
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = "hi-IN";
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      setIsPlayingAudio(false);
      setAudioError(e.message || "TTS error");
    }
  }

  async function playInstructionAudio(instructionText) {
    if (!instructionText) return;
    setIsPlayingInstruction(true);
    try {
      const res = await speak(instructionText, selectedLang);
      if (res.kind === "audio" && res.blob) {
        const audioUrl = URL.createObjectURL(res.blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => setIsPlayingInstruction(false);
        audio.onerror = () => setIsPlayingInstruction(false);
        await audio.play();
      } else {
        const utterance = new SpeechSynthesisUtterance(instructionText);
        utterance.lang = "hi-IN";
        utterance.onend = () => setIsPlayingInstruction(false);
        utterance.onerror = () => setIsPlayingInstruction(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      setIsPlayingInstruction(false);
    }
  }


  // Dynamically generate a chapter quiz from extracted sentences
  function generateQuizFromSentences(sentences, filename = "Uploaded Chapter") {
    if (!sentences || sentences.length === 0) return [];

    const fullText = sentences.join(" ");
    const generated = [];

    // 1. Keyword extraction & dialect translation question
    const keyCandidates = [
      { hi: "पानी", sat: "ᱫᱟᱜ", hoc: "दाः", unr: "दाः", kru: "अम्म", sck: "पानी", hint: "Water" },
      { hi: "पेड़", sat: "ᱫᱟᱨᱮ", hoc: "दारु", unr: "दारु", kru: "मन", sck: "गाछ", hint: "Tree" },
      { hi: "स्कूल", sat: "ᱤᱛᱩᱱ ᱟᱥᱲᱟ", hoc: "इटुन आसरा", unr: "इस्कुल", kru: "इस्कूल", sck: "इस्कूल", hint: "School" },
      { hi: "जंगल", sat: "ᱵᱤᱨ", hoc: "बिर", unr: "बिर", kru: "झंख", sck: "बोन", hint: "Forest" },
      { hi: "किसान", sat: "ᱠᱤᱥᱟᱹᱬ", hoc: "होड़ा", unr: "किसान", kru: "किसान", sck: "किसान", hint: "Farmer" },
      { hi: "धान", sat: "ᱦᱳᱲᱳ", hoc: "बाबा", unr: "बाबा", kru: "खेस्स", sck: "धान", hint: "Paddy" },
      { hi: "बच्चे", sat: "ᱜᱤᱫᱽᱨᱟᱹ", hoc: "होनको", unr: "हुनको", kru: "खद्दर", sck: "छौवा मन", hint: "Children" },
      { hi: "हाट", sat: "ᱦᱟᱴ", hoc: "हाट", unr: "हाट", kru: "पेठिया", sck: "हाट", hint: "Market" },
    ];

    // Find words that appear in the chapter text
    const matched = keyCandidates.filter((k) => fullText.includes(k.hi));
    const activeTokens = matched.length >= 2 ? matched : keyCandidates.slice(0, 3);

    // Question 1: Chapter audio listening challenge
    const token1 = activeTokens[0];
    const targetScript1 = token1[selectedLang] || token1.sat;
    generated.push({
      id: "ch-audio-1",
      type: "audio",
      prompt: `अध्याय श्रवण परख: पाठ्यपुस्तक का यह मुख्य शब्द सुनें और सही अर्थ चुनें:`,
      audioWord: targetScript1,
      audioTranslit: token1.hint,
      langName: LANGUAGE_LABELS[selectedLang],
      options: [
        { text: `${token1.hi} (${token1.hint})`, correct: true },
        { text: "किताब / पोथी (Book)", correct: false },
        { text: "सड़क / रास्ता (Road)", correct: false },
        { text: "सूरज / धूप (Sun)", correct: false },
      ],
      explanation: `अध्याय में आए शब्द '${token1.hi}' का ${LANGUAGE_LABELS[selectedLang]} में उच्चारण '${targetScript1}' है।`,
    });

    // Question 2: Cloze sentence from the extracted chapter
    const s1 = sentences[0] || "बच्चे खुशी-खुशी स्कूल जाते हैं।";
    // Mask a word
    const wordsInS1 = s1.split(/\s+/).filter((w) => w.length > 2);
    const maskedWord = wordsInS1[wordsInS1.length > 2 ? 1 : 0] || "स्कूल";
    const blankSentence = s1.replace(maskedWord, "______");

    generated.push({
      id: "ch-cloze-2",
      type: "context",
      prompt: `अध्याय समझ: रिक्त स्थान भरें (Fill in the blank):`,
      subPrompt: `"${blankSentence}"`,
      options: [
        { text: maskedWord, correct: true },
        { text: "पानी", correct: false },
        { text: "रात", correct: false },
        { text: "पेड़", correct: false },
      ],
      explanation: `अध्याय का मूल वाक्य है: "${s1}"`,
    });

    // Question 3: Chapter Vocabulary Bridge
    const token2 = activeTokens[1] || keyCandidates[1];
    const targetScript2 = token2[selectedLang] || token2.sat;
    generated.push({
      id: "ch-vocab-3",
      type: "vocab",
      prompt: `अध्याय शब्दावली सेतु: पाठ में आए शब्द '${token2.hi}' का ${LANGUAGE_LABELS[selectedLang]} रूप क्या है?`,
      subPrompt: `Chapter Word: ${token2.hi} (${token2.hint})`,
      options: [
        { text: targetScript2, correct: true },
        { text: "अलोम", correct: false },
        { text: "सेने", correct: false },
        { text: "जोम", correct: false },
      ],
      explanation: `पाठ्यपुस्तक के शब्द '${token2.hi}' का ${LANGUAGE_LABELS[selectedLang]} में सही रूप '${targetScript2}' है।`,
    });

    // Question 4: Chapter comprehension sentence question
    if (sentences.length > 1) {
      const s2 = sentences[1];
      generated.push({
        id: "ch-comp-4",
        type: "context",
        prompt: `पाठ बोध: अध्याय के अनुसार कौन सा कथन सत्य है?`,
        options: [
          { text: s2, correct: true },
          { text: "झारखंड में केवल रेतीले रेगिस्तान हैं।", correct: false },
          { text: "बच्चे कभी विद्यालय नहीं जाते हैं।", correct: false },
          { text: "पेड़-पौधे केवल रात में पानी पीते हैं।", correct: false },
        ],
        explanation: `अध्याय में स्पष्ट रूप से वर्णित है: "${s2}"`,
      });
    }

    return generated;
  }

  // Handle PDF or TXT chapter file upload
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress("Reading chapter PDF & running OCR extraction…");

    try {
      const res = await extractChapter(file);
      setChapterFile(file.name);
      setExtractedSentences(res.sentences || []);

      setUploadProgress("Analyzing chapter sentences & generating bilingual questions…");
      const generated = generateQuizFromSentences(res.sentences || [], file.name);
      setChapterQuizQuestions(generated);

      setQuizMode("chapter_pdf");
      setCurrentIndex(0);
      setSelectedOption(null);
      setIsAnswered(false);
      setScore(0);
      setIsFinished(false);
      setIsUploading(false);
      setUploadProgress("");
    } catch (err) {
      setIsUploading(false);
      setUploadProgress("");
      setUploadError(err.message || "Could not parse chapter file. Please try a valid PDF or TXT.");
    }
  }

  // 1-Click test with sample JCERT chapter
  function loadSampleChapter(sample) {
    setChapterFile(sample.title);
    const sentences = sample.sampleText.split(/(?<=[।?!])\s+/).filter(Boolean);
    setExtractedSentences(sentences);
    const generated = generateQuizFromSentences(sentences, sample.title);
    setChapterQuizQuestions(generated);
    setQuizMode("chapter_pdf");
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsFinished(false);
    setUploadError(null);
  }

  const percentage = Math.round((score / questions.length) * 100);
  const activeGradeMeta = GRADE_METADATA[selectedGrade] || GRADE_METADATA[2];

  return (
    <section className="quiz-lab-container panel sun-card-shadow" aria-labelledby="quiz-lab-heading">
      {/* Top Header & Context Bar */}
      <div className="quiz-header-bar">
        <div className="quiz-header-titles">
          <div className="section-eyebrow">
            <span className="eyebrow-tag">FLN ASSESSMENT LAB · CLASS 1–5 SPECTRUM</span>
            <span>निपुण भारत अभ्यास एवं बहुभाषी परख</span>
          </div>
          <h1 id="quiz-lab-heading" className="screen-title">
            Classroom Practice & Chapter Quiz Lab
          </h1>
          <p className="screen-subtitle">
            Foundational literacy assessment with spoken audio synthesis, multi-grade progression (Class 1–5), and 1-click textbook PDF quiz extraction.
          </p>
        </div>

        {/* Dialect Selector Tabs */}
        <div className="quiz-dialect-selector" role="tablist" aria-label="Select Mother Tongue">
          {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={selectedLang === code}
              className={`quiz-dialect-chip ${selectedLang === code ? "is-active" : ""}`}
              onClick={() => {
                resetQuiz(selectedGrade, code);
                if (quizMode === "chapter_pdf" && extractedSentences.length > 0) {
                  setChapterQuizQuestions(generateQuizFromSentences(extractedSentences, chapterFile));
                }
              }}
            >
              <span className="material-symbols-outlined text-xs">
                {selectedLang === code ? "check_circle" : "radio_button_unchecked"}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mode Switcher: Curated Grade 1-5 vs Uploaded Chapter PDF */}
      <div className="quiz-mode-switch-row">
        <div className="quiz-mode-pills">
          <button
            type="button"
            className={`mode-pill ${quizMode === "curated" ? "is-active" : ""}`}
            onClick={() => {
              setQuizMode("curated");
              resetQuiz(selectedGrade, selectedLang);
            }}
          >
            <span className="material-symbols-outlined text-sm">school</span>
            <span>कक्षा 1–5 FLN पाठ्यक्रम (Curated Standard)</span>
          </button>
          <button
            type="button"
            className={`mode-pill ${quizMode === "chapter_pdf" ? "is-active" : ""}`}
            onClick={() => {
              setQuizMode("chapter_pdf");
              if (chapterQuizQuestions.length === 0) {
                loadSampleChapter(SAMPLE_CHAPTERS[0]);
              }
            }}
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            <span>पाठ्यपुस्तक PDF प्रश्नोत्तरी (Uploaded Chapter Mode)</span>
          </button>
        </div>

        {/* Upload Trigger Button */}
        <div className="quiz-upload-actions">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".pdf,.txt"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            className="button button--secondary tactile-btn-secondary quiz-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <span className="material-symbols-outlined text-sm">upload_file</span>
            <span>{isUploading ? "Extracting..." : "Upload Chapter PDF"}</span>
          </button>
        </div>
      </div>

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="quiz-upload-loading-banner">
          <span className="material-symbols-outlined text-base spin-animate">sync</span>
          <span>{uploadProgress}</span>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="quiz-upload-error-banner">
          <span className="material-symbols-outlined text-base">warning</span>
          <span>{uploadError}</span>
        </div>
      )}

      {/* Grade Selector (Shown when in Curated Mode) */}
      {quizMode === "curated" ? (
        <div className="quiz-grade-spectrum-box">
          <div className="grade-spectrum-header">
            <span className="spectrum-label">Select Primary Grade Level:</span>
            <span className="spectrum-cur-focus" style={{ color: activeGradeMeta.color }}>
              <strong>{activeGradeMeta.title}</strong> — {activeGradeMeta.label}
            </span>
          </div>

          <div className="quiz-grade-tabs">
            {[1, 2, 3, 4, 5].map((g) => {
              const meta = GRADE_METADATA[g];
              const isSelected = selectedGrade === g;
              return (
                <button
                  key={g}
                  type="button"
                  className={`grade-tab-btn ${isSelected ? "is-active" : ""}`}
                  style={isSelected ? { borderColor: meta.color, background: `${meta.color}14` } : {}}
                  onClick={() => resetQuiz(g, selectedLang)}
                >
                  <span className="grade-tab-num" style={isSelected ? { background: meta.color } : {}}>
                    कक्षा {g}
                  </span>
                  <span className="grade-tab-title">{meta.label}</span>
                </button>
              );
            })}
          </div>

          <p className="grade-pedagogy-hint">
            <strong>FLN Target:</strong> {activeGradeMeta.focus}
          </p>
        </div>
      ) : (
        /* Chapter PDF Mode Controls & Sample Presets */
        <div className="quiz-chapter-active-banner">
          <div className="chapter-meta-line">
            <span className="material-symbols-outlined text-lg" style={{ color: "#E65100" }}>
              auto_stories
            </span>
            <div className="chapter-meta-info">
              <strong>Active Chapter: {chapterFile || "JCERT Primary Reader"}</strong>
              <span>
                {extractedSentences.length > 0
                  ? `Extracted ${extractedSentences.length} sentences. Generated 4 bilingual questions.`
                  : "No PDF uploaded yet. Click Upload Chapter PDF or select a sample preset below:"}
              </span>
            </div>
          </div>

          {/* Quick Presets for Demo */}
          <div className="chapter-presets-row">
            <span className="presets-label">Quick JCERT Presets:</span>
            {SAMPLE_CHAPTERS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className="chapter-preset-chip"
                onClick={() => loadSampleChapter(ch)}
              >
                <span className="material-symbols-outlined text-xs">book</span>
                <span>{ch.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Quiz Body */}
      {!isFinished ? (
        <div className="quiz-card-wrapper">
          {/* Progress & Score Bar */}
          <div className="quiz-progress-row">
            <div className="quiz-step-indicator">
              Question <strong>{currentIndex + 1}</strong> of <strong>{questions.length}</strong>
            </div>
            <div className="quiz-progress-track" aria-hidden="true">
              <div
                className="quiz-progress-fill"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
            <div className="quiz-score-pill">
              <span className="material-symbols-outlined text-sm">stars</span>
              <span>Score: {score}</span>
            </div>
          </div>

          {/* Question Card */}
          <div className="quiz-question-card panel">
            <div className="question-type-badge">
              <span className="material-symbols-outlined text-sm">
                {currentQ.type === "audio" ? "volume_up" : currentQ.type === "vocab" ? "translate" : "psychology"}
              </span>
              <span>
                {currentQ.type === "audio"
                  ? "श्रवण कौशल (Listening Comprehension)"
                  : currentQ.type === "vocab"
                  ? "शब्दावली सेतु (Vocabulary Match)"
                  : "कक्षा स्थिति व पाठ बोध (Contextual Comprehension)"}
              </span>
            </div>

            {/* Bilingual Prompt Card with Native Speech Button */}
            {(() => {
              const nativeData = getPromptForQuestion(currentQ, selectedLang);
              return (
                <div className="quiz-bilingual-prompt-wrap">
                  <div className="prompt-top-row">
                    <span className="prompt-lang-indicator">
                      <span className="material-symbols-outlined text-sm">record_voice_over</span>
                      <span>मातृभाषा निर्देश ({LANGUAGE_LABELS[selectedLang]})</span>
                    </span>
                    <button
                      type="button"
                      className={`prompt-speech-btn ${isPlayingInstruction ? "is-speaking" : ""}`}
                      onClick={() => playInstructionAudio(nativeData.native)}
                      title="मातृभाषा में निर्देश सुनें (Listen to Instructions in Mother Tongue)"
                    >
                      <span className="material-symbols-outlined text-base">
                        {isPlayingInstruction ? "graphic_eq" : "volume_up"}
                      </span>
                      <span>{isPlayingInstruction ? "निर्देश बोल रहे हैं…" : "निर्देश सुनें (Listen)"}</span>
                    </button>
                  </div>

                  {/* Native Mother Tongue Prompt (Prominent for Child) */}
                  <h2 className="quiz-native-prompt-text in-script" lang={selectedLang}>
                    {nativeData.native}
                  </h2>

                  {/* Teacher Guide Hindi Translation */}
                  <div className="quiz-teacher-guide-line">
                    <span className="teacher-guide-badge">शिक्षक संदर्भ (Teacher Guide):</span>
                    <span className="teacher-guide-text">{currentQ.prompt}</span>
                  </div>
                </div>
              );
            })()}

            {/* Audio Listening Box */}
            {currentQ.type === "audio" && (
              <div className="quiz-audio-box">
                <button
                  type="button"
                  className={`quiz-listen-btn ${isPlayingAudio ? "is-playing" : ""}`}
                  onClick={() => playAudioWord(currentQ.audioWord)}
                  disabled={isPlayingAudio}
                >
                  <span className="material-symbols-outlined text-2xl">
                    {isPlayingAudio ? "graphic_eq" : "volume_up"}
                  </span>
                  <span>{isPlayingAudio ? "Playing Voice…" : "Play Voice (आवाज़ सुनें)"}</span>
                </button>
                <div className="audio-word-display">
                  <span className="audio-word-native">{currentQ.audioWord}</span>
                  {currentQ.audioTranslit && (
                    <span className="audio-word-sub">({currentQ.audioTranslit})</span>
                  )}
                </div>
                {audioError && <span className="audio-hint-err">{audioError}</span>}
              </div>
            )}

            {/* Sub-prompt if available */}
            {currentQ.subPrompt && (
              <div className="quiz-subprompt-box">
                <strong>{currentQ.subPrompt}</strong>
              </div>
            )}

            {/* Options Grid */}
            <div className="quiz-options-grid" role="radiogroup">
              {currentQ.options.map((option, idx) => {
                let statusClass = "";
                if (isAnswered) {
                  if (option.correct) statusClass = "is-correct";
                  else if (selectedOption === idx) statusClass = "is-wrong";
                  else statusClass = "is-dimmed";
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    role="radio"
                    aria-checked={selectedOption === idx}
                    className={`quiz-option-btn ${selectedOption === idx ? "is-selected" : ""} ${statusClass}`}
                    onClick={() => handleSelectOption(idx)}
                    disabled={isAnswered}
                  >
                    <div className="option-marker">
                      {isAnswered && option.correct ? (
                        <span className="material-symbols-outlined text-base">check</span>
                      ) : isAnswered && selectedOption === idx && !option.correct ? (
                        <span className="material-symbols-outlined text-base">close</span>
                      ) : (
                        <span>{String.fromCharCode(65 + idx)}</span>
                      )}
                    </div>
                    <span className="option-text">{option.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation & Next Banner */}
            {isAnswered && (
              <div className={`quiz-feedback-banner ${currentQ.options[selectedOption]?.correct ? "feedback-success" : "feedback-retry"}`}>
                <div className="feedback-content">
                  <div className="feedback-header">
                    <span className="material-symbols-outlined text-lg">
                      {currentQ.options[selectedOption]?.correct ? "sentiment_very_satisfied" : "lightbulb"}
                    </span>
                    <strong>
                      {currentQ.options[selectedOption]?.correct ? "शानदार! बिल्कुल सही उत्तर।" : "सीखने का अवसर (Explanation):"}
                    </strong>
                  </div>
                  <p className="feedback-explanation">{currentQ.explanation}</p>
                </div>
                <button
                  type="button"
                  className="button button--primary tactile-btn-primary quiz-next-btn"
                  onClick={handleNext}
                >
                  <span>{currentIndex + 1 < questions.length ? "अगला प्रश्न (Next)" : "परिणाम देखें (View Score)"}</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Result & Practice Achievement Card */
        <div className="quiz-result-card panel sun-card-shadow">
          <div className="result-badge-icon">
            <span className="material-symbols-outlined text-5xl" style={{ color: "#E65100" }}>
              workspace_premium
            </span>
          </div>

          <div className="section-eyebrow">
            <span className="eyebrow-tag">Practice Achievement Card</span>
            <span>
              {quizMode === "chapter_pdf"
                ? `पाठ्यपुस्तक परख: ${chapterFile}`
                : `कक्षा ${selectedGrade} अधिगम अभ्यास प्रगति पत्र`}
            </span>
          </div>

          <h2 className="result-score-title">
            अभ्यास पूर्ण! (Assessment Complete)
          </h2>

          <div className="result-stats-row">
            <div className="result-stat-box">
              <span className="stat-value">{score} / {questions.length}</span>
              <span className="stat-label">सही उत्तर (Correct)</span>
            </div>
            <div className="result-stat-box">
              <span className="stat-value">{percentage}%</span>
              <span className="stat-label">सटीकता (Accuracy)</span>
            </div>
            <div className="result-stat-box">
              <span className="stat-value">
                {percentage >= 80 ? "उत्कृष्ट (Grade A)" : percentage >= 50 ? "संतोषजनक (Grade B)" : "पुनराभ्यास (Review Needed)"}
              </span>
              <span className="stat-label">अभ्यास स्तर (Practice Milestone)</span>
            </div>
          </div>

          <p className="result-summary-text">
            {percentage >= 75
              ? `विद्यार्थी ने ${LANGUAGE_LABELS[selectedLang]} के माध्यम से कक्षा स्तर की शब्दावली और पाठ्य सामग्री को भली-भाँति आत्मसात कर लिया है।`
              : `मातृभाषा और मानक पाठ्यपुस्तक के बीच और अभ्यास की आवश्यकता है। फ्लैशकार्ड और कक्षा संवाद का पुनः अभ्यास करें।`}
          </p>

          <div className="result-actions-row">
            <button
              type="button"
              className="button button--primary tactile-btn-primary"
              onClick={() => resetQuiz(selectedGrade, selectedLang)}
            >
              <span className="material-symbols-outlined text-base">restart_alt</span>
              <span>पुनः अभ्यास करें (Retake Quiz)</span>
            </button>
            <button
              type="button"
              className="button button--secondary tactile-btn-secondary"
              onClick={() => window.print()}
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>रिपोर्ट कार्ड प्रिंट करें (Print Report)</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
