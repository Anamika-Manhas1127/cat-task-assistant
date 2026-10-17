"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { ReminderDelivery } = require("../reminder-delivery");

function fakeWindow({ minimized = false, loading = false } = {}) {
  const calls = [];
  return {
    calls,
    isDestroyed: () => false,
    isMinimized: () => minimized,
    restore: () => calls.push("restore"),
    setAlwaysOnTop: (...args) => calls.push(["alwaysOnTop", ...args]),
    show: () => calls.push("show"),
    showInactive: () => calls.push("showInactive"),
    moveTop: () => calls.push("moveTop"),
    focus: () => calls.push("focus"),
    webContents: {
      isLoading: () => loading,
      send: (...args) => calls.push(["send", ...args])
    }
  };
}

test("delivers a water reminder with its exact message while Mochi is minimized", () => {
  const window = fakeWindow({ minimized: true });
  const notifications = [];
  const delivery = new ReminderDelivery({
    getWindow: () => window,
    ensureWindow() {},
    notify: reminder => notifications.push(reminder.message)
  });
  const reminder = { id: "water-1", message: "Meow! Time to drink water. Let's do this together!", dueAt: "2026-10-17T12:01:00.000Z" };

  assert.equal(delivery.deliver(reminder, "water-1:due"), true);
  assert.equal(window.calls.includes("restore"), true);
  assert.equal(window.calls.includes("showInactive"), true);
  assert.equal(window.calls.includes("focus"), false);
  assert.equal(notifications[0], reminder.message);
  assert.deepEqual(window.calls.find(call => Array.isArray(call) && call[0] === "send"), ["send", "reminder:show", reminder]);
});

test("queues delivery until a hidden cat renderer is ready and delivers each occurrence once", () => {
  let window = fakeWindow({ loading: true });
  let ensured = 0;
  const notifications = [];
  const delivery = new ReminderDelivery({
    getWindow: () => window,
    ensureWindow: () => { ensured += 1; },
    notify: reminder => notifications.push(reminder.id)
  });
  const reminder = { id: "hackathon-old", message: "Old hackathon reminder", dueAt: "2026-10-17T11:00:00.000Z" };
  assert.equal(delivery.deliver(reminder, "hackathon-old:due"), true);
  assert.equal(delivery.deliver(reminder, "hackathon-old:due"), false);
  assert.equal(ensured, 1);
  assert.deepEqual(notifications, ["hackathon-old"]);

  window = fakeWindow({ minimized: true });
  assert.equal(delivery.flush(window), 1);
  assert.equal(window.calls.includes("restore"), true);
  assert.equal(window.calls.filter(call => Array.isArray(call) && call[0] === "send").length, 1);
  assert.equal(delivery.flush(window), 0);
});

test("does not let an old reminder replace a newer water reminder", () => {
  const delivered = [];
  const window = fakeWindow();
  const delivery = new ReminderDelivery({
    getWindow: () => window,
    ensureWindow() {},
    notify: reminder => delivered.push(reminder.id)
  });
  const oldReminder = { id: "old-hackathon", message: "Old hackathon reminder" };
  const waterReminder = { id: "new-water", message: "Meow! Time to drink water." };
  delivery.deliver(oldReminder, "old-hackathon:due");
  delivery.deliver(waterReminder, "new-water:due");
  assert.deepEqual(delivered, ["old-hackathon", "new-water"]);
  assert.deepEqual(window.calls.filter(call => Array.isArray(call) && call[0] === "send").map(call => call[2].message), [
    oldReminder.message,
    waterReminder.message
  ]);
});

test("routes one reminder through preload into Mochi UI and speech while minimized", async () => {
  const channels = new Map();
  const exposed = {};
  let rendererReady = false;
  const ipcRenderer = {
    invoke: async channel => {
      if (channel === "cat:get-language") return "en";
      if (channel === "cat:renderer-ready") rendererReady = true;
      return true;
    },
    on(channel, callback) { channels.set(channel, callback); },
    removeListener(channel, callback) { if (channels.get(channel) === callback) channels.delete(channel); }
  };
  const preloadSource = fs.readFileSync(path.join(__dirname, "..", "preload.js"), "utf8");
  vm.runInNewContext(preloadSource, {
    require: moduleName => {
      assert.equal(moduleName, "electron");
      return { contextBridge: { exposeInMainWorld: (name, api) => { exposed[name] = api; } }, ipcRenderer };
    }
  });

  const classes = new Set();
  const elements = new Map();
  const elementIds = ["cat", "mood", "speech", "status", "chatForm", "messageInput", "speakBtn", "listenBtn", "muteBtn", "reminderActions", "doneReminderBtn", "snoozeReminderBtn", "laterReminderBtn", "dashboardBtn", "closeBtn"];
  for (const id of elementIds) {
    elements.set(id, {
      textContent: "", value: "", hidden: false, disabled: false, listeners: {}, attributes: {}, offsetWidth: 0,
      classList: {
        add(...names) { names.forEach(name => classes.add(name)); },
        remove(...names) { names.forEach(name => classes.delete(name)); },
        contains(name) { return classes.has(name); }
      },
      addEventListener(type, callback) { this.listeners[type] = callback; },
      setAttribute(name, value) { this.attributes[name] = value; },
      querySelectorAll() { return []; }, focus() {}
    });
  }
  const utterances = [];
  class Utterance { constructor(text) { this.text = text; } }
  const rendererWindow = {
    catDesktop: exposed.catDesktop,
    speechSynthesis: { cancel() {}, getVoices: () => [], speak: utterance => utterances.push(utterance) }
  };
  const petSource = fs.readFileSync(path.join(__dirname, "..", "pet.js"), "utf8");
  vm.runInNewContext(petSource, {
    document: { getElementById: id => elements.get(id) },
    window: rendererWindow,
    SpeechSynthesisUtterance: Utterance
  });
  await Promise.resolve();
  assert.equal(rendererReady, true);

  const windowCalls = [];
  const catWindow = {
    isDestroyed: () => false,
    isMinimized: () => true,
    restore: () => windowCalls.push("restore"),
    setAlwaysOnTop: () => windowCalls.push("alwaysOnTop"),
    show: () => windowCalls.push("show"),
    showInactive: () => windowCalls.push("showInactive"),
    moveTop: () => windowCalls.push("moveTop"),
    focus: () => windowCalls.push("focus"),
    webContents: {
      isLoading: () => false,
      send(channel, reminder) { channels.get(channel)({}, reminder); }
    }
  };
  const notificationMessages = [];
  const delivery = new ReminderDelivery({
    getWindow: () => catWindow,
    ensureWindow() {},
    notify: reminder => notificationMessages.push(reminder.message),
    isRendererReady: () => rendererReady
  });
  const reminder = {
    id: "water-integration-1",
    taskId: "water-integration-1",
    kind: "chat",
    title: "drink water",
    language: "en",
    message: "Meow! Time to drink water. 🐾 Let's do this together!"
  };

  rendererReady = false;
  assert.equal(delivery.deliver(reminder, "water-integration-1:due"), true);
  assert.equal(elements.get("speech").textContent, "Meow! I'm Mochi. Click Say hello, or ask me something below.");
  rendererReady = true;
  assert.equal(delivery.flush(catWindow), 1);
  assert.equal(elements.get("speech").textContent, reminder.message);
  assert.equal(utterances.at(-1).text, "Meow! Time to drink water. Let's do this together!");
  assert.deepEqual(notificationMessages, [reminder.message]);
  assert.equal(windowCalls.includes("restore"), true);
  assert.equal(windowCalls.includes("showInactive"), true);
  assert.equal(windowCalls.includes("focus"), false);
  assert.equal(delivery.deliver(reminder, "water-integration-1:due"), false);
  assert.equal(utterances.length, 1);
});
