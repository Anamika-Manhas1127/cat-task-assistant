"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElement() {
  const classes = new Set();
  return {
    textContent: "", value: "", hidden: false, disabled: false, listeners: {}, attributes: {},
    classes,
    offsetWidth: 0,
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); }
    },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelectorAll() { return buttons; },
    focus() {}
  };
}

const ids = ["cat", "mood", "speech", "status", "chatForm", "messageInput", "speakBtn", "listenBtn", "muteBtn", "reminderActions", "doneReminderBtn", "snoozeReminderBtn", "laterReminderBtn", "dashboardBtn", "closeBtn"];
const buttons = [];

test("Say hello and task reminders speak the same text, and actions reach IPC", async () => {
  const elements = Object.fromEntries(ids.map(id => [id, createElement()]));
  buttons.splice(0, buttons.length, elements.doneReminderBtn, elements.snoozeReminderBtn, elements.laterReminderBtn);
  const utterances = [];
  const actions = [];
  let gemmaResponse = null;
  let speechResult = { ok: true, text: "Help me plan my demo" };
  let recognizedLanguage;
  let reminderListener;
  let languageListener;
  class Utterance { constructor(text) { this.text = text; } }
  let speechCanceled = 0;
  const speechSynthesis = {
    cancel() { speechCanceled += 1; }, getVoices: () => [{ lang: "ja-JP" }],
    speak(utterance) { utterances.push(utterance); }
  };
  class FakeAudioTrack { constructor() { this.stopped = false; } stop() { this.stopped = true; } }
  let currentTrack;
  const fakeStream = { getTracks: () => [currentTrack = new FakeAudioTrack()] };
  let recorderInstance = null;
  class FakeMediaRecorder {
    static isTypeSupported() { return true; }
    constructor(stream, options = {}) {
      this.stream = stream;
      this.mimeType = options.mimeType || "audio/webm;codecs=opus";
      this.state = "inactive";
      recorderInstance = this;
    }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      if (typeof this.ondataavailable === "function") {
        this.ondataavailable({ data: new Blob([Buffer.alloc(200)], { type: this.mimeType }) });
      }
      if (typeof this.onstop === "function") {
        this.onstop();
      }
    }
  }

  let transcribePayload = null;
  let transcribeResult = { ok: true, text: "Help me plan my demo" };

  const source = fs.readFileSync(path.join(__dirname, "..", "pet.js"), "utf8");
  vm.runInNewContext(source, {
    document: { getElementById: id => elements[id] },
    window: {
      speechSynthesis,
      addEventListener() {},
      catDesktop: {
        askGemma: async () => gemmaResponse || ({ ok: false, error: "AI not configured" }),
        recognizeSpeech: async () => speechResult,
        transcribeAudio: async payload => { transcribePayload = payload; return transcribeResult; },
        openDashboard() {}, closeFloating() {},
        reminderAction: async (...args) => { actions.push(args); return { ok: true }; },
        onReminder: callback => { reminderListener = callback; },
        onLanguage: callback => { languageListener = callback; },
        getLanguage: async () => "ja"
      }
    },
    navigator: {
      mediaDevices: {
        getUserMedia: async () => fakeStream
      }
    },
    MediaRecorder: FakeMediaRecorder,
    Blob: globalThis.Blob,
    SpeechSynthesisUtterance: Utterance,
    setTimeout,
    clearTimeout
  });
  await Promise.resolve();

  // Click 1: Start recording
  await elements.listenBtn.listeners.click();
  assert.equal(elements.listenBtn.textContent, "⏹️ Stop");
  assert.equal(elements.listenBtn.classList.contains("recording"), true);
  assert.match(elements.status.textContent, /Click Stop when finished/);
  assert.ok(speechCanceled > 0, "speechSynthesis must be canceled when Listen is clicked");

  // Click 2: Stop recording and transcribe
  await elements.listenBtn.listeners.click();
  for (let i = 0; i < 20 && elements.listenBtn.textContent !== "🎙️ Listen"; i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(transcribePayload.language, "ja");
  assert.equal(elements.messageInput.value, "Help me plan my demo");
  assert.match(elements.status.textContent, /Transcribed with Sarvam AI/);
  assert.equal(elements.listenBtn.textContent, "🎙️ Listen");
  assert.equal(currentTrack.stopped, true, "audio tracks must be stopped after recording");

  // Error case: Transcription failure does not overwrite messageInput
  elements.messageInput.value = "Preserved draft";
  transcribeResult = {
    ok: false,
    error: "Sarvam AI rejected the API key (HTTP 401). Check your SARVAM_API_KEY in .env."
  };
  await elements.listenBtn.listeners.click(); // start
  assert.equal(elements.listenBtn.textContent, "⏹️ Stop");
  await elements.listenBtn.listeners.click(); // stop
  for (let i = 0; i < 20 && elements.listenBtn.textContent !== "🎙️ Listen"; i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(elements.messageInput.value, "Preserved draft", "draft must not be overwritten by failed transcription");
  assert.match(elements.status.textContent, /HTTP 401/);
  assert.equal(elements.listenBtn.textContent, "🎙️ Listen");

  elements.speakBtn.listeners.click();
  assert.equal(elements.speech.textContent, utterances.at(-1).text);
  assert.equal(utterances.at(-1).lang, "ja-JP");
  assert.equal(elements.cat.classList.contains("greeting"), true);
  languageListener("hi");
  elements.speakBtn.listeners.click();
  assert.equal(elements.speech.textContent, utterances.at(-1).text);
  assert.match(utterances.at(-1).text, /मोची/);
  assert.equal(utterances.at(-1).lang, "hi-IN");

  const reminder = { taskId: "t1", title: "Review notes", message: "Meow! Review your notes now!", language: "ja" };
  reminderListener(reminder);
  assert.equal(elements.speech.textContent, reminder.message);
  assert.equal(utterances.at(-1).text, reminder.message);
  assert.equal(utterances.at(-1).lang, "ja-JP");
  await elements.snoozeReminderBtn.listeners.click();
  assert.deepEqual(actions[0], ["t1", "snooze"]);
  assert.equal(buttons.every(button => button.disabled === false), true);

  reminderListener({ ...reminder, taskId: "t2" });
  await elements.doneReminderBtn.listeners.click();
  assert.equal(elements.status.textContent, "Marked done in your task list.");
  reminderListener({ ...reminder, taskId: "t4", kind: "chat" });
  await elements.doneReminderBtn.listeners.click();
  assert.equal(elements.status.textContent, "Reminder marked done.");
  reminderListener({ ...reminder, taskId: "t3" });
  await elements.laterReminderBtn.listeners.click();
  assert.deepEqual(actions.map(action => JSON.stringify(action)), [
    JSON.stringify(["t1", "snooze"]),
    JSON.stringify(["t2", "done"]),
    JSON.stringify(["t4", "done"]),
    JSON.stringify(["t3", "later"])
  ]);

  const displayReply = "Nya, absolutely! *wiggles ears excitedly* What part are you working on? 🐾 🐱 ✨";
  gemmaResponse = { ok: true, text: displayReply };
  elements.messageInput.value = "Help me with my project";
  await elements.chatForm.listeners.submit({ preventDefault() {} });
  assert.equal(elements.speech.textContent, displayReply);
  assert.equal(utterances.at(-1).text, "Nya, absolutely! What part are you working on?");
  assert.equal(elements.cat.classList.contains("excited"), true);

  const oldStudy = { taskId: "old-study", title: "Study", message: "Meow! Time to Study.", language: "en" };
  const newWater = { taskId: "new-water", kind: "chat", title: "drink water", message: "Meow! Time to drink water. 🐾", language: "en" };
  reminderListener(oldStudy);
  reminderListener(newWater);
  assert.equal(elements.speech.textContent, newWater.message);
  assert.equal(utterances.at(-1).text, "Meow! Time to drink water.");
  await elements.doneReminderBtn.listeners.click();
  assert.equal(elements.speech.textContent, oldStudy.message);
  assert.equal(utterances.at(-1).text, oldStudy.message);
});