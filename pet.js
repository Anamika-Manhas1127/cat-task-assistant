const cat = document.getElementById("cat");
const mood = document.getElementById("mood");
const speech = document.getElementById("speech");
const statusLine = document.getElementById("status");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const speakBtn = document.getElementById("speakBtn");
const listenBtn = document.getElementById("listenBtn");
const muteBtn = document.getElementById("muteBtn");
const reminderActions = document.getElementById("reminderActions");
let language = "en";
let muted = false;
let activeReminder = null;
let reminderQueue = [];
let speechVersion = 0;

const speechLanguages = { en: "en-US", hi: "hi-IN", kn: "kn-IN", ja: "ja-JP" };
const speechRecognitionCultures = { en: "en-IN", hi: "hi-IN", kn: "kn-IN", ja: "ja-JP" };
const actionWords = "wiggl\\w*|purr\\w*|smil\\w*|tilt\\w*(?:\\s+\\w+){0,2}|blink\\w*|wink\\w*|nod\\w*|bounce\\w*|wave\\w*|shrug\\w*|sigh\\w*|giggl\\w*|laugh\\w*|grin\\w*|stretch\\w*|yawn\\w*|flick\\w*";
const stageDirection = new RegExp(`\\*{1,2}[^*\\n]{0,140}\\b(?:${actionWords})\\b[^*\\n]*\\*{1,2}`, "giu");
const parentheticalDirection = new RegExp(`\\([^)]{0,140}\\b(?:${actionWords})\\b[^)]*\\)`, "giu");

let speechEmotionHelper = (typeof window !== "undefined" && window.speechEmotion)
  || (typeof globalThis !== "undefined" && globalThis.speechEmotion)
  || (typeof require === "function" ? (function() { try { return require("./speech-emotion"); } catch (_) { return null; } })() : null);

function getEmotionHelper() {
  if (speechEmotionHelper) return speechEmotionHelper;
  if (typeof window !== "undefined" && window.speechEmotion) {
    speechEmotionHelper = window.speechEmotion;
    return speechEmotionHelper;
  }
  return null;
}

function speechTextFromDisplay(value) {
  if (typeof value !== "string") return "";
  const helper = getEmotionHelper();
  if (helper && typeof helper.cleanSpokenText === "function") {
    return helper.cleanSpokenText(value);
  }
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

function setMood(label, state = "") {
  mood.textContent = label;
  cat.classList.remove("thinking", "speaking");
  if (state) cat.classList.add(state);
}

function animateCat(moodName) {
  const animationClass = moodName === "excited" ? "excited" : "greeting";
  cat.classList.remove("greeting", "excited");
  void cat.offsetWidth;
  cat.classList.add(animationClass);
  cat.addEventListener("animationend", () => cat.classList.remove(animationClass), { once: true });
}

let activeAudio = null;
let activeAudioUrl = null;
let activeStreamPlayer = null;
let activeStreamId = null;

class PcmStreamPlayer {
  constructor({ sampleRate = 44100, onStart, onEnd, onError, minBufferSec = 0.30 } = {}) {
    this.sampleRate = sampleRate;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.onError = onError;
    this.minBufferBytes = Math.floor(sampleRate * 2 * minBufferSec);
    this.ctx = null;
    this.nextStartTime = 0;
    this.hasStarted = false;
    this.closed = false;
    this.endTimer = null;
    this.chunksFallback = [];
    this.pendingByte = null;
    this.queue = [];
    this.queueBytes = 0;
    this.playbackStarted = false;
  }

  feedChunk(chunkBytes, sampleRate) {
    if (this.closed || !chunkBytes || chunkBytes.length === 0) return;
    if (sampleRate && typeof sampleRate === "number" && sampleRate > 8000) {
      this.sampleRate = sampleRate;
      this.minBufferBytes = Math.floor(this.sampleRate * 2 * 0.30);
    }

    const AudioCtx = (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext))
      || (typeof globalThis !== "undefined" && (globalThis.AudioContext || globalThis.webkitAudioContext));

    if (!AudioCtx) {
      this.chunksFallback.push(chunkBytes);
      return;
    }

    try {
      let uint8 = chunkBytes instanceof Uint8Array ? chunkBytes : new Uint8Array(chunkBytes);
      if (this.pendingByte !== null) {
        const combined = new Uint8Array(uint8.byteLength + 1);
        combined[0] = this.pendingByte;
        combined.set(uint8, 1);
        uint8 = combined;
        this.pendingByte = null;
      }

      if (uint8.byteLength % 2 !== 0) {
        this.pendingByte = uint8[uint8.byteLength - 1];
        uint8 = uint8.subarray(0, uint8.byteLength - 1);
      }
      if (uint8.byteLength === 0) return;

      this.queue.push(uint8);
      this.queueBytes += uint8.byteLength;

      // Start once jitter buffer threshold is met (~0.3s of audio)
      if (!this.playbackStarted) {
        if (this.queueBytes >= this.minBufferBytes) {
          this.flushQueue();
        }
      } else {
        // While playing, batch chunks in smooth ~0.15s slices (13230 bytes)
        if (this.queueBytes >= 13230) {
          this.flushQueue();
        }
      }
    } catch (err) {
      if (typeof this.onError === "function") this.onError(err);
    }
  }

  flushQueue() {
    if (this.queue.length === 0) return;
    const AudioCtx = (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext))
      || (typeof globalThis !== "undefined" && (globalThis.AudioContext || globalThis.webkitAudioContext));
    if (!AudioCtx) return;

    try {
      if (!this.ctx) {
        this.ctx = new AudioCtx();
        if (this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
      }

      const merged = new Uint8Array(this.queueBytes);
      let offset = 0;
      for (const item of this.queue) {
        merged.set(item, offset);
        offset += item.byteLength;
      }
      this.queue = [];
      this.queueBytes = 0;

      const samplesCount = Math.floor(merged.byteLength / 2);
      if (samplesCount === 0) return;

      const int16 = new Int16Array(merged.buffer, merged.byteOffset, samplesCount);
      const float32 = new Float32Array(samplesCount);
      for (let i = 0; i < samplesCount; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuf = this.ctx.createBuffer(1, float32.length, this.sampleRate);
      audioBuf.copyToChannel(float32, 0);

      const source = this.ctx.createBufferSource();
      source.buffer = audioBuf;
      source.connect(this.ctx.destination);

      if (!this.playbackStarted) {
        this.playbackStarted = true;
        this.nextStartTime = this.ctx.currentTime + 0.05;
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuf.duration;
        if (!this.hasStarted) {
          this.hasStarted = true;
          if (typeof this.onStart === "function") this.onStart();
        }
      } else {
        const startTime = Math.max(this.ctx.currentTime + 0.01, this.nextStartTime);
        source.start(startTime);
        this.nextStartTime = startTime + audioBuf.duration;
      }
    } catch (err) {
      if (typeof this.onError === "function") this.onError(err);
    }
  }

  end() {
    if (this.closed) return;
    if (this.queueBytes > 0) {
      this.flushQueue();
    }
    if (!this.ctx) {
      if (this.chunksFallback.length > 0 && typeof Blob !== "undefined") {
        try {
          const blob = new Blob(this.chunksFallback, { type: "audio/wav" });
          if (typeof URL !== "undefined" && typeof Audio !== "undefined") {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            activeAudio = audio;
            activeAudioUrl = url;
            audio.onplay = () => { if (typeof this.onStart === "function") this.onStart(); };
            audio.onended = () => { if (typeof this.onEnd === "function") this.onEnd(); };
            audio.onerror = (e) => { if (typeof this.onError === "function") this.onError(e); };
            audio.play().catch(e => { if (typeof this.onError === "function") this.onError(e); });
            return;
          }
        } catch (_) {}
      }
      if (typeof this.onEnd === "function") this.onEnd();
      return;
    }

    const remainingSec = Math.max(0, this.nextStartTime - this.ctx.currentTime);
    clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => {
      if (!this.closed && typeof this.onEnd === "function") {
        this.onEnd();
      }
      this.close();
    }, Math.ceil(remainingSec * 1000) + 60);
  }

  close() {
    this.closed = true;
    clearTimeout(this.endTimer);
    this.endTimer = null;
    this.chunksFallback = [];
    this.queue = [];
    this.queueBytes = 0;
    this.pendingByte = null;
    if (this.ctx) {
      try { this.ctx.close(); } catch (_) {}
      this.ctx = null;
    }
  }
}

function stopActiveSpeech() {
  if (activeStreamPlayer) {
    try { activeStreamPlayer.close(); } catch (_) {}
    activeStreamPlayer = null;
  }
  if (activeStreamId && window.catDesktop && typeof window.catDesktop.cancelSpeechStream === "function") {
    try { window.catDesktop.cancelSpeechStream(activeStreamId).catch(() => {}); } catch (_) {}
    activeStreamId = null;
  }
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.src = "";
    } catch (_) {}
    activeAudio = null;
  }
  if (activeAudioUrl) {
    try { URL.revokeObjectURL(activeAudioUrl); } catch (_) {}
    activeAudioUrl = null;
  }
  if ("speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }
  cat.classList.remove("speaking");
}

function getSpeechEventLabel(meta = {}) {
  if (meta.isReminder) {
    return meta.kind === "chat" ? "chat reminder" : "task reminder";
  }
  if (meta.kind === "hello") return "say hello";
  return "chat";
}

function speakWithSpeechSynthesis(spokenText, selectedLanguage, delivery, version, meta = {}, reason = "") {
  const eventLabel = getSpeechEventLabel(meta);
  const reasonText = reason ? ` (reason: ${reason})` : "";
  console.info(`[Voice] [Diagnostics] fallback → browser speech synthesis (event: ${eventLabel}, language: ${selectedLanguage || "en"}${reasonText})`);
  if (!("speechSynthesis" in window)) {
    statusLine.textContent = "Text-to-speech is not supported in this environment.";
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = speechLanguages[selectedLanguage] || speechLanguages.en;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(item => item.lang.toLowerCase().startsWith(utterance.lang.slice(0, 2)));
  if (voice) utterance.voice = voice;
  utterance.rate = delivery?.speed || 0.94;
  utterance.pitch = delivery?.pitch || 1.25;
  utterance.onstart = () => {
    if (version === speechVersion) setMood(delivery?.moodLabel || "Speaking to you…", "speaking");
  };
  utterance.onend = () => {
    if (version === speechVersion) setMood(activeReminder ? "Reminder ready" : "Here for you ✨");
  };
  utterance.onerror = event => {
    if (version !== speechVersion || event.error === "canceled") return;
    setMood("Still here with you ✨");
    statusLine.textContent = "Speech could not start. The message is still shown above.";
  };
  window.speechSynthesis.speak(utterance);
  return true;
}

function playAudioPayload(res, delivery, version) {
  return new Promise((resolve, reject) => {
    try {
      const mimeType = res.mimeType || "audio/mpeg";
      let blob;
      if (res.audioBuffer) {
        const uint8 = res.audioBuffer instanceof Uint8Array
          ? res.audioBuffer
          : (res.audioBuffer.data ? new Uint8Array(res.audioBuffer.data) : new Uint8Array(res.audioBuffer));
        blob = new Blob([uint8], { type: mimeType });
      } else if (typeof res.audioData === "string") {
        const binaryStr = atob(res.audioData);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        blob = new Blob([bytes], { type: mimeType });
      } else {
        return reject(new Error("No audio payload"));
      }

      if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function" || typeof Audio === "undefined") {
        return reject(new Error("Audio playback not supported in this window"));
      }

      const url = URL.createObjectURL(blob);
      activeAudioUrl = url;
      const audio = new Audio(url);
      activeAudio = audio;

      audio.onplay = () => {
        if (version === speechVersion) {
          console.info("[Voice] Fish Audio: audio playback started");
          setMood(delivery?.moodLabel || "Speaking to you…", "speaking");
        }
      };
      audio.onended = () => {
        if (version === speechVersion) {
          setMood(activeReminder ? "Reminder ready" : "Here for you ✨");
        }
        stopActiveSpeech();
        resolve();
      };
      audio.onerror = (err) => {
        stopActiveSpeech();
        reject(err);
      };

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(err => {
          stopActiveSpeech();
          reject(err);
        });
      }
    } catch (err) {
      stopActiveSpeech();
      reject(err);
    }
  });
}

let voiceConfig = {
  provider: "fish-audio",
  enabled: typeof window !== "undefined" && Boolean(window.catDesktop)
};

function speak(text, selectedLanguage = language, meta = {}) {
  if (muted) return false;
  const spokenText = speechTextFromDisplay(text);
  if (!spokenText) return false;

  speechVersion += 1;
  const version = speechVersion;
  stopActiveSpeech();

  const triggerTime = meta.displayTime || Date.now();
  console.info(`[Voice] [Timing] Speech pipeline started for "${spokenText.slice(0, 30)}..." at +${Date.now() - triggerTime}ms`);

  const helper = getEmotionHelper();
  const delivery = helper ? helper.getDeliverySettings(text) : {
    emotion: "neutral",
    pitch: 1.25,
    speed: 0.94,
    moodLabel: "Speaking to you…",
    animation: "greeting"
  };

  const eventLabel = getSpeechEventLabel(meta);

  // Check if streaming synthesis is available (preferred for sub-second TTFA)
  if (voiceConfig.enabled !== false && window.catDesktop && typeof window.catDesktop.synthesizeSpeechStream === "function") {
    console.info(`[Voice] [Diagnostics] ${eventLabel} → Fish Audio (streamed PCM chunks, emotion: ${delivery.emotion}, speed: ${delivery.speed})`);
    activeStreamId = version;
    const player = new PcmStreamPlayer({
      sampleRate: 44100,
      onStart: () => {
        if (version === speechVersion) {
          const elapsed = Date.now() - triggerTime;
          console.info(`[Voice] [Timing] Audio playback started at +${elapsed}ms from speech trigger`);
          setMood(delivery?.moodLabel || "Speaking to you…", "speaking");
        }
      },
      onEnd: () => {
        if (version === speechVersion) {
          setMood(activeReminder ? "Reminder ready" : "Here for you ✨");
        }
        stopActiveSpeech();
      },
      onError: (err) => {
        console.warn(`[Voice] Streaming playback error: ${err?.message || "playback error"}`);
        if (version === speechVersion) {
          console.info(`[Voice] Fallback TTS: used because streaming playback failed (${eventLabel})`);
          speakWithSpeechSynthesis(spokenText, selectedLanguage, delivery, version, meta, err?.message || "playback error");
        }
      }
    });
    activeStreamPlayer = player;

    window.catDesktop.synthesizeSpeechStream({
      text: spokenText,
      emotion: delivery.emotion,
      speed: delivery.speed,
      pitch: delivery.pitch,
      language: selectedLanguage,
      streamId: version,
      format: "wav"
    }).then(res => {
      if (version !== speechVersion) return;
      if (!res || !res.ok) {
        console.warn(`[Voice] Fish Audio: request failed — ${res?.error || "unknown"}`);
        console.info(`[Voice] Fallback TTS: used because Fish Audio failed (${eventLabel})`);
        if (res?.fallback) voiceConfig.enabled = false;
        stopActiveSpeech();
        speakWithSpeechSynthesis(spokenText, selectedLanguage, delivery, version, meta, res?.error || "Fish Audio request failed");
      }
    }).catch(err => {
      if (version === speechVersion) {
        console.warn(`[Voice] Fish Audio: request failed — ${err?.message || "network error"}`);
        console.info(`[Voice] Fallback TTS: used because Fish Audio request failed (${eventLabel})`);
        stopActiveSpeech();
        speakWithSpeechSynthesis(spokenText, selectedLanguage, delivery, version, meta, err?.message || "network error");
      }
    });
    return true;
  }

  // Backwards-compatible non-streaming path
  if (voiceConfig.enabled !== false && window.catDesktop && typeof window.catDesktop.synthesizeSpeech === "function") {
    console.info(`[Voice] [Diagnostics] ${eventLabel} → Fish Audio (complete audio buffer, emotion: ${delivery.emotion})`);
    window.catDesktop.synthesizeSpeech({
      text: spokenText,
      emotion: delivery.emotion,
      speed: delivery.speed,
      pitch: delivery.pitch,
      language: selectedLanguage
    }).then(res => {
      if (version !== speechVersion) return;
      if (res && res.ok && (res.audioBuffer || res.audioData)) {
        console.info("[Voice] Fish Audio: synthesis successful");
        playAudioPayload(res, delivery, version).catch(err => {
          console.warn(`[Voice] Fish Audio: playback failed — ${err?.message || "error"}`);
          if (version === speechVersion) {
            console.info(`[Voice] Fallback TTS: used because Fish Audio playback failed (${eventLabel})`);
            speakWithSpeechSynthesis(spokenText, selectedLanguage, delivery, version, meta, err?.message || "playback failed");
          }
        });
      } else {
        console.warn(`[Voice] Fish Audio: request failed — ${res?.error || "unknown"}`);
        console.info(`[Voice] Fallback TTS: used because Fish Audio failed (${eventLabel})`);
        if (res?.fallback) voiceConfig.enabled = false;
        speakWithSpeechSynthesis(spokenText, selectedLanguage, delivery, version, meta, res?.error || "Fish Audio failed");
      }
    }).catch(err => {
      console.warn(`[Voice] Fish Audio: request failed — ${err?.message || "network error"}`);
      if (version === speechVersion) {
        console.info(`[Voice] Fallback TTS: used because Fish Audio request failed (${eventLabel})`);
        speakWithSpeechSynthesis(spokenText, selectedLanguage, delivery, version, meta, err?.message || "network error");
      }
    });
    return true;
  }

  console.info(`[Voice] Fallback TTS: used because Fish Audio is disabled/unconfigured (${eventLabel})`);
  return speakWithSpeechSynthesis(spokenText, selectedLanguage, delivery, version, meta, "Fish Audio disabled/unconfigured");
}

speakBtn.addEventListener("click", () => {
  const greetings = {
    en: "Meow! Hi, I'm Mochi. Let's make today brighter!",
    hi: "म्याऊँ! नमस्ते, मैं मोची हूँ!",
    kn: "ಮಿಯಾಂವ್! ನಮಸ್ಕಾರ, ನಾನು ಮೋಚಿ!",
    ja: "にゃー！こんにちは、モチだよ！"
  };
  const hello = greetings[language] || greetings.en;
  speech.textContent = hello;
  animateCat("greeting");
  speak(hello, language, { kind: "hello" });
});

muteBtn.addEventListener("click", () => {
  muted = !muted;
  muteBtn.textContent = muted ? "🔊 Unmute" : "🔇 Mute";
  muteBtn.setAttribute("aria-pressed", String(muted));
  if (muted) {
    speechVersion += 1;
    stopActiveSpeech();
    setMood("Quiet mode");
    statusLine.textContent = "Speech muted. Reminder text and actions are still available.";
  } else {
    statusLine.textContent = "Speech is on.";
    if (activeReminder) speak(activeReminder.message, activeReminder.language, { isReminder: true, kind: activeReminder.kind });
  }
});

function activateNextReminder() {
  if (activeReminder || !reminderQueue.length) return;
  activeReminder = reminderQueue.shift();
  speech.textContent = activeReminder.message;
  animateCat("greeting");
  reminderActions.hidden = false;
  setMood("A little reminder for you ✨");
  statusLine.textContent = `Due now: ${activeReminder.title}`;
  const now = Date.now();
  console.info(`[Voice] [Timing] Reminder displayed: "${activeReminder.title}" at t=0ms`);
  speak(activeReminder.message, activeReminder.language, { isReminder: true, kind: activeReminder.kind, displayTime: now });
}

function receiveReminder(reminder) {
  const reminderId = reminder?.taskId || reminder?.id;
  if (!reminder || typeof reminderId !== "string" || typeof reminder.message !== "string") return;
  const title = typeof reminder.title === "string" ? reminder.title : "Reminder";
  if (title.length > 180 || reminder.message.length > 350) return;
  if (activeReminder?.taskId === reminderId || reminderQueue.some(item => item.taskId === reminderId)) return;
  const nextReminder = {
    taskId: reminderId,
    kind: reminder.kind === "chat" ? "chat" : "task",
    title: title,
    message: reminder.message,
    language: speechLanguages[reminder.language] ? reminder.language : "en"
  };
  if (activeReminder) reminderQueue.unshift(activeReminder);
  activeReminder = nextReminder;
  speech.textContent = activeReminder.message;
  animateCat("greeting");
  reminderActions.hidden = false;
  setMood("A little reminder for you ✨");
  statusLine.textContent = `Due now: ${activeReminder.title}`;
  const now = Date.now();
  console.info(`[Voice] [Timing] Reminder displayed: "${activeReminder.title}" at t=0ms`);
  speak(activeReminder.message, activeReminder.language, { isReminder: true, kind: activeReminder.kind, displayTime: now });
}

async function applyReminderAction(action) {
  if (!activeReminder) return;
  stopActiveSpeech();
  const buttons = reminderActions.querySelectorAll("button");
  buttons.forEach(button => { button.disabled = true; });
  try {
    const result = await window.catDesktop.reminderAction(activeReminder.taskId, action);
    if (!result || !result.ok) {
      statusLine.textContent = "That task could not be updated. Open the dashboard and try again.";
      buttons.forEach(button => { button.disabled = false; });
      return;
    }
    const reminderKind = activeReminder.kind;
    buttons.forEach(button => { button.disabled = false; });
    activeReminder = null;
    reminderActions.hidden = true;
    statusLine.textContent = action === "done"
      ? reminderKind === "chat" ? "Reminder marked done." : "Marked done in your task list."
      : action === "snooze" ? "I'll remind you again in 10 minutes." : "I'll remind you again in one hour.";
    activateNextReminder();
  } catch (_) {
    statusLine.textContent = "Could not reach the dashboard. Your task was not changed.";
    buttons.forEach(button => { button.disabled = false; });
  }
}

document.getElementById("doneReminderBtn").addEventListener("click", () => applyReminderAction("done"));
document.getElementById("snoozeReminderBtn").addEventListener("click", () => applyReminderAction("snooze"));
document.getElementById("laterReminderBtn").addEventListener("click", () => applyReminderAction("later"));

document.getElementById("dashboardBtn").addEventListener("click", () => window.catDesktop.openDashboard());
document.getElementById("closeBtn").addEventListener("click", () => window.catDesktop.closeFloating());

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  stopActiveSpeech();
  speech.textContent = "Thinking about that…";
  statusLine.textContent = "Contacting the configured Gemma 4 model…";
  setMood("Thinking…", "thinking");
  try {
    const result = await window.catDesktop.askGemma(message);
    if (result.ok) {
      speech.textContent = result.text;
      statusLine.textContent = result.warning || "Mochi replied.";
      animateCat(/\b(?:nya|yay|woohoo|absolutely|awesome|fantastic|exciting)\b/i.test(result.text) ? "excited" : "greeting");
      speak(result.text, language, { kind: "chat" });
    } else {
      speech.textContent = result.error;
      statusLine.textContent = "AI needs attention. See the message above.";
      setMood("Let's fix this together ✨");
    }
  } catch (error) {
    console.error(`[Mochi] Gemma IPC request rejected (${error?.name || "Error"}).`);
    speech.textContent = "I couldn't reach the AI service. Please check the setup and try again.";
    statusLine.textContent = "The chat request failed. Check the AI setup or try again.";
    setMood("Ready when you are");
  }
});

let recordingStream = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingState = "idle";

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
    "audio/wav"
  ];
  return types.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function stopStreamTracks(stream) {
  if (!stream) return;
  try {
    const tracks = typeof stream.getTracks === "function" ? stream.getTracks() : [];
    tracks.forEach(track => {
      try { track.stop(); } catch (_) {}
    });
  } catch (_) {}
}

function cleanupRecordingState() {
  clearTimeout(recordingTimer);
  recordingTimer = null;
  if (recordingStream) {
    stopStreamTracks(recordingStream);
    recordingStream = null;
  }
  mediaRecorder = null;
  audioChunks = [];
  recordingState = "idle";
  listenBtn.disabled = false;
  listenBtn.textContent = "🎙️ Listen";
  listenBtn.classList.remove("recording");
}

async function stopRecordingAndTranscribe() {
  if (recordingState !== "recording" || !mediaRecorder) {
    cleanupRecordingState();
    return;
  }
  recordingState = "transcribing";
  listenBtn.disabled = true;
  statusLine.textContent = "Transcribing with Sarvam AI…";
  setMood("Transcribing…", "thinking");
  try {
    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  } catch (err) {
    console.error("[Mochi] Error stopping recorder:", err?.name || "Error");
    cleanupRecordingState();
    statusLine.textContent = "Failed to stop recording. Please try again.";
    setMood("Ready for your message");
    input.focus();
  }
}

async function startRecording() {
  speechVersion += 1;
  stopActiveSpeech();

  if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    statusLine.textContent = "Audio recording is not supported in this environment.";
    setMood("Ready for your message");
    input.focus();
    return;
  }

  const mimeType = getSupportedAudioMimeType();
  recordingState = "requesting";
  listenBtn.disabled = true;
  statusLine.textContent = "Requesting microphone access…";
  setMood("Opening microphone…");

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (err) {
    cleanupRecordingState();
    setMood("Ready for your message");
    if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
      statusLine.textContent = "Microphone access was denied. Allow microphone access in Windows Settings.";
    } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
      statusLine.textContent = "No microphone was found. Please connect a microphone and try again.";
    } else {
      statusLine.textContent = `Microphone could not start (${err?.message || "access error"}).`;
    }
    input.focus();
    return;
  }

  recordingStream = stream;
  audioChunks = [];

  try {
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (err) {
    cleanupRecordingState();
    statusLine.textContent = "Could not initialize audio recorder for this audio format.";
    setMood("Ready for your message");
    input.focus();
    return;
  }

  const actualMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";

  mediaRecorder.ondataavailable = (event) => {
    if (event?.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onerror = (event) => {
    console.error("[Mochi] MediaRecorder error:", event?.error?.name || "Error");
    cleanupRecordingState();
    statusLine.textContent = "An error occurred while recording audio. Try again.";
    setMood("Ready for your message");
    input.focus();
  };

  mediaRecorder.onstop = async () => {
    const currentStream = recordingStream;
    const capturedChunks = audioChunks;
    recordingStream = null;
    mediaRecorder = null;
    audioChunks = [];
    stopStreamTracks(currentStream);

    if (!capturedChunks.length) {
      cleanupRecordingState();
      statusLine.textContent = "No audio was captured. Please try speaking again.";
      setMood("Ready for your message");
      input.focus();
      return;
    }

    let audioBlob;
    try {
      audioBlob = new Blob(capturedChunks, { type: actualMimeType });
    } catch (_) {
      audioBlob = null;
    }

    if (!audioBlob || audioBlob.size < 100) {
      cleanupRecordingState();
      statusLine.textContent = "The recording was empty. Speak closer to the microphone and try again.";
      setMood("Ready for your message");
      input.focus();
      return;
    }

    try {
      const buffer = await audioBlob.arrayBuffer();
      const result = typeof window?.catDesktop?.transcribeAudio === "function"
        ? await window.catDesktop.transcribeAudio({ audioBuffer: buffer, mimeType: actualMimeType, language })
        : { ok: false, error: "Audio transcription is not available." };

      if (result?.ok && typeof result.text === "string" && result.text.trim()) {
        input.value = result.text.trim();
        statusLine.textContent = "Transcribed with Sarvam AI! Review your message and press Send.";
        setMood("Ready for your message");
      } else {
        statusLine.textContent = result?.error || "Sarvam AI could not transcribe that. Try again.";
        setMood("Ready for your message");
      }
    } catch (err) {
      console.error("[Mochi] Transcription failed:", err?.name || "Error");
      statusLine.textContent = "Transcription request failed. Check the setup and try again.";
      setMood("Ready for your message");
    } finally {
      cleanupRecordingState();
      input.focus();
    }
  };

  try {
    mediaRecorder.start(250);
  } catch (err) {
    cleanupRecordingState();
    statusLine.textContent = "Could not start audio recording. Try again.";
    setMood("Ready for your message");
    input.focus();
    return;
  }

  recordingState = "recording";
  listenBtn.disabled = false;
  listenBtn.textContent = "⏹️ Stop";
  listenBtn.classList.add("recording");
  statusLine.textContent = "Listening… Click Stop when finished speaking.";
  setMood("I'm listening 🎙️");

  recordingTimer = setTimeout(() => {
    if (recordingState === "recording") {
      stopRecordingAndTranscribe();
    }
  }, 25_000);
}

listenBtn.addEventListener("click", async () => {
  if (listenBtn.disabled) return;
  if (recordingState === "recording") {
    await stopRecordingAndTranscribe();
  } else if (recordingState === "idle") {
    await startRecording();
  }
});

if (typeof window.addEventListener === "function") {
  window.addEventListener("beforeunload", () => {
    if (recordingStream) stopStreamTracks(recordingStream);
  });
}

if (window.catDesktop && typeof window.catDesktop.onVoiceConfig === "function") {
  window.catDesktop.onVoiceConfig(config => {
    if (config && typeof config === "object" && typeof config.enabled === "boolean") voiceConfig = config;
  });
}
if (window.catDesktop && typeof window.catDesktop.getVoiceConfig === "function") {
  window.catDesktop.getVoiceConfig().then(config => {
    if (config && typeof config === "object" && typeof config.enabled === "boolean") voiceConfig = config;
  }).catch(() => {});
}
if (window.catDesktop && typeof window.catDesktop.onSpeechChunk === "function") {
  window.catDesktop.onSpeechChunk(data => {
    if (!data || data.streamId !== speechVersion) return;
    if (data.isError) {
      console.warn(`[Voice] Fish Audio stream chunk error: ${data.error || "error"}`);
      if (activeStreamPlayer) {
        const spoken = activeReminder?.message || speech.textContent;
        const spokenLang = activeReminder?.language || language;
        const metaInfo = activeReminder ? { isReminder: true, kind: activeReminder.kind } : {};
        stopActiveSpeech();
        speakWithSpeechSynthesis(spoken, spokenLang, null, speechVersion, metaInfo, data.error || "stream error");
      }
      return;
    }
    if (data.chunk && activeStreamPlayer) {
      activeStreamPlayer.feedChunk(data.chunk, data.sampleRate);
    }
    if (data.isDone && activeStreamPlayer) {
      activeStreamPlayer.end();
    }
  });
}
if (window.catDesktop && typeof window.catDesktop.onLanguage === "function") {
  window.catDesktop.onLanguage(value => {
    if (speechLanguages[value]) language = value;
  });
}
if (window.catDesktop && typeof window.catDesktop.getLanguage === "function") {
  window.catDesktop.getLanguage().then(value => {
    if (speechLanguages[value]) language = value;
  }).catch(() => {});
}
if (window.catDesktop && typeof window.catDesktop.onReminder === "function") window.catDesktop.onReminder(receiveReminder);

speech.textContent = "Meow! I'm Mochi. Click Say hello, or ask me something below.";
statusLine.textContent = "Ready. Typed chat always works; speech can be muted.";
