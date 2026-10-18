"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createMockElement() {
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
    querySelectorAll() { return []; },
    focus() {}
  };
}

const elementIds = [
  "cat", "mood", "speech", "status", "chatForm", "messageInput",
  "speakBtn", "listenBtn", "muteBtn", "reminderActions",
  "doneReminderBtn", "snoozeReminderBtn", "laterReminderBtn",
  "dashboardBtn", "closeBtn"
];

test("pet.js uses fallback speech synthesis when Fish Audio is disabled", async () => {
  const elements = Object.fromEntries(elementIds.map(id => [id, createMockElement()]));
  const utterances = [];
  let synthesizeCalls = [];

  const speechSynthesis = {
    cancel() {},
    getVoices: () => [{ lang: "en-US" }],
    speak(utterance) { utterances.push(utterance); }
  };

  class FakeSpeechSynthesisUtterance {
    constructor(text) { this.text = text; }
  }

  const petSource = fs.readFileSync(path.join(__dirname, "..", "pet.js"), "utf8");
  const emotionSource = fs.readFileSync(path.join(__dirname, "..", "speech-emotion.js"), "utf8");

  const context = {
    document: { getElementById: id => elements[id] },
    window: {
      speechSynthesis,
      addEventListener() {},
      catDesktop: {
        getLanguage: async () => "en",
        getVoiceConfig: async () => ({ provider: "fish-audio", enabled: false }),
        onVoiceConfig(cb) {},
        synthesizeSpeech: async (payload) => {
          synthesizeCalls.push(payload);
          return { ok: true, audioBuffer: Buffer.alloc(100) };
        }
      }
    },
    SpeechSynthesisUtterance: FakeSpeechSynthesisUtterance,
    Blob: globalThis.Blob,
    URL: { createObjectURL: () => "blob:mock", revokeObjectURL: () => {} },
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(emotionSource, context);
  vm.runInNewContext(petSource, context);
  await Promise.resolve();

  // Click Say hello
  elements.speakBtn.listeners.click();
  await Promise.resolve();

  // Verify fallback speechSynthesis was called and synthesizeSpeech was NOT called
  assert.equal(synthesizeCalls.length, 0);
  assert.equal(utterances.length, 1);
  assert.match(utterances[0].text, /Meow! Hi, I'm Mochi/);
});

test("pet.js uses Fish Audio synthesis when enabled, and falls back if synthesis fails", async () => {
  const elements = Object.fromEntries(elementIds.map(id => [id, createMockElement()]));
  const utterances = [];
  const synthesizeCalls = [];
  let audioPlayed = 0;

  const speechSynthesis = {
    cancel() {},
    getVoices: () => [{ lang: "en-US" }],
    speak(utterance) { utterances.push(utterance); }
  };

  class FakeSpeechSynthesisUtterance {
    constructor(text) { this.text = text; }
  }

  class FakeAudio {
    constructor(url) { this.url = url; this.currentTime = 0; }
    play() {
      audioPlayed += 1;
      if (typeof this.onplay === "function") this.onplay();
      return Promise.resolve();
    }
    pause() {}
  }

  let voiceConfigCallback = null;
  let synthResult = { ok: true, audioBuffer: Buffer.alloc(200) };

  const petSource = fs.readFileSync(path.join(__dirname, "..", "pet.js"), "utf8");
  const emotionSource = fs.readFileSync(path.join(__dirname, "..", "speech-emotion.js"), "utf8");

  const context = {
    document: { getElementById: id => elements[id] },
    window: {
      speechSynthesis,
      addEventListener() {},
      catDesktop: {
        getLanguage: async () => "en",
        getVoiceConfig: async () => ({ provider: "fish-audio", enabled: true }),
        onVoiceConfig(cb) { voiceConfigCallback = cb; },
        synthesizeSpeech: async (payload) => {
          synthesizeCalls.push(payload);
          return synthResult;
        }
      }
    },
    Audio: FakeAudio,
    SpeechSynthesisUtterance: FakeSpeechSynthesisUtterance,
    Blob: globalThis.Blob,
    URL: { createObjectURL: () => "blob:mock-audio", revokeObjectURL: () => {} },
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(emotionSource, context);
  vm.runInNewContext(petSource, context);
  await Promise.resolve();

  // Test 1: Successful Fish Audio synthesis
  elements.speakBtn.listeners.click();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 10));

  assert.equal(synthesizeCalls.length, 1);
  assert.match(synthesizeCalls[0].text, /Meow! Hi, I'm Mochi/);
  assert.equal(audioPlayed, 1);
  assert.equal(utterances.length, 0); // fallback not invoked

  // Test 2: Failed Fish Audio synthesis triggers fallback
  synthResult = { ok: false, error: "Fish Audio rate limit (HTTP 429)", fallback: true };
  elements.speakBtn.listeners.click();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 10));

  assert.equal(synthesizeCalls.length, 2);
  assert.equal(utterances.length, 1); // fallback invoked
  assert.match(utterances[0].text, /Meow! Hi, I'm Mochi/);
});

test("pet.js uses Fish Audio streaming synthesis when synthesizeSpeechStream is available", async () => {
  const elements = Object.fromEntries(elementIds.map(id => [id, createMockElement()]));
  const utterances = [];
  const streamCalls = [];
  const cancelCalls = [];
  let chunkListener = null;

  const speechSynthesis = {
    cancel() {},
    getVoices: () => [{ lang: "en-US" }],
    speak(utterance) { utterances.push(utterance); }
  };

  class FakeSpeechSynthesisUtterance {
    constructor(text) { this.text = text; }
  }

  let audioContextCreated = 0;
  let sourceStarted = 0;
  class FakeAudioContext {
    constructor() {
      audioContextCreated += 1;
      this.currentTime = 0;
      this.state = "running";
      this.destination = {};
    }
    createBuffer(channels, length, rate) {
      return { channels, length, rate, duration: length / rate, copyToChannel() {} };
    }
    createBufferSource() {
      return {
        connect() {},
        start: (time) => { sourceStarted += 1; }
      };
    }
    close() {}
  }

  const petSource = fs.readFileSync(path.join(__dirname, "..", "pet.js"), "utf8");
  const emotionSource = fs.readFileSync(path.join(__dirname, "..", "speech-emotion.js"), "utf8");

  const context = {
    document: { getElementById: id => elements[id] },
    window: {
      speechSynthesis,
      addEventListener() {},
      AudioContext: FakeAudioContext,
      catDesktop: {
        getLanguage: async () => "en",
        getVoiceConfig: async () => ({ provider: "fish-audio", enabled: true }),
        onVoiceConfig(cb) {},
        onSpeechChunk(cb) { chunkListener = cb; },
        synthesizeSpeechStream: async (payload) => {
          streamCalls.push(payload);
          return { ok: true, streamId: payload.streamId };
        },
        cancelSpeechStream: async (id) => {
          cancelCalls.push(id);
          return true;
        }
      }
    },
    SpeechSynthesisUtterance: FakeSpeechSynthesisUtterance,
    Blob: globalThis.Blob,
    URL: { createObjectURL: () => "blob:mock", revokeObjectURL: () => {} },
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(emotionSource, context);
  vm.runInNewContext(petSource, context);
  await Promise.resolve();

  // Trigger speech via "Say hello"
  elements.speakBtn.listeners.click();
  await Promise.resolve();

  assert.equal(streamCalls.length, 1);
  assert.match(streamCalls[0].text, /Meow! Hi, I'm Mochi/);
  assert.equal(streamCalls[0].format, "wav");

  // Feed chunk meeting the jitter-buffer threshold
  assert.ok(chunkListener, "chunk listener must be registered");
  const dummyPcm = Buffer.alloc(30000);
  chunkListener({ streamId: streamCalls[0].streamId, chunk: dummyPcm, sampleRate: 44100 });

  assert.equal(audioContextCreated, 1);
  assert.equal(sourceStarted, 1);

  // Mute button interrupts active stream
  elements.muteBtn.listeners.click();
  await Promise.resolve();

  assert.equal(cancelCalls.length, 1);
  assert.equal(cancelCalls[0], streamCalls[0].streamId);
});

test("pet.js plays short sentence on stream completion even if below jitter threshold", async () => {
  const elements = Object.fromEntries(elementIds.map(id => [id, createMockElement()]));
  let chunkListener = null;
  let sourceStarted = 0;

  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createBuffer(c, len, r) { return { duration: len / r, copyToChannel() {} }; }
    createBufferSource() { return { connect() {}, start() { sourceStarted += 1; } }; }
    close() {}
  }

  const petSource = fs.readFileSync(path.join(__dirname, "..", "pet.js"), "utf8");
  const emotionSource = fs.readFileSync(path.join(__dirname, "..", "speech-emotion.js"), "utf8");

  const context = {
    document: { getElementById: id => elements[id] },
    window: {
      speechSynthesis: { cancel() {}, getVoices: () => [], speak() {} },
      addEventListener() {},
      AudioContext: FakeAudioContext,
      catDesktop: {
        getLanguage: async () => "en",
        getVoiceConfig: async () => ({ provider: "fish-audio", enabled: true }),
        onVoiceConfig() {},
        onSpeechChunk(cb) { chunkListener = cb; },
        synthesizeSpeechStream: async (p) => ({ ok: true, streamId: p.streamId }),
        cancelSpeechStream: async () => true
      }
    },
    SpeechSynthesisUtterance: class {},
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(emotionSource, context);
  vm.runInNewContext(petSource, context);
  await Promise.resolve();

  elements.speakBtn.listeners.click();
  await Promise.resolve();

  // Feed 500 bytes (small chunk, below 26KB threshold)
  chunkListener({ streamId: 1, chunk: Buffer.alloc(500), sampleRate: 44100 });
  assert.equal(sourceStarted, 0, "should not start yet because jitter buffer threshold is not reached");

  // Feed completion
  chunkListener({ streamId: 1, isDone: true, sampleRate: 44100 });
  assert.equal(sourceStarted, 1, "must start playback immediately on stream completion");
});

test("pet.js handles interruption by newer message and stream errors", async () => {
  const elements = Object.fromEntries(elementIds.map(id => [id, createMockElement()]));
  const utterances = [];
  const cancelCalls = [];
  let chunkListener = null;

  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createBuffer(c, len, r) { return { duration: len / r, copyToChannel() {} }; }
    createBufferSource() { return { connect() {}, start() {} }; }
    close() {}
  }

  const petSource = fs.readFileSync(path.join(__dirname, "..", "pet.js"), "utf8");
  const emotionSource = fs.readFileSync(path.join(__dirname, "..", "speech-emotion.js"), "utf8");

  const context = {
    document: { getElementById: id => elements[id] },
    window: {
      speechSynthesis: {
        cancel() {},
        getVoices: () => [],
        speak(u) { utterances.push(u); }
      },
      addEventListener() {},
      AudioContext: FakeAudioContext,
      catDesktop: {
        getLanguage: async () => "en",
        getVoiceConfig: async () => ({ provider: "fish-audio", enabled: true }),
        onVoiceConfig() {},
        onSpeechChunk(cb) { chunkListener = cb; },
        synthesizeSpeechStream: async (p) => ({ ok: true, streamId: p.streamId }),
        cancelSpeechStream: async (id) => { cancelCalls.push(id); return true; }
      }
    },
    SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(emotionSource, context);
  vm.runInNewContext(petSource, context);
  await Promise.resolve();

  // Test 1: Interruption by newer message cancels active stream
  elements.speakBtn.listeners.click();
  await Promise.resolve();
  assert.equal(cancelCalls.length, 0);

  // Newer message arrives (e.g. click again or reminder)
  elements.speakBtn.listeners.click();
  await Promise.resolve();
  assert.equal(cancelCalls.length, 1);
  assert.equal(cancelCalls[0], 1); // cancels streamId 1

  // Test 2: Stream error chunk falls back to speechSynthesis
  chunkListener({ streamId: 2, isError: true, error: "Network timeout" });
  assert.equal(utterances.length, 1);
  assert.match(utterances[0].text, /Meow! Hi, I'm Mochi/);
});

test("chat replies, say hello, task reminders, and chat reminders all route through the shared Fish Audio stream", async () => {
  const elements = Object.fromEntries(elementIds.map(id => [id, createMockElement()]));
  const streamCalls = [];
  const utterances = [];
  const infoLogs = [];
  let reminderListener = null;

  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createBuffer(c, len, r) { return { duration: len / r, copyToChannel() {} }; }
    createBufferSource() { return { connect() {}, start() {} }; }
    close() {}
  }

  const petSource = fs.readFileSync(path.join(__dirname, "..", "pet.js"), "utf8");
  const emotionSource = fs.readFileSync(path.join(__dirname, "..", "speech-emotion.js"), "utf8");

  const origInfo = console.info;
  console.info = (...args) => {
    infoLogs.push(args.join(" "));
    origInfo(...args);
  };

  try {
    const context = {
      document: { getElementById: id => elements[id] },
      console: { ...console, info: (...args) => infoLogs.push(args.join(" ")) },
      window: {
        speechSynthesis: {
          cancel() {},
          getVoices: () => [],
          speak: u => utterances.push(u)
        },
        addEventListener() {},
        AudioContext: FakeAudioContext,
        catDesktop: {
          getLanguage: async () => "en",
          getVoiceConfig: async () => ({ provider: "fish-audio", enabled: true }),
          onVoiceConfig() {},
          onSpeechChunk() {},
          onReminder(cb) { reminderListener = cb; },
          askGemma: async () => ({ ok: true, text: "Here is your task breakdown!" }),
          synthesizeSpeechStream: async (p) => {
            streamCalls.push(p);
            return { ok: true, streamId: p.streamId };
          },
          cancelSpeechStream: async () => true,
          reminderAction: async () => ({ ok: true })
        }
      },
      SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
      setTimeout,
      clearTimeout
    };

    vm.runInNewContext(emotionSource, context);
    vm.runInNewContext(petSource, context);
    await Promise.resolve();

    // 1. Say Hello
    elements.speakBtn.listeners.click();
    await Promise.resolve();
    assert.equal(streamCalls.length, 1);
    assert.match(streamCalls[0].text, /Meow! Hi, I'm Mochi/);
    assert.ok(infoLogs.some(l => l.includes("say hello → Fish Audio")), "must log say hello → Fish Audio");

    // 2. Chat reply
    elements.messageInput.value = "breakdown my day";
    await elements.chatForm.listeners.submit({ preventDefault() {} });
    assert.equal(streamCalls.length, 2);
    assert.equal(streamCalls[1].text, "Here is your task breakdown!");
    assert.ok(infoLogs.some(l => l.includes("chat → Fish Audio")), "must log chat → Fish Audio");

    // 3. Dashboard task reminder
    assert.ok(reminderListener, "reminder listener must be registered");
    reminderListener({
      taskId: "task-demo-1",
      kind: "task",
      title: "drink water",
      message: "Meow! Time to drink water. Let's do this together!",
      language: "en"
    });
    await Promise.resolve();
    assert.equal(streamCalls.length, 3);
    assert.match(streamCalls[2].text, /Time to drink water/);
    assert.ok(infoLogs.some(l => l.includes("task reminder → Fish Audio")), "must log task reminder → Fish Audio");

    // 4. Chat-created reminder
    reminderListener({
      taskId: "chat-reminder-1",
      kind: "chat",
      title: "stretch break",
      message: "Time for a quick stretch break!",
      language: "en"
    });
    await Promise.resolve();
    assert.equal(streamCalls.length, 4);
    assert.match(streamCalls[3].text, /stretch break/);
    assert.ok(infoLogs.some(l => l.includes("chat reminder → Fish Audio")), "must log chat reminder → Fish Audio");

    // Browser speech synthesis must NEVER have been called
    assert.equal(utterances.length, 0, "fallback speechSynthesis must not be called when Fish Audio is working");
  } finally {
    console.info = origInfo;
  }
});

test("reminders delivered immediately on window recreate/startup use Fish Audio streaming without race conditions", async () => {
  const elements = Object.fromEntries(elementIds.map(id => [id, createMockElement()]));
  const streamCalls = [];
  const utterances = [];
  let reminderCallback = null;

  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createBuffer(c, len, r) { return { duration: len / r, copyToChannel() {} }; }
    createBufferSource() { return { connect() {}, start() {} }; }
    close() {}
  }

  const petSource = fs.readFileSync(path.join(__dirname, "..", "pet.js"), "utf8");
  const emotionSource = fs.readFileSync(path.join(__dirname, "..", "speech-emotion.js"), "utf8");

  const context = {
    document: { getElementById: id => elements[id] },
    window: {
      speechSynthesis: { cancel() {}, getVoices: () => [], speak: u => utterances.push(u) },
      addEventListener() {},
      AudioContext: FakeAudioContext,
      catDesktop: {
        getLanguage: async () => "en",
        // getVoiceConfig resolves with delay to simulate startup/recreation race condition
        getVoiceConfig: () => new Promise(resolve => setTimeout(() => resolve({ provider: "fish-audio", enabled: true }), 100)),
        onVoiceConfig() {},
        onSpeechChunk() {},
        onReminder(cb) {
          reminderCallback = cb;
          // Deliver immediately as soon as onReminder registers (like IPC flush on renderer-ready)
          cb({
            taskId: "recreated-window-task",
            kind: "task",
            title: "drink water",
            message: "Meow! Time to drink water. Let's do this together!",
            language: "en"
          });
        },
        synthesizeSpeechStream: async (p) => {
          streamCalls.push(p);
          return { ok: true, streamId: p.streamId };
        },
        cancelSpeechStream: async () => true
      }
    },
    SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(emotionSource, context);
  vm.runInNewContext(petSource, context);

  // Reminders delivered immediately during startup/recreation must use Fish Audio streaming
  assert.equal(streamCalls.length, 1);
  assert.match(streamCalls[0].text, /Time to drink water/);
  assert.equal(utterances.length, 0, "must not fall back to browser speech synthesis");
});

test("snoozing interrupts active speech and queued reminder speaks via Fish Audio", async () => {
  const elements = Object.fromEntries(elementIds.map(id => [id, createMockElement()]));
  const streamCalls = [];
  const cancelCalls = [];
  let reminderCallback = null;

  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createBuffer(c, len, r) { return { duration: len / r, copyToChannel() {} }; }
    createBufferSource() { return { connect() {}, start() {} }; }
    close() {}
  }

  const petSource = fs.readFileSync(path.join(__dirname, "..", "pet.js"), "utf8");
  const emotionSource = fs.readFileSync(path.join(__dirname, "..", "speech-emotion.js"), "utf8");

  const context = {
    document: { getElementById: id => elements[id] },
    window: {
      speechSynthesis: { cancel() {}, getVoices: () => [], speak() {} },
      addEventListener() {},
      AudioContext: FakeAudioContext,
      catDesktop: {
        getLanguage: async () => "en",
        getVoiceConfig: async () => ({ provider: "fish-audio", enabled: true }),
        onVoiceConfig() {},
        onSpeechChunk() {},
        onReminder(cb) { reminderCallback = cb; },
        reminderAction: async () => ({ ok: true }),
        synthesizeSpeechStream: async (p) => {
          streamCalls.push(p);
          return { ok: true, streamId: p.streamId };
        },
        cancelSpeechStream: async (id) => {
          cancelCalls.push(id);
          return true;
        }
      }
    },
    SpeechSynthesisUtterance: class {},
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(emotionSource, context);
  vm.runInNewContext(petSource, context);
  await Promise.resolve();

  // Deliver two reminders (second goes to queue)
  reminderCallback({
    taskId: "task-1",
    kind: "task",
    title: "first task",
    message: "First reminder message",
    language: "en"
  });
  reminderCallback({
    taskId: "task-2",
    kind: "task",
    title: "second task",
    message: "Second reminder message",
    language: "en"
  });

  assert.equal(streamCalls.length, 2);
  assert.equal(streamCalls[1].text, "Second reminder message");

  // User clicks snooze on current reminder
  await elements.snoozeReminderBtn.listeners.click();
  await Promise.resolve();

  // Cancel was called to interrupt speech
  assert.ok(cancelCalls.length >= 1, "snoozing must interrupt speech");
  // Next reminder from queue was activated and spoke via Fish Audio
  assert.equal(streamCalls.length, 3);
  assert.equal(streamCalls[2].text, "First reminder message");
});



