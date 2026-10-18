"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("preload exposes only named invokes and strips IPC events from callbacks", () => {
  const exposed = {};
  const handlers = new Map();
  const calls = [];
  const ipcRenderer = {
    invoke: (...args) => { calls.push(args); return Promise.resolve(true); },
    on: (channel, listener) => handlers.set(channel, listener),
    removeListener: (channel, listener) => { if (handlers.get(channel) === listener) handlers.delete(channel); }
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "preload.js"), "utf8");
  vm.runInNewContext(source, {
    require: moduleName => {
      assert.equal(moduleName, "electron", "sandboxed preload must not require local project modules");
      return { contextBridge: { exposeInMainWorld: (name, api) => { exposed[name] = api; } }, ipcRenderer };
    }
  });

  exposed.catDesktop.syncTasks([{ id: "t1" }], "en");
  exposed.catDesktop.reminderAction("t1", "snooze");
  exposed.catDesktop.recognizeSpeech("en");
  assert.equal(JSON.stringify(calls[0]), JSON.stringify(["dashboard:sync-reminders", { tasks: [{ id: "t1" }], language: "en" }]));
  assert.equal(JSON.stringify(calls[1]), JSON.stringify(["cat:reminder-action", { taskId: "t1", action: "snooze" }]));
  assert.equal(JSON.stringify(calls[2]), JSON.stringify(["cat:speech-recognition", "en"]));
  assert.equal(Object.hasOwn(exposed.catDesktop, "send"), false);
  assert.equal(Object.hasOwn(exposed.catDesktop, "speechText"), false);

  let received;
  const unsubscribe = exposed.catDesktop.onReminder(value => { received = value; });
  handlers.get("reminder:show")({ sender: "not forwarded" }, { title: "Study" });
  assert.deepEqual(received, { title: "Study" });
  unsubscribe();
  assert.equal(handlers.has("reminder:show"), false);

  const unsubscribeLanguage = exposed.catDesktop.onLanguage(value => { received = value; });
  handlers.get("cat:language")({ sender: "not forwarded" }, "ja");
  assert.equal(received, "ja");
  unsubscribeLanguage();
  assert.deepEqual(calls[3], ["cat:renderer-ready"]);

  exposed.catDesktop.transcribeAudio({ audioBuffer: "abc" });
  assert.equal(JSON.stringify(calls[4]), JSON.stringify(["cat:transcribe-audio", { audioBuffer: "abc" }]));

  exposed.catDesktop.synthesizeSpeech({ text: "Hello" });
  assert.equal(JSON.stringify(calls[5]), JSON.stringify(["cat:synthesize-speech", { text: "Hello" }]));

  exposed.catDesktop.getVoiceConfig();
  assert.equal(JSON.stringify(calls[6]), JSON.stringify(["cat:get-voice-config"]));

  let voiceConfigReceived;
  const unsubscribeVoice = exposed.catDesktop.onVoiceConfig(config => { voiceConfigReceived = config; });
  handlers.get("cat:voice-config")({ sender: "not forwarded" }, { provider: "fish-audio", enabled: true });
  assert.deepEqual(voiceConfigReceived, { provider: "fish-audio", enabled: true });
  unsubscribeVoice();
  assert.equal(handlers.has("cat:voice-config"), false);

  exposed.catDesktop.synthesizeSpeechStream({ text: "Stream me", streamId: 1 });
  assert.equal(JSON.stringify(calls[7]), JSON.stringify(["cat:synthesize-speech-stream", { text: "Stream me", streamId: 1 }]));

  exposed.catDesktop.cancelSpeechStream(1);
  assert.equal(JSON.stringify(calls[8]), JSON.stringify(["cat:cancel-speech-stream", 1]));

  let chunkReceived;
  const unsubscribeChunk = exposed.catDesktop.onSpeechChunk(chunk => { chunkReceived = chunk; });
  handlers.get("cat:speech-chunk")({ sender: "not forwarded" }, { streamId: 1, isFirst: true });
  assert.deepEqual(chunkReceived, { streamId: 1, isFirst: true });
  unsubscribeChunk();
  assert.equal(handlers.has("cat:speech-chunk"), false);
});