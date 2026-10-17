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

const speechLanguages = { en:"en-US", hi:"hi-IN", kn:"kn-IN", ja:"ja-JP" };
const speechRecognitionCultures = { en:"en-IN", hi:"hi-IN", kn:"kn-IN", ja:"ja-JP" };
const actionWords = "wiggl\\w*|purr\\w*|smil\\w*|tilt\\w*(?:\\s+\\w+){0,2}|blink\\w*|wink\\w*|nod\\w*|bounce\\w*|wave\\w*|shrug\\w*|sigh\\w*|giggl\\w*|laugh\\w*|grin\\w*|stretch\\w*|yawn\\w*|flick\\w*";
const stageDirection = new RegExp(`\\*{1,2}[^*\\n]{0,140}\\b(?:${actionWords})\\b[^*\\n]*\\*{1,2}`, "giu");
const parentheticalDirection = new RegExp(`\\([^)]{0,140}\\b(?:${actionWords})\\b[^)]*\\)`, "giu");

function speechTextFromDisplay(value) {
  if (typeof value !== "string") return "";
  return value
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

function speak(text, selectedLanguage = language) {
  if (!("speechSynthesis" in window)) {
    statusLine.textContent = "Text-to-speech is not supported in this environment.";
    return false;
  }
  if (muted) return false;
  const spokenText = speechTextFromDisplay(text);
  if (!spokenText) return false;
  speechVersion += 1;
  const version = speechVersion;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = speechLanguages[selectedLanguage] || speechLanguages.en;
  const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith(utterance.lang.slice(0,2)));
  if (voice) utterance.voice = voice;
  utterance.rate = 0.94;
  utterance.pitch = 1.25;
  utterance.onstart = () => { if (version === speechVersion) setMood("Speaking to you…", "speaking"); };
  utterance.onend = () => { if (version === speechVersion) setMood(activeReminder ? "Reminder ready" : "Here for you ✨"); };
  utterance.onerror = event => {
    if (version !== speechVersion || event.error === "canceled") return;
    setMood("Still here with you ✨");
    statusLine.textContent = "Speech could not start. The message is still shown above.";
  };
  window.speechSynthesis.speak(utterance);
  return true;
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
  speak(hello, language);
});

muteBtn.addEventListener("click", () => {
  muted = !muted;
  muteBtn.textContent = muted ? "🔊 Unmute" : "🔇 Mute";
  muteBtn.setAttribute("aria-pressed", String(muted));
  if (muted) {
    speechVersion += 1;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setMood("Quiet mode");
    statusLine.textContent = "Speech muted. Reminder text and actions are still available.";
  } else {
    statusLine.textContent = "Speech is on.";
    if (activeReminder) speak(activeReminder.message, activeReminder.language);
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
  speak(activeReminder.message, activeReminder.language);
}

function receiveReminder(reminder) {
  if (!reminder || typeof reminder.taskId !== "string" || typeof reminder.title !== "string" || typeof reminder.message !== "string") return;
  if (reminder.title.length > 180 || reminder.message.length > 350) return;
  if (activeReminder?.taskId === reminder.taskId || reminderQueue.some(item => item.taskId === reminder.taskId)) return;
  const nextReminder = {
    taskId: reminder.taskId,
    kind: reminder.kind === "chat" ? "chat" : "task",
    title: reminder.title,
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
  speak(activeReminder.message, activeReminder.language);
}

async function applyReminderAction(action) {
  if (!activeReminder) return;
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
  speech.textContent = "Thinking about that…";
  statusLine.textContent = "Contacting the configured Gemma 4 model…";
  setMood("Thinking…", "thinking");
  try {
    const result = await window.catDesktop.askGemma(message);
    if (result.ok) {
      speech.textContent = result.text;
      statusLine.textContent = result.warning || "Mochi replied.";
      animateCat(/\b(?:nya|yay|woohoo|absolutely|awesome|fantastic|exciting)\b/i.test(result.text) ? "excited" : "greeting");
      speak(result.text);
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

listenBtn.addEventListener("click", async () => {
  if (listenBtn.disabled) return;
  listenBtn.disabled = true;
  statusLine.textContent = "Listening… Speak to Mochi now.";
  setMood("I'm listening 🎙️");

  try {
    const result = await window.catDesktop.recognizeSpeech(language);
    if (result?.ok && typeof result.text === "string" && result.text.trim()) {
      input.value = result.text.trim();
      input.focus();
      const notices = [];
      if (result.lowConfidence) notices.push("That sounded uncertain; please review it or try again.");
      const preferredCulture = speechRecognitionCultures[language];
      if (result.cultureName && result.cultureName !== preferredCulture) {
        notices.push(`Windows used ${result.cultureName}; ${preferredCulture} is not installed.`);
      }
      statusLine.textContent = notices.length
        ? `${notices.join(" ")} Your transcript is ready to review.`
        : "I heard you! Review your message and press Send.";
      setMood("Ready for your message");
    } else {
      statusLine.textContent = result?.error || "Windows speech recognition could not transcribe that. Try again.";
      setMood("Ready for your message");
    }
  } catch (error) {
    console.error(`[Mochi] Windows speech IPC failed (${error?.name || "Error"}).`);
    statusLine.textContent = "Windows speech recognition could not start. Check the microphone and try again.";
    setMood("Ready for your message");
  } finally {
    listenBtn.disabled = false;
  }
});
if (window.catDesktop && typeof window.catDesktop.onReminder === "function") window.catDesktop.onReminder(receiveReminder);
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

speech.textContent = "Meow! I'm Mochi. Click Say hello, or ask me something below.";
statusLine.textContent = "Ready. Typed chat always works; speech can be muted.";
