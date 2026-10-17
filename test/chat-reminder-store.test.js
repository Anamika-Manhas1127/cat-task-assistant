"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ChatReminderStore } = require("../chat-reminder-store");

test("persists a one-time chat reminder, claims it once, and supports its actions", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cat-task-reminders-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "chat-reminders.json");
  const store = new ChatReminderStore(filePath);
  const now = new Date("2026-10-17T12:00:00.000Z");
  const record = store.schedule({ title: "go for lunch", dueAt: "2026-10-17T12:05:00.000Z", delayMs: 300_000 }, "en");
  assert.ok(record.id);
  assert.equal(store.records.length, 1);

  const restartedStore = new ChatReminderStore(filePath);
  restartedStore.load();
  assert.equal(restartedStore.claimDue(now).length, 0);
  const fired = restartedStore.claimDue(new Date("2026-10-17T12:05:00.000Z"));
  assert.equal(fired.length, 1);
  assert.equal(fired[0].message, "Meow! Time to go for lunch. Let's do this together!");
  assert.equal(restartedStore.claimDue(new Date("2026-10-17T12:06:00.000Z")).length, 0);
  const afterRestart = new ChatReminderStore(filePath);
  afterRestart.load();
  assert.equal(afterRestart.claimDue(new Date("2026-10-17T12:06:00.000Z")).length, 0);

  assert.equal(afterRestart.applyAction(record.id, "snooze", new Date("2026-10-17T12:05:00.000Z")), true);
  assert.equal(Date.parse(afterRestart.records[0].dueAt), Date.parse("2026-10-17T12:15:00.000Z"));
  assert.equal(afterRestart.claimDue(new Date("2026-10-17T12:15:00.000Z")).length, 1);
  assert.equal(afterRestart.applyAction(record.id, "done", new Date("2026-10-17T12:15:00.000Z")), true);
  const completedAfterRestart = new ChatReminderStore(filePath);
  completedAfterRestart.load();
  assert.equal(completedAfterRestart.records[0].status, "done");
  assert.equal(completedAfterRestart.claimDue(new Date("2026-10-18T12:00:00.000Z")).length, 0);
});

test("keeps old hackathon and new water reminders as separate exact records across store instances", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cat-task-water-reminder-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "chat-reminders.json");
  const firstInstance = new ChatReminderStore(filePath);
  const secondInstance = new ChatReminderStore(filePath);
  const dueAt = "2026-10-17T12:01:00.000Z";
  const oldHackathon = firstInstance.schedule({ title: "finish hackathon demo", dueAt, delayMs: 60_000 }, "en");
  const newWater = secondInstance.schedule({ title: "drink water", dueAt, delayMs: 60_000 }, "en");

  assert.notEqual(oldHackathon.id, newWater.id);
  const restarted = new ChatReminderStore(filePath);
  restarted.load();
  const fired = restarted.claimDue(new Date(dueAt));
  assert.equal(fired.length, 2);
  assert.equal(fired[0].id, newWater.id);
  assert.deepEqual(fired.map(item => item.title).sort(), ["drink water", "finish hackathon demo"]);
  assert.equal(fired.find(item => item.id === newWater.id).message, "Meow! Time to drink water. Let's do this together!");
  assert.equal(fired.find(item => item.id === oldHackathon.id).message, "Meow! Time to finish hackathon demo. Let's do this together!");
  assert.equal(restarted.claimDue(new Date("2026-10-17T12:02:00.000Z")).length, 0);
});

test("does not accept a reminder when its record cannot be persisted", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cat-task-reminder-failure-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const blocker = path.join(directory, "not-a-directory");
  fs.writeFileSync(blocker, "");
  const store = new ChatReminderStore(path.join(blocker, "chat-reminders.json"));
  assert.throws(() => store.schedule({ title: "go for lunch", dueAt: "2026-10-17T12:05:00.000Z", delayMs: 300_000 }, "en"));
  assert.equal(store.records.length, 0);
});