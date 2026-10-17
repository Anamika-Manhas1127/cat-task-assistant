"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElement() {
  return {
    value: "", textContent: "", innerHTML: "", style: {}, dataset: {}, listeners: {}, attributes: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() {}, scrollIntoView() {}
  };
}

test("dashboard applies reminder actions to its existing task storage and history", () => {
  const tasks = ["done", "snooze", "later"].map((id, index) => ({
    id, title: `Task ${id}`, category: "study", due: "09:00", status: "pending", createdAt: `start-${index}`
  }));
  const stored = new Map([["cat-task-assistant-v1", JSON.stringify({ tasks, history: [] })]]);
  const elements = new Map();
  let reminderAction;
  let chatReminderHistory;
  const document = {
    documentElement: { lang: "" },
    getElementById(id) { if (!elements.has(id)) elements.set(id, createElement()); return elements.get(id); },
    querySelectorAll() { return []; },
    createElement() { return createElement(); },
    body: { appendChild() {} }
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  vm.runInNewContext(source, {
    document,
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    window: {
      confirm: () => true,
      catDesktop: {
        syncTasks: () => Promise.resolve(true),
        onReminderAction: callback => { reminderAction = callback; },
        onChatReminderHistory: callback => { chatReminderHistory = callback; }
      }
    },
    Intl, Date, Math, JSON, setTimeout: () => 1, clearTimeout() {}
  });

  const before = Date.now();
  reminderAction({ taskId: "done", action: "done" });
  reminderAction({ taskId: "snooze", action: "snooze" });
  reminderAction({ taskId: "later", action: "later" });

  const saved = JSON.parse(stored.get("cat-task-assistant-v1"));
  assert.equal(saved.tasks.find(task => task.id === "done").status, "done");
  assert.ok(saved.tasks.find(task => task.id === "done").completedAt);
  for (const [id, minutes] of [["snooze", 10], ["later", 60]]) {
    const task = saved.tasks.find(item => item.id === id);
    const delay = Date.parse(task.snoozeUntil) - before;
    assert.equal(task.status, "pending");
    assert.equal(task.due, "09:00");
    assert.ok(delay >= minutes * 60_000 && delay <= (minutes * 60_000) + 2_000);
  }
  assert.deepEqual(saved.history.map(entry => entry.status), ["snoozed", "snoozed", "done"]);

  const chatEntry = {
    id: "chat-history-water-1",
    taskId: "chat-water-1",
    title: "drink water",
    status: "done",
    time: "2026-10-17T12:15:00.000Z",
    due: "2026-10-17T12:15:00.000Z"
  };
  chatReminderHistory(chatEntry);
  chatReminderHistory(chatEntry);
  const savedWithChatHistory = JSON.parse(stored.get("cat-task-assistant-v1"));
  assert.equal(savedWithChatHistory.history.filter(entry => entry.id === chatEntry.id).length, 1);
  assert.equal(savedWithChatHistory.history[0].title, "drink water");
  assert.equal(savedWithChatHistory.history[0].status, "done");
});