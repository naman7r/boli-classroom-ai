import { useState, useMemo } from "react";
import { speak } from "../../api";
import AudioPlayer from "../AudioPlayer";

// Primary FLN (Foundational Literacy & Numeracy) Bilingual Flashcards
// Curated for Jharkhand primary classrooms (Classes 1–3)
// Supported in: Santali (Ol Chiki), Ho (Devanagari/Warang Chiti), Mundari, Kurukh, Sadri
const FOUNDATION_CARDS = [
  {
    id: "water",
    category: "प्रकृति (Nature)",
    icon: "water_drop",
    color: "#0288D1",
    hindi: "जल / पानी",
    meaning: "Water — जीवन का आधार",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱫᱟᱜ",
        translit: "Daag",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱫᱟᱜ",
        sentence: "कुएं का पानी साफ है। (ᱫᱟᱜ ᱥᱟᱯᱷᱟ ᱜᱮᱭᱟ)",
      },
      hoc: {
        script: "दाः (𑢵𑢫)",
        translit: "Daa",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "दाः",
        sentence: "कुएं का पानी साफ है। (कुंई रेयाः दाः सफा मेनाः)",
      },
      unr: {
        script: "दाः",
        translit: "Da:",
        langName: "Mundari (मुंडारी)",
        ttsText: "दाः",
        sentence: "कुएं का पानी साफ है। (कुंआ रेयाः दाः सफा मेनाः)",
      },
      kru: {
        script: "अम्म",
        translit: "Amm",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "अम्म",
        sentence: "कुएं का पानी साफ है। (कुंआ ही अम्म साफ रई)",
      },
      sck: {
        script: "पानी",
        translit: "Paani",
        langName: "Sadri (नागपुरी)",
        ttsText: "पानी",
        sentence: "कुएं का पानी साफ है। (कुँवा कर पानी साफ हे)",
      },
    },
  },
  {
    id: "tree",
    category: "प्रकृति (Nature)",
    icon: "park",
    color: "#2E7D32",
    hindi: "पेड़ / वृक्ष",
    meaning: "Tree — सखुआ और महुआ के पेड़",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱫᱟᱨᱮ",
        translit: "Dare",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱫᱟᱨᱮ",
        sentence: "जंगल में बड़े पेड़ हैं। (ᱵᱤᱨ ᱨᱮ ᱢᱟᱨᱟᱝ ᱫᱟᱨᱮ ᱢᱮᱱᱟᱜᱼᱟ)",
      },
      hoc: {
        script: "दारु (𑢵𑢡𑢣)",
        translit: "Daru",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "दारु",
        sentence: "जंगल में बड़े पेड़ हैं। (बिर रे मारंग दारु मेनाः)",
      },
      unr: {
        script: "दारु",
        translit: "Daaru",
        langName: "Mundari (मुंडारी)",
        ttsText: "दारु",
        sentence: "जंगल में बड़े पेड़ हैं। (बिर रे मारंग दारु मेनाः)",
      },
      kru: {
        script: "मन्न",
        translit: "Mann",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "मन्न",
        sentence: "जंगल में बड़े पेड़ हैं। (टोड़ंग नू कोहा मन्न रई)",
      },
      sck: {
        script: "गाछ / रूख",
        translit: "Gaachh",
        langName: "Sadri (नागपुरी)",
        ttsText: "गाछ",
        sentence: "जंगल में बड़े पेड़ हैं। (बोन में बड़ गाछ मन आंय)",
      },
    },
  },
  {
    id: "sun",
    category: "प्रकृति (Nature)",
    icon: "wb_sunny",
    color: "#F57C00",
    hindi: "सूरज / सूर्य",
    meaning: "Sun — सुबह की धूप",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱥᱤᱧ / ᱵᱮᱲᱟ",
        translit: "Sin / Beda",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱥᱤᱧ ᱵᱮᱲᱟ",
        sentence: "पूरब से सूरज निकला। (ᱥᱤᱧ ᱪᱟᱸᱫᱚ ᱨᱟᱠᱟᱵ ᱮᱱᱟ)",
      },
      hoc: {
        script: "सिंगी (𑢷𑢳𑢢𑢱)",
        translit: "Singi",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "सिंगी",
        sentence: "पूरब से सूरज निकला। (सिंगी पूरब रे ओलोःयेना)",
      },
      unr: {
        script: "सिंगी",
        translit: "Singi",
        langName: "Mundari (मुंडारी)",
        ttsText: "सिंगी",
        sentence: "पूरब से सूरज निकला। (सिंगी पूरब ते ओड़ोःयेना)",
      },
      kru: {
        script: "बीड़ी",
        translit: "Bidi",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "बीड़ी",
        sentence: "पूरब से सूरज निकला। (बीड़ी पूरब तरा उरगिया)",
      },
      sck: {
        script: "सुरुज",
        translit: "Suruj",
        langName: "Sadri (नागपुरी)",
        ttsText: "सुरुज",
        sentence: "पूरब से सूरज निकला। (पूरब से सुरुज निकललक)",
      },
    },
  },
  {
    id: "mother",
    category: "परिवार (Family)",
    icon: "face_3",
    color: "#D81B60",
    hindi: "माँ / माता",
    meaning: "Mother — परिवार की धुरी",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱟᱭᱳ / ᱮᱸᱜᱟᱛ",
        translit: "Ayo / Engat",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱟᱭᱳ",
        sentence: "माँ मुझे खाना खिलाती है। (ᱟᱭᱳ ᱤᱧ ᱫᱟᱠᱟᱭ ᱮᱢᱟᱹᱧ ᱠᱟᱱᱟ)",
      },
      hoc: {
        script: "एंगा (𑢮𑢢𑢤)",
        translit: "Enga",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "एंगा",
        sentence: "माँ मुझे खाना खिलाती है। (एंगा अञ मांडी एमइञ तना)",
      },
      unr: {
        script: "एंगा / आयो",
        translit: "Enga / Ayo",
        langName: "Mundari (मुंडारी)",
        ttsText: "एंगा",
        sentence: "माँ मुझे खाना खिलाती है। (एंगा अइञ मंडी ओमोइञ तना)",
      },
      kru: {
        script: "अयो",
        translit: "Ayo",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "अयो",
        sentence: "माँ मुझे खाना खिलाती है। (अयो एंग मंडी चीई)",
      },
      sck: {
        script: "माय",
        translit: "Maay",
        langName: "Sadri (नागपुरी)",
        ttsText: "माय",
        sentence: "माँ मुझे खाना खिलाती है। (माय मोहिं भात खियावेला)",
      },
    },
  },
  {
    id: "friend",
    category: "मित्रता (Friendship)",
    icon: "diversity_1",
    color: "#8E24AA",
    hindi: "दोस्त / सखा",
    meaning: "Friend — खेल का साथी",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱜᱟᱛᱮ",
        translit: "Gate",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱜᱟᱛᱮ",
        sentence: "हम सब अच्छे दोस्त हैं। (ᱟᱞᱮ ᱵᱮᱥ ᱜᱟᱛᱮ ᱠᱟᱱᱟᱞᱮ)",
      },
      hoc: {
        script: "गाते (𑢤𑢡𑢦𑢮)",
        translit: "Gate",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "गाते",
        sentence: "हम सब अच्छे दोस्त हैं। (अले बुरु गाते तनाको)",
      },
      unr: {
        script: "गाते",
        translit: "Gate",
        langName: "Mundari (मुंडारी)",
        ttsText: "गाते",
        sentence: "हम सब अच्छे दोस्त हैं। (आले बुगी गाते तनाको)",
      },
      kru: {
        script: "संगी",
        translit: "Sangi",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "संगी",
        sentence: "हम सब अच्छे दोस्त हैं। (नाम दऊ संगी हिकत)",
      },
      sck: {
        script: "संगी / जोहारिया",
        translit: "Sangi",
        langName: "Sadri (नागपुरी)",
        ttsText: "संगी",
        sentence: "हम सब अच्छे दोस्त हैं। (हमन बेस संगी हकी)",
      },
    },
  },
  {
    id: "school",
    category: "विद्यालय (School)",
    icon: "school",
    color: "#3949AB",
    hindi: "विद्यालय / स्कूल",
    meaning: "School — ज्ञान और खेल का केंद्र",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱵᱤᱨᱫᱟᱹᱜᱟᱲ",
        translit: "Birdagarh",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱵᱤᱨᱫᱟᱹᱜᱟᱲ",
        sentence: "बच्चे स्कूल जा रहे हैं। (ᱜᱤᱫᱽᱨᱟᱹ ᱠᱚ ᱵᱤᱨᱫᱟᱹᱜᱟᱲ ᱛᱮᱠᱚ ᱥᱮᱱᱚᱜ ᱠᱟᱱᱟ)",
      },
      hoc: {
        script: "इटुन आसरा (𑢳𑢦𑢯𑢮 𑢡𑢷𑢡)",
        translit: "Itun Aasra",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "इटुन आसरा",
        sentence: "बच्चे स्कूल जा रहे हैं। (होनको इटुन आसरा सेने तनको)",
      },
      unr: {
        script: "इस्कुल / इटुन ओड़ाः",
        translit: "Iskul",
        langName: "Mundari (मुंडारी)",
        ttsText: "इस्कुल",
        sentence: "बच्चे स्कूल जा रहे हैं। (हुनको इस्कुल सेनोः तनाको)",
      },
      kru: {
        script: "स्कूल / पड़हा अड्डा",
        translit: "School",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "स्कूल",
        sentence: "बच्चे स्कूल जा रहे हैं। (खद्दार स्कूल कालर)",
      },
      sck: {
        script: "इस्कूल / पाठशाला",
        translit: "Iskool",
        langName: "Sadri (नागपुरी)",
        ttsText: "इस्कूल",
        sentence: "बच्चे स्कूल जा रहे हैं। (छौआ मन इस्कूल जात हैं)",
      },
    },
  },
  {
    id: "book",
    category: "विद्यालय (School)",
    icon: "menu_book",
    color: "#00897B",
    hindi: "किताब / पुस्तक",
    meaning: "Book — कहानियों और पाठ का खजाना",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱯᱚᱛᱚᱵ",
        translit: "Potob",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱯᱚᱛᱚᱵ",
        sentence: "यह मेरी हिंदी की किताब है। (ᱱᱚᱣᱟ ᱫᱚ ᱤᱧᱟᱜ ᱦᱤᱱᱫᱤ ᱯᱚᱛᱚᱵ ᱠᱟᱱᱟ)",
      },
      hoc: {
        script: "पुथी (𑢪𑢯𑢦𑢳)",
        translit: "Puthi",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "पुथी",
        sentence: "यह मेरी किताब है। (नेयाः अञाः पुथी तना)",
      },
      unr: {
        script: "पुथी",
        translit: "Puthi",
        langName: "Mundari (मुंडारी)",
        ttsText: "पुथी",
        sentence: "यह मेरी किताब है। (नेयाः अइञाः पुथी तना)",
      },
      kru: {
        script: "किताब / पुथी",
        translit: "Kitab",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "किताब",
        sentence: "यह मेरी किताब है। (ईदन एंग्है किताब हिकै)",
      },
      sck: {
        script: "किताब / पोथी",
        translit: "Kitab",
        langName: "Sadri (नागपुरी)",
        ttsText: "किताब",
        sentence: "यह मेरी किताब है। (ई हमर किताब हे)",
      },
    },
  },
  {
    id: "bird",
    category: "प्रकृति (Nature)",
    icon: "flutter",
    color: "#00ACC1",
    hindi: "चिड़िया / पक्षी",
    meaning: "Bird — डाल पर चहकने वाली",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱪᱮᱬᱮ",
        translit: "Chene",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱪᱮᱬᱮ",
        sentence: "चिड़िया डाल पर बैठी है। (ᱪᱮᱬᱮ ᱰᱟᱹᱨ ᱨᱮᱭ ᱫᱩᱲᱩᱵ ᱟᱠᱟᱱᱟ)",
      },
      hoc: {
        script: "चेंड़े (𑢰𑢮𑢢𑢲)",
        translit: "Chende",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "चेंड़े",
        sentence: "चिड़िया डाल पर बैठी है। (चेंड़े दारु रे दुबुःयेना)",
      },
      unr: {
        script: "चेंड़े",
        translit: "Chende",
        langName: "Mundari (मुंडारी)",
        ttsText: "चेंड़े",
        sentence: "चिड़िया डाल पर बैठी है। (चेंड़े दारु रे दुबुःयेना)",
      },
      kru: {
        script: "ओड़ो",
        translit: "Oro",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "ओड़ो",
        sentence: "चिड़िया डाल पर बैठी है। (ओड़ो मन्न तरा उक्की)",
      },
      sck: {
        script: "चिरई",
        translit: "Chirai",
        langName: "Sadri (नागपुरी)",
        ttsText: "चिरई",
        sentence: "चिड़िया डाल पर बैठी है। (चिरई डारी ऊपर बईठल हे)",
      },
    },
  },
  {
    id: "flower",
    category: "प्रकृति (Nature)",
    icon: "local_florist",
    color: "#E91E63",
    hindi: "फूल / पुष्प",
    meaning: "Flower — रंग-बिरंगे सुगंधित फूल",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱵᱟᱦᱟ",
        translit: "Baha",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱵᱟᱦᱟ",
        sentence: "बगीचे में लाल फूल खिला है। (ᱵᱟᱜᱟᱱ ᱨᱮ ᱟᱨᱟᱜ ᱵᱟᱦᱟ ᱯᱷᱩᱴᱟᱹᱣ ᱟᱠᱟᱱᱟ)",
      },
      hoc: {
        script: "बा (𑢠𑢡)",
        translit: "Baa",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "बा",
        sentence: "सुंदर फूल खिला है। (बुगी बा ओड़ोःयेना)",
      },
      unr: {
        script: "बाहा",
        translit: "Baha",
        langName: "Mundari (मुंडारी)",
        ttsText: "बाहा",
        sentence: "सुंदर फूल खिला है। (बुगी बाहा ओड़ोःयेना)",
      },
      kru: {
        script: "पुप्प",
        translit: "Pupp",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "पुप्प",
        sentence: "सुंदर फूल खिला है। (दऊ पुप्प फुटाब रई)",
      },
      sck: {
        script: "फूल",
        translit: "Phool",
        langName: "Sadri (नागपुरी)",
        ttsText: "फूल",
        sentence: "सुंदर फूल खिला है। (सुंदर फूल फूलल हे)",
      },
    },
  },
  {
    id: "river",
    category: "प्रकृति (Nature)",
    icon: "waves",
    color: "#1E88E5",
    hindi: "नदी / सरिता",
    meaning: "River — गाँव से बहती निर्मल धारा",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱜᱟᱰᱟ",
        translit: "Gada",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱜᱟᱰᱟ",
        sentence: "नदी का पानी बह रहा है। (ᱜᱟᱰᱟ ᱫᱟᱜ ᱞᱤᱸᱜᱤᱱ ᱠᱟᱱᱟ)",
      },
      hoc: {
        script: "गाड़ा (𑢤𑢡𑢲𑢡)",
        translit: "Gada",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "गाड़ा",
        sentence: "नदी का पानी बह रहा है। (गाड़ा दाः लिंगी तन)",
      },
      unr: {
        script: "गाड़ा",
        translit: "Gada",
        langName: "Mundari (मुंडारी)",
        ttsText: "गाड़ा",
        sentence: "नदी का पानी बह रहा है। (गाड़ा दाः लिंगी तना)",
      },
      kru: {
        script: "खल / नदी",
        translit: "Khal",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "खल",
        sentence: "नदी का पानी बह रहा है। (खल ता अम्म बोहोरारी)",
      },
      sck: {
        script: "नदी / जोरिया",
        translit: "Nadi",
        langName: "Sadri (नागपुरी)",
        ttsText: "नदी",
        sentence: "नदी का पानी बह रहा है। (नदी कर पानी बहत हे)",
      },
    },
  },
  {
    id: "moon",
    category: "प्रकृति (Nature)",
    icon: "bedtime",
    color: "#5C6BC0",
    hindi: "चाँद / चंद्रमा",
    meaning: "Moon — रात का शीतल उजाला",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱪᱟᱸᱫᱚ",
        translit: "Chando",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱪᱟᱸᱫᱚ",
        sentence: "रात को चाँद चमकता है। (ᱧᱤᱫᱟᱹ ᱪᱟᱸᱫᱚᱭ ᱡᱩᱞᱩᱜ ᱠᱟᱱᱟ)",
      },
      hoc: {
        script: "चांदु (𑢰𑢡𑢢𑢵𑢯)",
        translit: "Chandu",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "चांदु",
        sentence: "रात को चाँद चमकता है। (निदा चांदु जुलुः तना)",
      },
      unr: {
        script: "चांदु",
        translit: "Chandu",
        langName: "Mundari (मुंडारी)",
        ttsText: "चांदु",
        sentence: "रात को चाँद चमकता है। (निदा चांदु जुलुः तना)",
      },
      kru: {
        script: "चन्दो",
        translit: "Chando",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "चन्दो",
        sentence: "रात को चाँद चमकता है। (माखा चन्दो चमकारी)",
      },
      sck: {
        script: "चांद",
        translit: "Chand",
        langName: "Sadri (नागपुरी)",
        ttsText: "चांद",
        sentence: "रात को चाँद चमकता है। (राती चांद चमकेला)",
      },
    },
  },
  {
    id: "forest",
    category: "प्रकृति (Nature)",
    icon: "forest",
    color: "#33691E",
    hindi: "जंगल / वन",
    meaning: "Forest — सारंडा और दलमा के समृद्ध जंगल",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱵᱤᱨ",
        translit: "Bir",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱵᱤᱨ",
        sentence: "जंगल में पशु-पक्षी रहते हैं। (ᱵᱤᱨ ᱨᱮ ᱡᱤᱭᱟᱹᱞᱤ ᱠᱚ ᱛᱟᱦᱮᱸᱱᱟ)",
      },
      hoc: {
        script: "बिर (𑢠𑢳𑢣)",
        translit: "Bir",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "बिर",
        sentence: "जंगल में जानवर रहते हैं। (बिर रे जीवको तइकेन)",
      },
      unr: {
        script: "बिर",
        translit: "Bir",
        langName: "Mundari (मुंडारी)",
        ttsText: "बिर",
        sentence: "जंगल में जानवर रहते हैं। (बिर रे जीवको तइकेना)",
      },
      kru: {
        script: "टोड़ंग",
        translit: "Torang",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "टोड़ंग",
        sentence: "जंगल में जानवर रहते हैं। (टोड़ंग नू जानबर रअनार)",
      },
      sck: {
        script: "जंगल / बोन",
        translit: "Bon",
        langName: "Sadri (नागपुरी)",
        ttsText: "बोन",
        sentence: "जंगल में जानवर रहते हैं। (बोन में जानवर मन रहेना)",
      },
    },
  },
  {
    id: "house",
    category: "परिवार (Family)",
    icon: "home",
    color: "#6D4C41",
    hindi: "घर / गृह",
    meaning: "House — हमारा निवास और शरण",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱚᱲᱟᱜ",
        translit: "Ora:",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱚᱲᱟᱜ",
        sentence: "यह हमारा घर है। (ᱱᱚᱣᱟ ᱫᱚ ᱟᱞᱮᱭᱟᱜ ᱚᱲᱟᱜ ᱠᱟᱱᱟ)",
      },
      hoc: {
        script: "ओवाः (𑢱𑢷𑢡𑢬)",
        translit: "Owa:",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "ओवाः",
        sentence: "यह हमारा घर है। (नेयाः अलेयाः ओवाः तना)",
      },
      unr: {
        script: "ओड़ाः",
        translit: "Ora:",
        langName: "Mundari (मुंडारी)",
        ttsText: "ओड़ाः",
        sentence: "यह हमारा घर है। (नेयाः आलेयाः ओड़ाः तना)",
      },
      kru: {
        script: "एड़पा",
        translit: "Erpa",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "एड़पा",
        sentence: "यह हमारा घर है। (ईदन एम्है एड़पा हिकै)",
      },
      sck: {
        script: "घर / डेरा",
        translit: "Ghar",
        langName: "Sadri (नागपुरी)",
        ttsText: "घर",
        sentence: "यह हमारा घर है। (ई हमर घर हे)",
      },
    },
  },
  {
    id: "father",
    category: "परिवार (Family)",
    icon: "face",
    color: "#455A64",
    hindi: "पिता / बाबा",
    meaning: "Father — परिवार के संरक्षक",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱵᱟᱵᱟ / ᱟᱯᱟᱛ",
        translit: "Baba / Apat",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱵᱟᱵᱟ",
        sentence: "पिताजी खेत में काम करते हैं। (ᱵᱟᱵᱟ ᱠᱷᱮᱛ ᱨᱮ ᱠᱟᱹᱢᱤ ᱠᱟᱱᱟᱭ)",
      },
      hoc: {
        script: "आपा (𑢡𑢪𑢡)",
        translit: "Apa",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "आपा",
        sentence: "पिताजी काम करते हैं। (आपा पइटी तनए)",
      },
      unr: {
        script: "आपा / बाबा",
        translit: "Apa",
        langName: "Mundari (मुंडारी)",
        ttsText: "आपा",
        sentence: "पिताजी काम करते हैं। (आपा कामी तनाए)",
      },
      kru: {
        script: "तंबस / बाबा",
        translit: "Baba",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "बाबा",
        sentence: "पिताजी काम करते हैं। (बाबा नलख नलदी)",
      },
      sck: {
        script: "बाप / अब्बा",
        translit: "Baap",
        langName: "Sadri (नागपुरी)",
        ttsText: "बाप",
        sentence: "पिताजी काम करते हैं। (बाबा काम करेला)",
      },
    },
  },
  {
    id: "child",
    category: "परिवार (Family)",
    icon: "child_care",
    color: "#F06292",
    hindi: "बच्चा / बालक",
    meaning: "Child — विद्यालय के नन्हे शिक्षार्थी",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱜᱤᱫᱽᱨᱟᱹ",
        translit: "Gidra",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱜᱤᱫᱽᱨᱟᱹ",
        sentence: "बच्चा मैदान में खेलता है। (ᱜᱤᱫᱽᱨᱟᱹ ᱴᱟᱺᱰᱤ ᱨᱮᱭ ᱮᱱᱮᱡ ᱠᱟᱱᱟ)",
      },
      hoc: {
        script: "होन (𑢹𑣉𑢯)",
        translit: "Hon",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "होन",
        sentence: "बच्चा खेलता है। (होन इनेङ तनए)",
      },
      unr: {
        script: "हुन / गिदिरी",
        translit: "Hun",
        langName: "Mundari (मुंडारी)",
        ttsText: "हुन",
        sentence: "बच्चा खेलता है। (हुन इनेङ तनाए)",
      },
      kru: {
        script: "ख़द्द",
        translit: "Khadd",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "ख़द्द",
        sentence: "बच्चा खेलता है। (ख़द्द बेचारी)",
      },
      sck: {
        script: "छौआ",
        translit: "Chhoua",
        langName: "Sadri (नागपुरी)",
        ttsText: "छौआ",
        sentence: "बच्चा खेलता है। (छौआ खेलत हे)",
      },
    },
  },
  {
    id: "teacher",
    category: "विद्यालय (School)",
    icon: "co_present",
    color: "#5E35B1",
    hindi: "शिक्षक / गुरुजी",
    meaning: "Teacher — बाल-सखा मार्गदर्शक",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱥᱮᱪᱮᱫᱤᱭᱟᱹ / ᱢᱟᱪᱮᱛ",
        translit: "Sechediya / Machet",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱥᱮᱪᱮᱫᱤᱭᱟᱹ",
        sentence: "शिक्षक पाठ पढ़ा रहे हैं। (ᱥᱮᱪᱮᱫᱤᱭᱟᱹ ᱯᱟᱴᱷ ᱮ ᱯᱟᱲᱦᱟᱣ ᱮᱫ ᱠᱚᱣᱟ)",
      },
      hoc: {
        script: "इटुनिया / माचो (𑢳𑢦𑢯𑢳𑢪)",
        translit: "Ituniya / Macho",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "माचो",
        sentence: "शिक्षक पढ़ा रहे हैं। (माचो पढ़ाव तनको)",
      },
      unr: {
        script: "इटुनिकेन / माचो",
        translit: "Ituniken / Macho",
        langName: "Mundari (मुंडारी)",
        ttsText: "माचो",
        sentence: "शिक्षक पढ़ा रहे हैं। (माचो पढ़ाव तनाको)",
      },
      kru: {
        script: "पड़हाउ / मास्टर",
        translit: "Parhau",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "पड़हाउ",
        sentence: "शिक्षक पढ़ा रहे हैं। (पड़हाउ पढ़नर)",
      },
      sck: {
        script: "गुरुजी / मास्टर",
        translit: "Guruji",
        langName: "Sadri (नागपुरी)",
        ttsText: "गुरुजी",
        sentence: "शिक्षक पढ़ा रहे हैं। (गुरुजी पढ़ावत हैं)",
      },
    },
  },
  {
    id: "pen",
    category: "विद्यालय (School)",
    icon: "edit",
    color: "#1565C0",
    hindi: "कलम / लेखनी",
    meaning: "Pen — विचार लिखने का माध्यम",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱠᱚᱞᱚᱢ",
        translit: "Kolom",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱠᱚᱞᱚᱢ",
        sentence: "मैं कलम से लिखता हूँ। (ᱤᱧ ᱠᱚᱞᱚᱢ ᱛᱤᱧ ᱚᱞᱟ)",
      },
      hoc: {
        script: "कलम (𑢤𑢳𑢡𑢮)",
        translit: "Kolom",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "कलम",
        sentence: "कलम से लिखो। (कलम ते ओल मे)",
      },
      unr: {
        script: "कलम",
        translit: "Kolom",
        langName: "Mundari (मुंडारी)",
        ttsText: "कलम",
        sentence: "कलम से लिखो। (कलम ते ओलोः मे)",
      },
      kru: {
        script: "कलम",
        translit: "Kalam",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "कलम",
        sentence: "कलम से लिखो। (कलम ती टूड़ा)",
      },
      sck: {
        script: "कलम",
        translit: "Kalam",
        langName: "Sadri (नागपुरी)",
        ttsText: "कलम",
        sentence: "कलम से लिखो। (कलम से लिख)",
      },
    },
  },
  {
    id: "cow",
    category: "पशु-पक्षी (Animals)",
    icon: "cruelty_free",
    color: "#795548",
    hindi: "गाय / गऊ",
    meaning: "Cow — दूध देने वाला पालतू पशु",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱜᱟᱹᱭ",
        translit: "Gai",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱜᱟᱹᱭ",
        sentence: "गाय हरी घास खाती है। (ᱜᱟᱹᱭ ᱦᱟᱹᱨᱤᱭᱟᱹᱲ ᱜᱷᱟᱸᱥ ᱮ ᱡᱚᱢᱟ)",
      },
      hoc: {
        script: "गई (𑢤𑢡𑢳)",
        translit: "Gai",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "गई",
        sentence: "गाय घास खाती है। (गई घास जोमे तनए)",
      },
      unr: {
        script: "गई",
        translit: "Gai",
        langName: "Mundari (मुंडारी)",
        ttsText: "गई",
        sentence: "गाय घास खाती है। (गई घास जोमे तनाए)",
      },
      kru: {
        script: "ओय / गाय",
        translit: "Oy",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "ओय",
        sentence: "गाय घास खाती है। (गाय घास मॊख़ी)",
      },
      sck: {
        script: "गाय",
        translit: "Gaay",
        langName: "Sadri (नागपुरी)",
        ttsText: "गाय",
        sentence: "गाय घास खाती है। (गाय घास खाएला)",
      },
    },
  },
  {
    id: "dog",
    category: "पशु-पक्षी (Animals)",
    icon: "pets",
    color: "#8D6E63",
    hindi: "कुत्ता / श्वान",
    meaning: "Dog — घर की रखवाली करने वाला साथी",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱥᱮᱛᱟ",
        translit: "Seta",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱥᱮᱛᱟ",
        sentence: "कुत्ता घर की रखवाली करता है। (ᱥᱮᱛᱟ ᱚᱲᱟᱜ ᱮ ᱨᱩᱠᱷᱤᱭᱟᱹᱭᱟ)",
      },
      hoc: {
        script: "सेता (𑢷𑢮𑢦𑢡)",
        translit: "Seta",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "सेता",
        sentence: "कुत्ता घर देखता है। (सेता ओवाः नेले तनए)",
      },
      unr: {
        script: "सेता",
        translit: "Seta",
        langName: "Mundari (मुंडारी)",
        ttsText: "सेता",
        sentence: "कुत्ता घर देखता है। (सेता ओड़ाः लेले तनाए)",
      },
      kru: {
        script: "अल्ला",
        translit: "Alla",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "अल्ला",
        sentence: "कुत्ता घर देखता है। (अल्ला एड़पा एरी)",
      },
      sck: {
        script: "कुकुर",
        translit: "Kukur",
        langName: "Sadri (नागपुरी)",
        ttsText: "कुकुर",
        sentence: "कुत्ता घर देखता है। (कुकुर घर देखेला)",
      },
    },
  },
  {
    id: "fish",
    category: "पशु-पक्षी (Animals)",
    icon: "phishing",
    color: "#0097A7",
    hindi: "मछली / मीन",
    meaning: "Fish — तालाब और नदी में तैरने वाली",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱦᱟᱠᱩ",
        translit: "Haku",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱦᱟᱠᱩ",
        sentence: "मछली पानी में तैरती है। (ᱦᱟᱠᱩ ᱫᱟᱜ ᱨᱮ ᱯᱟᱭᱨᱟᱜ ᱠᱟᱱᱟᱭ)",
      },
      hoc: {
        script: "हाकु (𑢹𑢡𑢤𑢯)",
        translit: "Haku",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "हाकु",
        sentence: "मछली पानी में तैरती है। (हाकु दाः रे पायर तनए)",
      },
      unr: {
        script: "हाकु",
        translit: "Haku",
        langName: "Mundari (मुंडारी)",
        ttsText: "हाकु",
        sentence: "मछली पानी में तैरती है। (हाकु दाः रे पायर तनाए)",
      },
      kru: {
        script: "ईंजो",
        translit: "Injo",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "ईंजो",
        sentence: "मछली पानी में तैरती है। (ईंजो अम्म नू तैरारी)",
      },
      sck: {
        script: "मछरी",
        translit: "Machhari",
        langName: "Sadri (नागपुरी)",
        ttsText: "मछरी",
        sentence: "मछली पानी में तैरती है। (मछरी पानी में तैरेला)",
      },
    },
  },
  {
    id: "farmer",
    category: "गाँव एवं समाज (Village & Community)",
    icon: "agriculture",
    color: "#558B2F",
    hindi: "किसान / कृषक",
    meaning: "Farmer — खेत जोतने वाला अन्नदाता",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱪᱟᱥᱤ",
        translit: "Chasi",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱪᱟᱥᱤ",
        sentence: "किसान धान उपजाता है। (ᱪᱟᱥᱤ ᱦᱳᱲᱳᱭ ᱟᱨᱡᱟᱣᱟ)",
      },
      hoc: {
        script: "चासी (𑢰𑢡𑢷𑢳)",
        translit: "Chasi",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "चासी",
        sentence: "किसान धान उपजाता है। (चासी बाबा रोवाए तनए)",
      },
      unr: {
        script: "चासी",
        translit: "Chasi",
        langName: "Mundari (मुंडारी)",
        ttsText: "चासी",
        sentence: "किसान धान उपजाता है। (चासी बाबा रोवेआ तनाए)",
      },
      kru: {
        script: "किसान / उलस",
        translit: "Kisan",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "किसान",
        sentence: "किसान धान उपजाता है। (किसान धान उथारनर)",
      },
      sck: {
        script: "किसान / जोतिहार",
        translit: "Kisan",
        langName: "Sadri (नागपुरी)",
        ttsText: "किसान",
        sentence: "किसान धान उपजाता है। (किसान धान रोपेला)",
      },
    },
  },
  {
    id: "market",
    category: "गाँव एवं समाज (Village & Community)",
    icon: "storefront",
    color: "#EF6C00",
    hindi: "बाज़ार / हाट",
    meaning: "Market — गाँव का साप्ताहिक बाज़ार",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱦᱟᱴ",
        translit: "Haat",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱦᱟᱴ",
        sentence: "गाँव में आज हाट लगा है। (ᱟᱹᱛᱩ ᱨᱮ ᱛᱮᱦᱮᱧ ᱦᱟᱴ ᱞᱟᱜᱟᱣ ᱟᱠᱟᱱᱟ)",
      },
      hoc: {
        script: "हाट (𑢹𑢡𑢲)",
        translit: "Haat",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "हाट",
        sentence: "आज हाट लगा है। (तिशिंग हाट लागावयेना)",
      },
      unr: {
        script: "हाट",
        translit: "Haat",
        langName: "Mundari (मुंडारी)",
        ttsText: "हाट",
        sentence: "आज हाट लगा है। (तिशिंग हाट लागावयेना)",
      },
      kru: {
        script: "पेठिया / हाट",
        translit: "Pethiya",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "पेठिया",
        sentence: "आज हाट लगा है। (इन्ना पेठिया लग्गिया)",
      },
      sck: {
        script: "हाट / बजिया",
        translit: "Haat",
        langName: "Sadri (नागपुरी)",
        ttsText: "हाट",
        sentence: "आज हाट लगा है। (आईज हाट लागल हे)",
      },
    },
  },
  {
    id: "food",
    category: "गाँव एवं समाज (Village & Community)",
    icon: "restaurant",
    color: "#C2185B",
    hindi: "भोजन / भात",
    meaning: "Food — माँडी और भात (दैनिक आहार)",
    pos: "संज्ञा (Noun)",
    dialects: {
      sat: {
        script: "ᱫᱟᱠᱟ / ᱢᱟᱱᱰᱤ",
        translit: "Daka / Mandi",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱫᱟᱠᱟ",
        sentence: "हम सबने दोपहर का खाना खाया। (ᱟᱞᱮ ᱛᱤᱠᱤᱱ ᱫᱟᱠᱟ ᱞᱮ ᱡᱚᱢ ᱠᱮᱫᱟ)",
      },
      hoc: {
        script: "मांडी (𑢫𑢡𑢢𑢵𑢳)",
        translit: "Mandi",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "मांडी",
        sentence: "हमने खाना खाया। (अले मांडी जोमेयेना)",
      },
      unr: {
        script: "मंडी",
        translit: "Mandi",
        langName: "Mundari (मुंडारी)",
        ttsText: "मंडी",
        sentence: "हमने खाना खाया। (आले मंडी जोमेयेना)",
      },
      kru: {
        script: "मंडी",
        translit: "Mandi",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "मंडी",
        sentence: "हमने खाना खाया। (नाम मंडी मोक्खम)",
      },
      sck: {
        script: "भात / खाना",
        translit: "Bhaat",
        langName: "Sadri (नागपुरी)",
        ttsText: "भात",
        sentence: "हमने खाना खाया। (हमन भात खायली)",
      },
    },
  },
  {
    id: "one",
    category: "गिनती (Numbers)",
    icon: "looks_one",
    color: "#00796B",
    hindi: "एक (१)",
    meaning: "One — संख्या १",
    pos: "संख्या (Number)",
    dialects: {
      sat: {
        script: "ᱢᱤᱫ (᱑)",
        translit: "Mid",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱢᱤᱫ",
        sentence: "सूरज एक है। (ᱥᱤᱧ ᱪᱟᱸᱫᱚ ᱫᱚ ᱢᱤᱫᱴᱟᱝ ᱜᱮᱭᱟ)",
      },
      hoc: {
        script: "मि (१) (𑢫𑢳)",
        translit: "Mi",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "मि",
        sentence: "सूरज एक है। (सिंगी मि तना)",
      },
      unr: {
        script: "मियद (१)",
        translit: "Miyad",
        langName: "Mundari (मुंडारी)",
        ttsText: "मियद",
        sentence: "सूरज एक है। (सिंगी मियद तना)",
      },
      kru: {
        script: "ओन्द (१)",
        translit: "Ond",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "ओन्द",
        sentence: "सूरज एक है। (बीड़ी ओन्द रई)",
      },
      sck: {
        script: "एक (१)",
        translit: "Ek",
        langName: "Sadri (नागपुरी)",
        ttsText: "एक",
        sentence: "सूरज एक है। (सुरुज एक हे)",
      },
    },
  },
  {
    id: "two",
    category: "गिनती (Numbers)",
    icon: "looks_two",
    color: "#E65100",
    hindi: "दो (२)",
    meaning: "Two — संख्या २",
    pos: "संख्या (Number)",
    dialects: {
      sat: {
        script: "ᱵᱟᱨ (᱒)",
        translit: "Bar",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱵᱟᱨ",
        sentence: "हमारे दो हाथ हैं। (ᱟᱵᱚᱣᱟᱜ ᱵᱟᱨᱭᱟ ᱛᱤ ᱢᱮᱱᱟᱜᱼᱟ)",
      },
      hoc: {
        script: "बारिया (२) (𑢠𑢡𑢣𑢳𑢪)",
        translit: "Bariya",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "बारिया",
        sentence: "हमारे दो हाथ हैं। (अबूआः बारिया ती मेनाः)",
      },
      unr: {
        script: "बारिया (२)",
        translit: "Bariya",
        langName: "Mundari (मुंडारी)",
        ttsText: "बारिया",
        sentence: "हमारे दो हाथ हैं। (आबूआः बारिया ती मेनाः)",
      },
      kru: {
        script: "इंड (२)",
        translit: "Ind",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "इंड",
        sentence: "हमारे दो हाथ हैं। (नम्है इंड ख़ेक्खा रई)",
      },
      sck: {
        script: "दूई (२)",
        translit: "Duee",
        langName: "Sadri (नागपुरी)",
        ttsText: "दूई",
        sentence: "हमारे दो हाथ हैं। (हमन कर दूई हाथ हे)",
      },
    },
  },
  {
    id: "three",
    category: "गिनती (Numbers)",
    icon: "looks_3",
    color: "#6A1B9A",
    hindi: "तीन (३)",
    meaning: "Three — संख्या ३",
    pos: "संख्या (Number)",
    dialects: {
      sat: {
        script: "ᱯᱮ (᱓)",
        translit: "Pe",
        langName: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)",
        ttsText: "ᱯᱮ",
        sentence: "तिरंगे में तीन रंग हैं। (ᱛᱤᱨᱟᱝᱜᱟ ᱨᱮ ᱯᱮᱭᱟ ᱨᱚᱝ ᱢᱮᱱᱟᱜᱼᱟ)",
      },
      hoc: {
        script: "आपिया (३) (𑢡𑢪𑢳𑢪)",
        translit: "Aapiya",
        langName: "Ho (हो / 𑢹𑣉𑣉)",
        ttsText: "आपिया",
        sentence: "तीन रंग हैं। (आपिया रंग मेनाः)",
      },
      unr: {
        script: "आपिया (३)",
        translit: "Aapiya",
        langName: "Mundari (मुंडारी)",
        ttsText: "आपिया",
        sentence: "तीन रंग हैं। (आपिया रंग मेनाः)",
      },
      kru: {
        script: "मुंद (३)",
        translit: "Mund",
        langName: "Kurukh (कुड़ुख़)",
        ttsText: "मुंद",
        sentence: "तीन रंग हैं। (मुंद रंग रई)",
      },
      sck: {
        script: "तीन (३)",
        translit: "Teen",
        langName: "Sadri (नागपुरी)",
        ttsText: "तीन",
        sentence: "तीन रंग हैं। (तीन रंग हे)",
      },
    },
  },
];

export default function Flashcards({ lessonText = "", currentGrade = 2 }) {
  const [selectedDialect, setSelectedDialect] = useState("sat");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [activeAudioBlob, setActiveAudioBlob] = useState(null);
  const [audioError, setAudioError] = useState("");
  const [isShuffle, setIsShuffle] = useState(false);
  const [shuffleOrder, setShuffleOrder] = useState(null);

  // Lesson context matching: find cards that match any word in lessonText
  const lessonMatchingCardIds = useMemo(() => {
    if (!lessonText || !lessonText.trim()) return new Set();
    const words = lessonText.toLowerCase().split(/[\s,।!?.]+/).filter((w) => w.length > 1);
    const matches = new Set();
    for (const card of FOUNDATION_CARDS) {
      const hindiParts = card.hindi.toLowerCase().split(/[\s/()]+/);
      if (hindiParts.some((p) => words.includes(p))) {
        matches.add(card.id);
      }
    }
    return matches;
  }, [lessonText]);

  // Categories extraction
  const categories = useMemo(() => {
    const set = ["all"];
    if (lessonMatchingCardIds.size > 0) {
      set.push("lesson");
    }
    for (const c of FOUNDATION_CARDS) {
      if (!set.includes(c.category)) set.push(c.category);
    }
    return set;
  }, [lessonMatchingCardIds]);

  // Filtered Cards
  const baseCards = useMemo(() => {
    if (selectedCategory === "all") return FOUNDATION_CARDS;
    if (selectedCategory === "lesson") return FOUNDATION_CARDS.filter((c) => lessonMatchingCardIds.has(c.id));
    return FOUNDATION_CARDS.filter((c) => c.category === selectedCategory);
  }, [selectedCategory, lessonMatchingCardIds]);

  // Handle Shuffle
  const cards = useMemo(() => {
    if (!isShuffle || !shuffleOrder) return baseCards;
    return [...baseCards].sort((a, b) => (shuffleOrder[a.id] || 0) - (shuffleOrder[b.id] || 0));
  }, [baseCards, isShuffle, shuffleOrder]);

  const safeIndex = activeCardIndex >= cards.length ? 0 : activeCardIndex;
  const card = cards[safeIndex] || FOUNDATION_CARDS[0];
  const dialectInfo = card.dialects[selectedDialect] || card.dialects.sat;

  function handleToggleShuffle() {
    if (!isShuffle) {
      const order = {};
      baseCards.forEach((c) => {
        order[c.id] = Math.random();
      });
      setShuffleOrder(order);
      setIsShuffle(true);
      setActiveCardIndex(0);
      setIsFlipped(false);
    } else {
      setIsShuffle(false);
      setShuffleOrder(null);
      setActiveCardIndex(0);
      setIsFlipped(false);
    }
    setActiveAudioBlob(null);
    setAudioError("");
  }

  async function handlePlayCardAudio() {
    setAudioLoading(true);
    setAudioError("");
    setActiveAudioBlob(null);

    try {
      // Speak the authentic native mother-tongue word
      // For Santali: pass Ol Chiki script (e.g. ᱫᱟᱜ)
      // For Ho, Mundari, Kurukh, Sadri: pass the clean Devanagari word (e.g. दा, अम्म, पानी)
      const textToSpeak = dialectInfo.ttsText || dialectInfo.script.replace(/\s*\([^)]*\)/g, "").split("/")[0].trim();
      const res = await speak(textToSpeak, selectedDialect);
      if (res.kind === "audio") {
        setActiveAudioBlob(res.blob);
      } else if (res.kind === "phrase_bank_only") {
        setAudioError(res.reason || "Audio unavailable for this entry.");
      }
    } catch (err) {
      setAudioError("Audio error: " + err.message);
    } finally {
      setAudioLoading(false);
    }
  }

  function handleNext() {
    setIsFlipped(false);
    setActiveAudioBlob(null);
    setAudioError("");
    setActiveCardIndex((prev) => (prev + 1) % cards.length);
  }

  function handlePrev() {
    setIsFlipped(false);
    setActiveAudioBlob(null);
    setAudioError("");
    setActiveCardIndex((prev) => (prev - 1 + cards.length) % cards.length);
  }

  return (
    <section className="flashcards-section" aria-labelledby="flashcards-heading">
      <div className="section-eyebrow">
        <span className="eyebrow-tag">कक्षा १–३ बाल-वाटिका</span>
        <span>दृश्य शिक्षण · सचित्र द्विभाषी शब्द-पत्ती (Visual Flashcards)</span>
      </div>
      <h1 id="flashcards-heading" className="screen-title">
        Visual Bilingual Flashcards <span lang="hi">(सचित्र शब्द-पत्ती)</span>
      </h1>
      <p className="screen-subtitle">
        Foundational Vocabulary in Authentic Mother-Tongue Scripts for Classroom Drills, Circle Time & Early Readers.
      </p>

      {/* Category & Dialect Selector Bars */}
      <div className="flashcards-toolbar">
        <div className="dialect-pills-bar" role="tablist" aria-label="Select Target Dialect">
          {[
            { code: "sat", name: "Santali (Ol Chiki ᱥᱟᱱᱛᱟᱲᱤ)" },
            { code: "hoc", name: "Ho (हो / 𑢹𑣉𑣉)" },
            { code: "unr", name: "Mundari (मुंडारी)" },
            { code: "kru", name: "Kurukh (कुड़ुख़)" },
            { code: "sck", name: "Sadri (नागपुरी)" },
          ].map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="tab"
              aria-selected={selectedDialect === lang.code}
              className={`dialect-pill-btn ${selectedDialect === lang.code ? "active" : ""}`}
              onClick={() => {
                setSelectedDialect(lang.code);
                setActiveAudioBlob(null);
                setAudioError("");
              }}
            >
              {lang.name}
            </button>
          ))}
        </div>

        <div className="flashcards-tool-actions">
          <button
            type="button"
            className={`button button--secondary tactile-btn-secondary ${isShuffle ? "button--active" : ""}`}
            onClick={handleToggleShuffle}
            title="Randomize card sequence for classroom quiz"
          >
            <span className="material-symbols-outlined text-base">shuffle</span>
            <span>{isShuffle ? "यादृच्छिक (Shuffled)" : "शफल (Shuffle)"}</span>
          </button>

          <button
            type="button"
            className="button button--secondary tactile-btn-secondary"
            onClick={() => window.print()}
            title="Print flashcards for classroom circle drill"
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>Print Cards</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flashcards-category-bar" role="tablist" aria-label="Filter by Topic">
        {categories.map((cat) => {
          let label = cat;
          let count = 0;
          if (cat === "all") {
            label = "सभी शब्द (All 26 Cards)";
            count = FOUNDATION_CARDS.length;
          } else if (cat === "lesson") {
            label = "✨ इस पाठ से संबंधित (In Lesson)";
            count = lessonMatchingCardIds.size;
          } else {
            count = FOUNDATION_CARDS.filter((c) => c.category === cat).length;
          }

          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat}
              className={`category-pill-btn ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => {
                setSelectedCategory(cat);
                setActiveCardIndex(0);
                setIsFlipped(false);
                setActiveAudioBlob(null);
                setAudioError("");
              }}
            >
              <span>{label}</span>
              <span className="cat-count-badge">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Flashcard Display */}
      <div className="flashcard-stage-container">
        <div
          className={`interactive-flashcard-wrap ${isFlipped ? "flipped" : ""}`}
          onClick={() => setIsFlipped(!isFlipped)}
          role="button"
          tabIndex={0}
          aria-label={`Flashcard ${card.hindi}. Click to flip.`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsFlipped(!isFlipped);
            }
          }}
        >
          <div className="flashcard-inner">
            {/* FRONT OF CARD (Hindi + Visual Icon) */}
            <div className="flashcard-face flashcard-front" style={{ borderColor: card.color }}>
              <div className="card-top-meta">
                <span className="card-cat-badge" style={{ borderColor: card.color }}>
                  {card.category}
                </span>
                <span className="flip-hint">
                  <span className="material-symbols-outlined text-xs">sync</span>
                  <span>क्लिक करके पलटें (Click to Flip)</span>
                </span>
              </div>

              <div className="card-visual-circle" style={{ borderColor: `${card.color}60` }}>
                <span className="material-symbols-outlined card-big-icon" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {card.icon}
                </span>
              </div>

              <div className="card-hindi-block">
                <h2 className="card-hindi-word" lang="hi">{card.hindi}</h2>
                <p className="card-meaning-sub">{card.meaning}</p>
              </div>

              <div className="card-bottom-footer">
                <span className="card-class-tag">{card.pos || "संज्ञा"} · Class {currentGrade}</span>
                <span className="card-index-count">
                  {safeIndex + 1} / {cards.length}
                </span>
              </div>
            </div>

            {/* BACK OF CARD (Mother-Tongue Native Script + Audio) */}
            <div className="flashcard-face flashcard-back" style={{ borderColor: card.color }}>
              <div className="card-top-meta">
                <span className="card-cat-badge" style={{ borderColor: card.color }}>
                  {dialectInfo.langName}
                </span>
                <span className="flip-hint">
                  <span className="material-symbols-outlined text-xs">sync</span>
                  <span>वापस पलटें (Flip Back)</span>
                </span>
              </div>

              <div className="card-mother-tongue-block">
                <span className="script-badge-small">मूल लिपि (Native Script):</span>
                <div className="card-native-script" lang={selectedDialect}>
                  {dialectInfo.script}
                </div>
                <div className="card-translit-pronounce">
                  <span>उच्चारण (Phonetics): </span>
                  <strong>{dialectInfo.translit}</strong>
                </div>
              </div>

              <div className="card-sentence-box" lang="hi">
                <span className="sentence-label">कक्षा प्रयोग (Classroom Usage):</span>
                <p className="sentence-text">{dialectInfo.sentence}</p>
              </div>

              <div className="card-action-bar" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="button button--primary tactile-btn-primary card-audio-btn"
                  onClick={handlePlayCardAudio}
                  disabled={audioLoading}
                >
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    volume_up
                  </span>
                  <span>{audioLoading ? "ध्वनि तैयार हो रही है…" : "बोलकर सुनाएं (Pronounce)"}</span>
                </button>
              </div>

              {activeAudioBlob && (
                <div className="card-player-embed" onClick={(e) => e.stopPropagation()}>
                  <AudioPlayer blob={activeAudioBlob} label={`${card.hindi} native pronunciation`} />
                </div>
              )}

              {audioError && <p className="error text-xs" style={{ margin: "0.25rem 0" }}>{audioError}</p>}
            </div>
          </div>
        </div>

        {/* Carousel Navigation Controls */}
        <div className="flashcard-nav-controls">
          <button
            type="button"
            className="button button--secondary tactile-btn-secondary"
            onClick={handlePrev}
            aria-label="Previous card"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>पिछला कार्ड (Prev)</span>
          </button>

          <span className="card-counter-display">
            Card <strong>{safeIndex + 1}</strong> of {cards.length}
          </span>

          <button
            type="button"
            className="button button--primary tactile-btn-primary"
            onClick={handleNext}
            aria-label="Next card"
          >
            <span>अगला कार्ड (Next)</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Classroom Drill Guide */}
      <div className="flashcard-pedagogy-guide sun-card-shadow">
        <div className="guide-header">
          <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            tips_and_updates
          </span>
          <strong>शिक्षक बाल-सखा मार्गदर्शन (Teacher's Circle Drill Routine)</strong>
        </div>
        <ol className="drill-steps-list">
          <li>
            <strong>देखें और पहचानें (Step 1):</strong> कार्ड का अगला भाग दिखाकर बच्चों से हिंदी शब्द और चित्र पहचानने को कहें।
          </li>
          <li>
            <strong>मातृभाषा में उच्चारण (Step 2):</strong> कार्ड पलटकर स्थानीय लिपि में लिखा शब्द और उच्चारण दिखाएं।
          </li>
          <li>
            <strong>ध्वनि अभ्यास (Step 3):</strong> "बोलकर सुनाएं" बटन दबाएं और बच्चों को तीन बार एक साथ दोहराने को कहें (Classroom Chanting & Repetition)।
          </li>
        </ol>
      </div>
    </section>
  );
}
