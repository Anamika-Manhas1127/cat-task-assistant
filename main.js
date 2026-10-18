const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain, Notification, session, shell } = require("electron");
const { randomUUID } = require("crypto");
const { execFile } = require("child_process");
const { dueReminders, reminderMessage, sanitizeTasks, validReminderAction } = require("./reminder-core");
const { ChatReminderStore } = require("./chat-reminder-store");
const { ReminderDelivery } = require("./reminder-delivery");
const {
  buildGemmaRequest,
  buildGemmaHttpRequest,
  containsPromptLeak,
  gemmaEmptyResponseMessage,
  gemmaErrorMessage,
  inspectGemmaResponse,
  parseChatReminder,
  redactSensitiveText,
  replyWithReminderState,
  reminderOnlyReply
} = require("./chat-core");
const { transcribeWithSarvam } = require("./sarvam-core");
const { synthesizeWithFishAudio, streamFishAudio } = require("./fish-speech-core");

function getCandidateEnvPaths() {
  const candidates = [];
  try {
    if (app && typeof app.getPath === "function") {
      candidates.push(path.join(app.getPath("userData"), ".env"));
    }
  } catch (_) {}
  try {
    if (process.execPath) {
      candidates.push(path.join(path.dirname(process.execPath), ".env"));
    }
  } catch (_) {}
  candidates.push(path.join(__dirname, ".env"));
  candidates.push(path.join(process.cwd(), ".env"));
  return [...new Set(candidates)];
}

let activeEnvFilePath = null;

function loadFreshEnv() {
  const candidatePaths = getCandidateEnvPaths();
  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const freshEnv = require("dotenv").parse(fs.readFileSync(envPath));
        if (freshEnv.GEMMA_API_KEY) process.env.GEMMA_API_KEY = freshEnv.GEMMA_API_KEY;
        if (freshEnv.GEMMA_MODEL_ID) process.env.GEMMA_MODEL_ID = freshEnv.GEMMA_MODEL_ID;
        if (freshEnv.SARVAM_API_KEY) process.env.SARVAM_API_KEY = freshEnv.SARVAM_API_KEY;
        if (freshEnv.FISH_AUDIO_API_KEY) process.env.FISH_AUDIO_API_KEY = freshEnv.FISH_AUDIO_API_KEY;
        if (freshEnv.FISH_AUDIO_VOICE_ID) process.env.FISH_AUDIO_VOICE_ID = freshEnv.FISH_AUDIO_VOICE_ID;
        if (freshEnv.FISH_AUDIO_MODEL) process.env.FISH_AUDIO_MODEL = freshEnv.FISH_AUDIO_MODEL;
        activeEnvFilePath = envPath;
        return envPath;
      } catch (_) {}
    }
  }
  return null;
}

activeEnvFilePath = loadFreshEnv();
const dotenvResult = activeEnvFilePath ? { parsed: true } : { error: new Error("No .env file found") };

function getAppIcon() {
  const iconIco = path.join(__dirname, "build", "icon.ico");
  if (fs.existsSync(iconIco)) return iconIco;
  const iconPng = path.join(__dirname, "build", "icon.png");
  if (fs.existsSync(iconPng)) return iconPng;
  return undefined;
}

function getWindowsSpeechScriptPath() {
  const defaultPath = path.join(__dirname, "windows-speech.ps1");
  if (app && app.isPackaged) {
    const unpackedPath = defaultPath.replace("app.asar", "app.asar.unpacked");
    if (fs.existsSync(unpackedPath)) return unpackedPath;
    const resourcePath = path.join(process.resourcesPath, "windows-speech.ps1");
    if (fs.existsSync(resourcePath)) return resourcePath;
    const unpackedResource = path.join(process.resourcesPath, "app.asar.unpacked", "windows-speech.ps1");
    if (fs.existsSync(unpackedResource)) return unpackedResource;
  }
  return defaultPath;
}

let dashboardWindow;
let catWindow;
let reminderTasks = [];
let reminderLanguage = "en";
let firedReminderKeys = new Set();
let pendingCatActions = [];
let pendingChatReminderHistory = [];
let chatReminderStore;
let reminderDelivery;
let catRendererReady = false;
let speechProcess = null;
const activeNotifications = new Set();
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const speechCultures = { en: "en-IN", hi: "hi-IN", kn: "kn-IN", ja: "ja-JP" };

if (!hasSingleInstanceLock) app.quit();
else {
  app.setAppUserModelId("com.cat-task-assistant.desktop");
  app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
  app.on("second-instance", () => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      if (dashboardWindow.isMinimized()) dashboardWindow.restore();
      dashboardWindow.show();
      dashboardWindow.focus();
    }
  });
}

function isWindowSender(event, window) {
  return Boolean(window && !window.isDestroyed() && event.sender === window.webContents);
}

function loadReminderLedger() {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "reminder-ledger.json"), "utf8"));
    if (Array.isArray(saved.fired)) firedReminderKeys = new Set(saved.fired.filter(key => typeof key === "string").slice(-3000));
  } catch (_) { firedReminderKeys = new Set(); }
}

function saveReminderLedger() {
  try {
    fs.writeFileSync(path.join(app.getPath("userData"), "reminder-ledger.json"), JSON.stringify({ fired: [...firedReminderKeys].slice(-3000) }));
  } catch (error) { console.error("Could not save reminder ledger:", error.message); }
}

function flushPendingMessages() {
  if (reminderDelivery) reminderDelivery.flush(catWindow);
}

function flushPendingActions() {
  if (!dashboardWindow || dashboardWindow.isDestroyed() || dashboardWindow.webContents.isLoading()) return;
  for (const action of pendingCatActions.splice(0)) dashboardWindow.webContents.send("dashboard:reminder-action", action);
  for (const entry of pendingChatReminderHistory.splice(0)) dashboardWindow.webContents.send("dashboard:chat-reminder-history", entry);
}

function showCatWindow() {
  if (!catWindow || catWindow.isDestroyed()) createFloatingCat();
  if (catWindow.isMinimized()) catWindow.restore();
  catWindow.setAlwaysOnTop(true, "floating");
  catWindow.show();
  catWindow.moveTop();
  catWindow.focus();
}

function showDesktopNotification(reminder) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: reminder.kind === "chat" ? "Mochi reminder" : "Mochi task reminder",
    body: reminder.message,
    silent: false
  });
  activeNotifications.add(notification);
  notification.on("close", () => activeNotifications.delete(notification));
  notification.on("click", () => showCatWindow());
  notification.show();
}

function deliverReminder(reminder, occurrenceKey) {
  if (!reminderDelivery) return false;
  return reminderDelivery.deliver(reminder, occurrenceKey);
}

function recordChatReminderHistory(record, action) {
  const entry = {
    id: randomUUID(),
    taskId: record.id,
    title: record.title,
    category: "other",
    status: action === "done" ? "done" : "snoozed",
    time: new Date().toISOString(),
    due: record.dueAt
  };
  if (dashboardWindow && !dashboardWindow.isDestroyed() && !dashboardWindow.webContents.isLoading()) {
    dashboardWindow.webContents.send("dashboard:chat-reminder-history", entry);
  } else pendingChatReminderHistory.push(entry);
}

function checkTaskReminders() {
  for (const { task, key } of dueReminders(reminderTasks, new Date(), firedReminderKeys)) {
    firedReminderKeys.add(key);
    saveReminderLedger();
    deliverReminder({
      id: task.id,
      taskId: task.id,
      kind: "task",
      title: task.title,
      language: reminderLanguage,
      message: reminderMessage(task, reminderLanguage)
    }, key);
  }
}

function checkChatReminders() {
  if (!chatReminderStore) return;
  try {
    for (const reminder of chatReminderStore.claimDue(new Date())) {
      deliverReminder({
        id: reminder.id,
        taskId: reminder.id,
        kind: "chat",
        title: reminder.title,
        language: reminder.language,
        message: reminder.message
      }, `${reminder.id}:${reminder.dueAt}`);
    }
  } catch (error) { console.error("Could not claim a chat reminder:", error.message); }
}

function createDashboard() {
  dashboardWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 760,
    minHeight: 560,
    title: "Cat Task Assistant",
    backgroundColor: "#fffaf8",
    icon: getAppIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });
  dashboardWindow.loadFile(path.join(__dirname, "index.html"));
  dashboardWindow.webContents.on("did-finish-load", flushPendingActions);
  dashboardWindow.on("closed", () => { dashboardWindow = null; });
}

function createFloatingCat() {
  catRendererReady = false;
  catWindow = new BrowserWindow({
    width: 330,
    height: 470,
    minWidth: 300,
    minHeight: 420,
    x: Math.max(20, (require("electron").screen.getPrimaryDisplay().workAreaSize.width || 1200) - 360),
    y: 100,
    title: "Your Floating Cat",
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    icon: getAppIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });
  catWindow.loadFile(path.join(__dirname, "pet.html"));
  catWindow.webContents.on("did-finish-load", () => {
    loadFreshEnv();
    const rawFishKey = process.env.FISH_AUDIO_API_KEY || "";
    const hasFishKey = Boolean(rawFishKey && !rawFishKey.includes("PASTE_YOUR_FISH_AUDIO_API_KEY_HERE"));
    console.info(`[Voice] Floating cat window loaded. Fish Audio configured: ${hasFishKey}`);
    catWindow.webContents.send("cat:language", reminderLanguage);
    catWindow.webContents.send("cat:voice-config", { provider: "fish-audio", enabled: hasFishKey });
    flushPendingMessages();
  });
  catWindow.setAlwaysOnTop(true, "floating");
  catWindow.on("closed", () => { catRendererReady = false; catWindow = null; });
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  const userDataDir = app.getPath("userData");
  try {
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    const envExamplePath = path.join(userDataDir, ".env.example");
    if (!fs.existsSync(envExamplePath) && !fs.existsSync(path.join(userDataDir, ".env"))) {
      const template = [
        "# Cat Task Assistant - API Configuration",
        "# To enable optional AI features, copy this file to .env in this folder and add your API keys.",
        `# Folder: ${userDataDir}`,
        "",
        "# Google AI Studio API key for Gemma 4 chat",
        "GEMMA_API_KEY=PASTE_YOUR_API_KEY_HERE",
        "# GEMMA_MODEL_ID=gemma-4-26b-a4b-it",
        "",
        "# Sarvam AI API subscription key for Speech-to-Text",
        "SARVAM_API_KEY=PASTE_YOUR_SARVAM_API_KEY_HERE",
        "",
        "# Fish Audio API for cartoon cat text-to-speech",
        "FISH_AUDIO_API_KEY=PASTE_YOUR_FISH_AUDIO_API_KEY_HERE",
        "# FISH_AUDIO_VOICE_ID=",
        "# FISH_AUDIO_MODEL=s2.1-pro-free",
        ""
      ].join("\r\n");
      fs.writeFileSync(envExamplePath, template, "utf8");
    }
  } catch (err) {
    console.warn("[Config] Could not write user .env.example:", err.message);
  }
  loadFreshEnv();
  console.info(`[Config] UserData: ${userDataDir}; Active .env: ${activeEnvFilePath || "none (using process.env)"}`);
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === "media") {
        if (
          (catWindow && !catWindow.isDestroyed() && webContents === catWindow.webContents) ||
          (dashboardWindow && !dashboardWindow.isDestroyed() && webContents === dashboardWindow.webContents)
        ) {
          return callback(true);
        }
      }
      callback(false);
    });
  }
  loadReminderLedger();
  chatReminderStore = new ChatReminderStore(path.join(app.getPath("userData"), "chat-reminders.json"));
  chatReminderStore.load();
  reminderDelivery = new ReminderDelivery({
    getWindow: () => catWindow,
    ensureWindow: () => { if (!catWindow || catWindow.isDestroyed()) createFloatingCat(); },
    notify: showDesktopNotification,
    isRendererReady: () => catRendererReady
  });
  createDashboard();
  createFloatingCat();
  checkChatReminders();
  checkTaskReminders();
  setInterval(() => {
    checkChatReminders();
    checkTaskReminders();
  }, 15_000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDashboard();
      createFloatingCat();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (speechProcess && !speechProcess.killed) speechProcess.kill();
});

function speechRecognitionError(code) {
  const messages = {
    NO_SPEECH: "I didn't catch anything. Try speaking a little closer to the microphone.",
    LOW_CONFIDENCE: "I couldn't hear that clearly. Please try speaking closer to the microphone or type your message.",
    RECOGNIZER_NOT_INSTALLED: "Windows speech recognition for the selected language is not installed. Add that Windows speech language and try again.",
    MICROPHONE_PERMISSION_DENIED: "Windows denied microphone access. Allow microphone access for desktop apps in Windows Settings.",
    MICROPHONE_UNAVAILABLE: "Windows could not open a microphone. Check that a microphone is connected and enabled.",
    RECOGNITION_FAILED: "Windows speech recognition could not start. Check the microphone and Windows speech settings."
  };
  return messages[code] || "Windows speech recognition failed. Check the microphone and try again.";
}

function recognizeWindowsSpeech(cultureName) {
  if (speechProcess) return Promise.resolve({ ok: false, error: "Mochi is already listening." });
  const powershellPath = path.join(process.env.WINDIR || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const scriptPath = getWindowsSpeechScriptPath();
  const args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-CultureName", cultureName];
  if (process.env.SPEECH_MIN_CONFIDENCE && !Number.isNaN(Number(process.env.SPEECH_MIN_CONFIDENCE))) {
    args.push("-MinConfidence", process.env.SPEECH_MIN_CONFIDENCE);
  }

  return new Promise(resolve => {
    const child = execFile(powershellPath, args, {
      windowsHide: true,
      timeout: 25_000,
      maxBuffer: 16 * 1024,
      encoding: "buffer"
    }, (error, stdout) => {
      if (speechProcess === child) speechProcess = null;
      const encodedResult = Buffer.isBuffer(stdout) ? stdout.toString("ascii").trim().split(/\s+/).pop() : "";
      let result;
      try { result = encodedResult ? JSON.parse(Buffer.from(encodedResult, "base64").toString("utf8")) : null; }
      catch (_) { result = null; }

      if (error?.code === "ETIMEDOUT") {
        resolve({ ok: false, error: "Listening timed out. Press Listen and try again." });
        return;
      }
      if (result?.ok === true && typeof result.text === "string" && result.text.trim()) {
        resolve({
          ok: true,
          text: result.text.trim(),
          confidence: Number.isFinite(result.confidence) ? result.confidence : null,
          lowConfidence: result.lowConfidence === true,
          cultureName: typeof result.cultureName === "string" ? result.cultureName : cultureName
        });
        return;
      }
      if (result && typeof result.code === "string") {
        resolve({
          ok: false,
          code: result.code,
          error: speechRecognitionError(result.code),
          confidence: Number.isFinite(result.confidence) ? result.confidence : null
        });
        return;
      }
      const exitKind = error?.code || error?.name || "unknown";
      console.warn(`[Speech] Windows recognizer process failed (${exitKind}).`);
      resolve({ ok: false, error: speechRecognitionError("RECOGNITION_FAILED") });
    });
    speechProcess = child;
  });
}

ipcMain.handle("cat:ask-gemma", async (event, rawMessage) => {
  if (!isWindowSender(event, catWindow)) return { ok: false, error: "This request is not available from this window." };
  if (typeof rawMessage !== "string" || rawMessage.length > 3000) return { ok: false, error: "Messages must be text under 3,000 characters." };
  const message = rawMessage.trim();
  if (!message) return { ok: false, error: "Type a message first." };

  const reminderRequest = parseChatReminder(message);
  let scheduledReminder = null;
  if (reminderRequest) {
    try { scheduledReminder = chatReminderStore && chatReminderStore.schedule(reminderRequest, reminderLanguage); }
    catch (error) { console.error("Could not save the requested chat reminder:", error.message); }
  }

  loadFreshEnv();

  const rawKey = process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const apiKey = (rawKey && !rawKey.includes("PASTE_YOUR_API_KEY_HERE")) ? rawKey.trim() : "";
  const modelId = process.env.GEMMA_MODEL_ID || "gemma-4-26b-a4b-it";
  console.info(`[Gemma] .env ${dotenvResult.error ? "not loaded" : "loaded"}; API key configured: ${Boolean(apiKey)}; model: ${modelId}`);
  if (!apiKey) {
    if (scheduledReminder) {
      return { ok: true, text: reminderOnlyReply(scheduledReminder), warning: "Gemma isn't configured. The reminder is set." };
    }
    return {
      ok: false,
      error: `AI is not configured. Add your Google AI Studio API key as GEMMA_API_KEY in the .env file.${reminderRequest ? " The requested reminder wasn't set." : ""}`
    };
  }

  try {
    const request = buildGemmaHttpRequest(apiKey, modelId, message);
    const response = await fetch(request.url, { ...request.options, signal: AbortSignal.timeout(20_000) });

    let data;
    try { data = await response.json(); }
    catch (_) {
      const error = `Google AI returned malformed JSON (HTTP ${response.status}).`;
      console.error(`[Gemma] ${error}`);
      if (scheduledReminder) return { ok: true, text: reminderOnlyReply(scheduledReminder), warning: `Gemma's response was malformed. The reminder is set.` };
      return { ok: false, error: `${error}${reminderRequest ? " The requested reminder wasn't set." : ""}` };
    }
    if (!response.ok) {
      const error = gemmaErrorMessage(response.status, data?.error, apiKey);
      console.error(`[Gemma] ${redactSensitiveText(error, apiKey)}`);
      if (scheduledReminder) return { ok: true, text: reminderOnlyReply(scheduledReminder), warning: `${error} The reminder is set.` };
      return { ok: false, error: `${error}${reminderRequest ? " The requested reminder wasn't set." : ""}` };
    }

    const inspection = inspectGemmaResponse(data);
    const responseSummary = {
      httpStatus: response.status,
      candidateCount: inspection.candidateCount,
      candidates: inspection.candidates,
      finishReasons: inspection.finishReasons,
      promptFeedbackBlockReason: inspection.blockReason || null
    };
    console.info("[Gemma] response metadata", JSON.stringify(responseSummary));
    const text = inspection.text;
    if (!inspection.validResponse || !inspection.validCandidates || !text) {
      const error = gemmaEmptyResponseMessage(inspection, response.status);
      console.warn(`[Gemma] ${error}`);
      if (scheduledReminder) return { ok: true, text: reminderOnlyReply(scheduledReminder), warning: `Gemma returned no answer text. The reminder is set.` };
      return { ok: false, error: `${error}${reminderRequest ? " The requested reminder wasn't set." : ""}` };
    }
    if (containsPromptLeak(text)) {
      console.error("[Gemma] HTTP 200 response was rejected because it resembled internal prompt scaffolding.");
      if (scheduledReminder) return { ok: true, text: reminderOnlyReply(scheduledReminder), warning: "Mochi couldn't form a natural AI reply. The reminder is set." };
      return {
        ok: false,
        error: `Mochi couldn't form a natural reply. Please try again.${reminderRequest ? " The requested reminder wasn't set." : ""}`
      };
    }
    return { ok: true, text: replyWithReminderState(text, scheduledReminder, Boolean(reminderRequest)) };
  } catch (error) {
    const detail = redactSensitiveText(error?.message || "Unknown network error.", apiKey);
    const networkError = error?.name === "TimeoutError" || error?.name === "AbortError"
      ? "Google AI request timed out after 20 seconds."
      : `Google AI network request failed: ${detail}`;
    console.error(`[Gemma] ${networkError}`);
    if (scheduledReminder) return { ok: true, text: reminderOnlyReply(scheduledReminder), warning: "Gemma couldn't be reached. The reminder is set." };
    return {
      ok: false,
      error: `${networkError}${reminderRequest ? " The requested reminder wasn't set." : ""}`
    };
  }
});

ipcMain.handle("dashboard:sync-reminders", (event, payload) => {
  if (!isWindowSender(event, dashboardWindow) || !payload || typeof payload !== "object") return false;
  const tasks = sanitizeTasks(payload.tasks);
  if (!tasks || !["en", "hi", "kn", "ja"].includes(payload.language)) return false;
  reminderTasks = tasks;
  reminderLanguage = payload.language;
  if (catWindow && !catWindow.isDestroyed() && !catWindow.webContents.isLoading()) {
    catWindow.webContents.send("cat:language", reminderLanguage);
  }
  checkTaskReminders();
  return true;
});

ipcMain.handle("cat:get-language", event => isWindowSender(event, catWindow) ? reminderLanguage : "en");

ipcMain.handle("cat:get-voice-config", event => {
  if (!isWindowSender(event, catWindow)) return { enabled: false };
  loadFreshEnv();
  const rawFishKey = process.env.FISH_AUDIO_API_KEY || "";
  const hasFishKey = Boolean(rawFishKey && !rawFishKey.includes("PASTE_YOUR_FISH_AUDIO_API_KEY_HERE"));
  return { provider: "fish-audio", enabled: hasFishKey };
});

ipcMain.handle("cat:speech-recognition", (event, language) => {
  if (!isWindowSender(event, catWindow)) return { ok: false, error: "Speech input is not available from this window." };
  if (typeof language !== "string" || !Object.prototype.hasOwnProperty.call(speechCultures, language)) {
    return { ok: false, error: "That speech language is not supported." };
  }
  return recognizeWindowsSpeech(speechCultures[language]);
});

ipcMain.handle("cat:transcribe-audio", async (event, payload) => {
  if (!isWindowSender(event, catWindow)) return { ok: false, error: "Audio transcription is not available from this window." };
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid audio transcription request." };
  loadFreshEnv();
  const rawSarvamKey = process.env.SARVAM_API_KEY || "";
  const sarvamApiKey = (rawSarvamKey && !rawSarvamKey.includes("PASTE_YOUR_SARVAM_API_KEY_HERE")) ? rawSarvamKey.trim() : "";
  return transcribeWithSarvam({
    audioBuffer: payload.audioBuffer,
    mimeType: payload.mimeType,
    language: typeof payload.language === "string" ? payload.language : reminderLanguage,
    apiKey: sarvamApiKey
  });
});

ipcMain.handle("cat:synthesize-speech", async (event, payload) => {
  if (!isWindowSender(event, catWindow)) return { ok: false, error: "Audio synthesis is not available from this window.", fallback: true };
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid speech synthesis request.", fallback: true };

  loadFreshEnv();

  const rawFishKey = process.env.FISH_AUDIO_API_KEY || "";
  const fishApiKey = (rawFishKey && !rawFishKey.includes("PASTE_YOUR_FISH_AUDIO_API_KEY_HERE")) ? rawFishKey.trim() : "";
  const voiceId = process.env.FISH_AUDIO_VOICE_ID ? process.env.FISH_AUDIO_VOICE_ID.trim() : "";
  const model = process.env.FISH_AUDIO_MODEL ? process.env.FISH_AUDIO_MODEL.trim() : "s2.1-pro-free";

  if (!fishApiKey) {
    console.info("[Voice] Fallback TTS: used because Fish Audio is not configured in .env");
    return { ok: false, error: "FISH_AUDIO_API_KEY is not configured.", fallback: true };
  }

  console.info(`[Voice] Fish Audio: request started (text length: ${payload.text?.length || 0}, emotion: ${payload.emotion || "neutral"}, voice: ${voiceId || "default cartoon cat"})`);

  const result = await synthesizeWithFishAudio({
    text: payload.text,
    emotion: payload.emotion,
    speed: payload.speed,
    pitch: payload.pitch,
    apiKey: fishApiKey,
    voiceId,
    model
  });

  if (result.ok && result.audioBuffer) {
    console.info(`[Voice] Fish Audio: synthesis successful (${result.audioBuffer.length} bytes, format: ${result.format || "mp3"})`);
    return {
      ok: true,
      audioBuffer: result.audioBuffer,
      audioData: result.audioBuffer.toString("base64"),
      mimeType: result.mimeType || "audio/mpeg"
    };
  }

  console.warn(`[Voice] Fish Audio: request failed — ${result.error || "unknown error"}`);
  console.info(`[Voice] Fallback TTS: used because Fish Audio failed`);
  return {
    ok: false,
    error: result.error || "Audio synthesis failed",
    fallback: true
  };
});

const activeSpeechStreams = new Map();

ipcMain.handle("cat:cancel-speech-stream", (event, streamId) => {
  if (!isWindowSender(event, catWindow)) return false;
  const controller = activeSpeechStreams.get(streamId);
  if (controller) {
    try { controller.abort(); } catch (_) {}
    activeSpeechStreams.delete(streamId);
    return true;
  }
  return false;
});

ipcMain.handle("cat:synthesize-speech-stream", async (event, payload) => {
  if (!isWindowSender(event, catWindow)) return { ok: false, error: "Audio synthesis is not available from this window.", fallback: true };
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid speech synthesis request.", fallback: true };

  loadFreshEnv();

  const rawFishKey = process.env.FISH_AUDIO_API_KEY || "";
  const fishApiKey = (rawFishKey && !rawFishKey.includes("PASTE_YOUR_FISH_AUDIO_API_KEY_HERE")) ? rawFishKey.trim() : "";
  const voiceId = process.env.FISH_AUDIO_VOICE_ID ? process.env.FISH_AUDIO_VOICE_ID.trim() : "";
  const model = process.env.FISH_AUDIO_MODEL ? process.env.FISH_AUDIO_MODEL.trim() : "s2.1-pro-free";

  if (!fishApiKey) {
    console.info("[Voice] Fallback TTS: used because Fish Audio is not configured in .env");
    console.info("[Voice] [Diagnostics] fallback → browser speech synthesis (reason: FISH_AUDIO_API_KEY is not configured in .env)");
    return { ok: false, error: "FISH_AUDIO_API_KEY is not configured.", fallback: true };
  }

  const streamId = payload.streamId || randomUUID();
  const abortController = new AbortController();
  activeSpeechStreams.set(streamId, abortController);

  console.info(`[Voice] [Timing] Fish Audio streaming request initiated (streamId: ${streamId}, length: ${payload.text?.length || 0}, emotion: ${payload.emotion || "neutral"}, voice: ${voiceId || "default cartoon cat"})`);

  const streamPromise = streamFishAudio({
    text: payload.text,
    emotion: payload.emotion,
    speed: payload.speed,
    pitch: payload.pitch,
    apiKey: fishApiKey,
    voiceId,
    model,
    format: payload.format || "wav",
    latency: "balanced",
    signal: abortController.signal,
    onChunk: (chunkData) => {
      if (!catWindow || catWindow.isDestroyed()) return;
      catWindow.webContents.send("cat:speech-chunk", {
        streamId,
        ...chunkData,
        chunk: chunkData.chunk ? Buffer.from(chunkData.chunk) : null
      });
    }
  });

  streamPromise.then(res => {
    activeSpeechStreams.delete(streamId);
    if (!res.ok && res.error) {
      console.warn(`[Voice] Fish Audio: request failed — ${res.error}`);
      console.info(`[Voice] Fallback TTS: used because Fish Audio failed`);
      console.info(`[Voice] [Diagnostics] fallback → browser speech synthesis (reason: ${res.error})`);
      if (catWindow && !catWindow.isDestroyed()) {
        catWindow.webContents.send("cat:speech-chunk", {
          streamId,
          isError: true,
          error: res.error,
          fallback: true
        });
      }
    }
  }).catch(err => {
    activeSpeechStreams.delete(streamId);
    if (err?.name !== "AbortError") {
      console.warn(`[Voice] Fish Audio: request failed — ${err?.message || "network error"}`);
      console.info(`[Voice] Fallback TTS: used because Fish Audio failed`);
      console.info(`[Voice] [Diagnostics] fallback → browser speech synthesis (reason: ${err?.message || "network error"})`);
      if (catWindow && !catWindow.isDestroyed()) {
        catWindow.webContents.send("cat:speech-chunk", {
          streamId,
          isError: true,
          error: err?.message || "Streaming failed",
          fallback: true
        });
      }
    }
  });

  return { ok: true, streamId };
});

ipcMain.handle("cat:renderer-ready", event => {
  if (!isWindowSender(event, catWindow)) return false;
  catRendererReady = true;
  loadFreshEnv();
  const rawFishKey = process.env.FISH_AUDIO_API_KEY || "";
  const hasFishKey = Boolean(rawFishKey && !rawFishKey.includes("PASTE_YOUR_FISH_AUDIO_API_KEY_HERE"));
  if (catWindow && !catWindow.isDestroyed()) {
    catWindow.webContents.send("cat:voice-config", { provider: "fish-audio", enabled: hasFishKey });
  }
  flushPendingMessages();
  return true;
});

ipcMain.handle("cat:reminder-action", (event, payload) => {
  if (!isWindowSender(event, catWindow) || !validReminderAction(payload)) return { ok: false };
  const task = reminderTasks.find(item => item.id === payload.taskId && item.status === "pending");
  if (!task) {
    try {
      const ok = Boolean(chatReminderStore && chatReminderStore.applyAction(payload.taskId, payload.action));
      if (ok) {
        const record = chatReminderStore.records.find(item => item.id === payload.taskId);
        if (record) recordChatReminderHistory(record, payload.action);
      }
      return { ok };
    }
    catch (error) {
      console.error("Could not save a chat reminder action:", error.message);
      return { ok: false };
    }
  }
  const action = { taskId: task.id, action: payload.action };
  if (!dashboardWindow || dashboardWindow.isDestroyed()) {
    pendingCatActions.push(action);
    createDashboard();
    dashboardWindow.show();
    return { ok: true };
  }
  if (dashboardWindow.webContents.isLoading()) pendingCatActions.push(action);
  else dashboardWindow.webContents.send("dashboard:reminder-action", action);
  return { ok: true };
});

ipcMain.handle("cat:open-dashboard", (event) => {
  if (!isWindowSender(event, catWindow)) return false;
  if (!dashboardWindow || dashboardWindow.isDestroyed()) createDashboard();
  dashboardWindow.show();
  dashboardWindow.focus();
  return true;
});

ipcMain.handle("cat:close-floating", (event) => {
  if (!isWindowSender(event, catWindow)) return false;
  if (catWindow && !catWindow.isDestroyed()) catWindow.close();
  return true;
});

ipcMain.handle("cat:open-external", async (event, rawUrl) => {
  if (!isWindowSender(event, catWindow) || typeof rawUrl !== "string" || rawUrl.length > 500) return false;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !["ai.google.dev", "aistudio.google.com"].includes(url.hostname)) return false;
    await shell.openExternal(url.href);
    return true;
  } catch (_) { return false; }
});
