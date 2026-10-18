"use strict";

(function () {
  const ALLOWED_EMOTIONS = Object.freeze([
    "excited",
    "gentle",
    "encouraging",
    "sleepy",
    "concerned",
    "playful",
    "neutral"
  ]);

  const ALLOWED_INTENSITIES = Object.freeze(["low", "medium", "high"]);

  const EMOTION_DELIVERY = Object.freeze({
    excited: {
      emotion: "excited",
      intensity: "high",
      pitch: 1.45,
      speed: 1.08,
      fishTag: "[excited]",
      moodLabel: "So excited! 🐾",
      animation: "excited"
    },
    gentle: {
      emotion: "gentle",
      intensity: "low",
      pitch: 1.25,
      speed: 0.90,
      fishTag: "[softly]",
      moodLabel: "Gentle reminder ✨",
      animation: "greeting"
    },
    encouraging: {
      emotion: "encouraging",
      intensity: "medium",
      pitch: 1.38,
      speed: 1.02,
      fishTag: "[cheerful]",
      moodLabel: "You got this! 🐾",
      animation: "greeting"
    },
    sleepy: {
      emotion: "sleepy",
      intensity: "low",
      pitch: 1.15,
      speed: 0.82,
      fishTag: "[sigh]",
      moodLabel: "Cozy break... 💤",
      animation: "greeting"
    },
    concerned: {
      emotion: "concerned",
      intensity: "medium",
      pitch: 1.30,
      speed: 0.92,
      fishTag: "[worried]",
      moodLabel: "Checking in on you 🐾",
      animation: "greeting"
    },
    playful: {
      emotion: "playful",
      intensity: "medium",
      pitch: 1.42,
      speed: 1.05,
      fishTag: "[playful]",
      moodLabel: "Mischief time! 🐾",
      animation: "excited"
    },
    neutral: {
      emotion: "neutral",
      intensity: "medium",
      pitch: 1.28,
      speed: 0.96,
      fishTag: "",
      moodLabel: "Here for you ✨",
      animation: "greeting"
    }
  });

  const actionWords = "wiggl\\w*|purr\\w*|smil\\w*|tilt\\w*(?:\\s+\\w+){0,2}|blink\\w*|wink\\w*|nod\\w*|bounce\\w*|wave\\w*|shrug\\w*|sigh\\w*|giggl\\w*|laugh\\w*|grin\\w*|stretch\\w*|yawn\\w*|flick\\w*";
  const stageDirection = new RegExp(`\\*{1,2}[^*\\n]{0,140}\\b(?:${actionWords})\\b[^*\\n]*\\*{1,2}`, "giu");
  const parentheticalDirection = new RegExp(`\\([^)]{0,140}\\b(?:${actionWords})\\b[^)]*\\)`, "giu");

  function extractEmotionMetadata(text) {
    if (typeof text !== "string") return { emotion: null, text: "" };
    let detectedEmotion = null;

    const tagMatch = text.match(/\[(?:emotion\s*:\s*)?([a-zA-Z_-]+)\]/i);
    if (tagMatch) {
      const candidate = tagMatch[1].toLowerCase().trim();
      if (ALLOWED_EMOTIONS.includes(candidate)) {
        detectedEmotion = candidate;
      }
    }

    if (!detectedEmotion) {
      const kvMatch = text.match(/\bemotion\s*:\s*([a-zA-Z_-]+)\b/i);
      if (kvMatch) {
        const candidate = kvMatch[1].toLowerCase().trim();
        if (ALLOWED_EMOTIONS.includes(candidate)) {
          detectedEmotion = candidate;
        }
      }
    }

    return { emotion: detectedEmotion, text };
  }

  function classifyEmotion(text, context = {}) {
    if (typeof text !== "string") return "neutral";

    // Check explicit emotion metadata in text first
    const extracted = extractEmotionMetadata(text);
    if (extracted.emotion && ALLOWED_EMOTIONS.includes(extracted.emotion)) {
      return extracted.emotion;
    }

    // Check explicit emotion in context options
    if (context.emotion && ALLOWED_EMOTIONS.includes(context.emotion)) {
      return context.emotion;
    }

    const lower = text.toLowerCase().trim();

    // 1. Excited: energetic, bright, playful delivery
    if (
      /\b(yay+|woohoo+|hooray|awesome|amazing|fantastic|super proud|proud of you|finished your task|task completed|celebrat\w*|nailed it|great job|congrat\w*|victory)\b/i.test(lower) ||
      (/\b(finished|completed|did it|done)\b/i.test(lower) && lower.includes("!"))
    ) {
      return "excited";
    }

    // 2. Sleepy or relaxed: slower, softer, relaxed delivery
    if (
      /\b(sleepy|yawn\w*|bedtime|good night|nap\b|drowsy|exhausted|rest your eyes)\b/i.test(lower) ||
      /\bmmm\.{2,}\b/i.test(lower) ||
      /\btime for a (?:little )?break\b/i.test(lower)
    ) {
      return "sleepy";
    }

    // 3. Concerned: caring, slightly concerned delivery
    if (
      /\b(sitting for a long time|haven't moved|haven't had water|are you okay|worried|don't overdo|burnout|headache|eyes hurt|take it easy|posture)\b/i.test(lower) ||
      /^oh!\s+you've been/i.test(lower)
    ) {
      return "concerned";
    }

    // 4. Gentle reminder: soft, warm, friendly delivery
    if (
      /\b(drink\s+(?:some\s+)?water|hydrate|sip\b|breathe|softly|human\.\.\.|take a sip|gentle reminder|take care of yourself|easy does it)\b/i.test(lower)
    ) {
      return "gentle";
    }

    // 5. Playful: mischievous, teasing delivery
    if (
      /\b(hehe+|he-he|tehe+|caught you|sneaky|silly human|forgetting your task|chuckle|boop|mischief|gotcha|teasing|play with me)\b/i.test(lower)
    ) {
      return "playful";
    }

    // 6. Encouraging: cheerful, motivating delivery
    if (
      /\b(come on|you can do it|let's finish this together|let's do this|together|keep going|almost there|you got this|you've got this|believe in you|step by step|don't give up|cheering for you|push through)\b/i.test(lower)
    ) {
      return "encouraging";
    }

    return "neutral";
  }

  function cleanSpokenText(value) {
    if (typeof value !== "string") return "";
    return value
      .replace(/\[\s*(?:emotion|intensity|speed|pitch|tag|style)[^\]]*\]/gi, " ")
      .replace(/\[[a-zA-Z0-9_\s:-]+\]/g, " ")
      .replace(/\b(?:emotion|intensity|speed|pitch)\s*:\s*[a-zA-Z0-9_.-]+/gi, " ")
      .replace(stageDirection, " ")
      .replace(parentheticalDirection, " ")
      .replace(/^\s{0,3}#{1,6}\s*/gm, "")
      .replace(/^\s*[-+*]\s+/gm, "")
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Regional_Indicator}\uFE0F\u200D\u20E3]/gu, "")
      .replace(/[`*_~]/g, "")
      .replace(/^[\s]*[•·▪◦]\s*/gm, "")
      .replace(/\s+([,.;!?])/g, "$1")
      .replace(/([,;:!?])(?=\S)/g, "$1 ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getDeliverySettings(text, options = {}) {
    const emotion = classifyEmotion(text, options);
    const profile = EMOTION_DELIVERY[emotion] || EMOTION_DELIVERY.neutral;

    let speed = profile.speed;
    let pitch = profile.pitch;

    if (typeof options.speed === "number" && options.speed >= 0.5 && options.speed <= 2.0) {
      speed = options.speed;
    }
    if (typeof options.pitch === "number" && options.pitch >= 0.5 && options.pitch <= 2.0) {
      pitch = options.pitch;
    }

    const intensity = ALLOWED_INTENSITIES.includes(options.intensity)
      ? options.intensity
      : profile.intensity;

    return {
      emotion,
      intensity,
      speed,
      pitch,
      fishTag: profile.fishTag,
      moodLabel: profile.moodLabel,
      animation: profile.animation
    };
  }

  function enhanceSentence(text, emotion) {
    if (typeof text !== "string") return "";
    const cleaned = cleanSpokenText(text);
    if (!cleaned) return "";

    const hasCatWord = /\b(meow|nya|purr)\b/i.test(cleaned);

    if (emotion === "playful" && !hasCatWord) {
      if (!/^(hehe|tehe|gotcha)/i.test(cleaned)) {
        return `Hehe! ${cleaned}`;
      }
    }

    return cleaned;
  }

  const speechEmotionModule = {
    ALLOWED_EMOTIONS,
    ALLOWED_INTENSITIES,
    EMOTION_DELIVERY,
    classifyEmotion,
    extractEmotionMetadata,
    cleanSpokenText,
    getDeliverySettings,
    enhanceSentence
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = speechEmotionModule;
  }
  if (typeof window !== "undefined") {
    window.speechEmotion = speechEmotionModule;
  } else if (typeof globalThis !== "undefined") {
    globalThis.speechEmotion = speechEmotionModule;
  }
})();

