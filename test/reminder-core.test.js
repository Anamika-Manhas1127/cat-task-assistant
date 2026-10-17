"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { dueAt, dueReminders, occurrenceKey, reminderMessage, sanitizeTasks, validReminderAction } = require("../reminder-core");

const now = new Date("2026-10-17T14:45:00.000Z");

test("uses today's local HH:mm due time and ignores missing or invalid times", () => {
  const task = { id: "a", title: "Study", due: "14:30", status: "pending" };
  const expected = new Date(now);
  expected.setHours(14, 30, 0, 0);
  assert.equal(dueAt(task, now).getTime(), expected.getTime());
  assert.equal(dueAt({ ...task, due: "" }, now), null);
  assert.equal(dueAt({ ...task, due: "25:70" }, now), null);
  assert.equal(dueReminders([{ id: "missing", title: "No time", status: "pending" }], now).length, 0);
});

test("fires an overdue task once and ignores completed tasks", () => {
  const tasks = [
    { id: "a", title: "Study", due: "14:30", status: "pending", createdAt: "start" },
    { id: "b", title: "Done", due: "14:30", status: "done", createdAt: "start" }
  ];
  const first = dueReminders(tasks, now);
  assert.equal(first.length, 1);
  assert.equal(first[0].task.id, "a");
  assert.equal(dueReminders(tasks, now, new Set([first[0].key])).length, 0);
});

test("snoozes are separate reminder occurrences and wait until their timestamp", () => {
  const task = { id: "a", title: "Study", due: "14:30", status: "pending", snoozeUntil: "2026-10-17T15:00:00.000Z" };
  assert.equal(dueReminders([task], now).length, 0);
  const afterSnooze = new Date("2026-10-17T15:01:00.000Z");
  const due = dueReminders([task], afterSnooze);
  assert.equal(due.length, 1);
  assert.notEqual(due[0].key, occurrenceKey({ ...task, snoozeUntil: "" }));
});

test("validates task snapshots and reminder action payloads", () => {
  assert.equal(sanitizeTasks([{ id: "a", title: "Study", category: "study", due: "14:30" }]).length, 1);
  assert.equal(sanitizeTasks([{ id: "a", title: "No due", category: "study" }])[0].due, "");
  assert.equal(sanitizeTasks([{ id: "a", title: "Study", category: "study", due: "14:30", status: "arbitrary" }]), null);
  assert.equal(validReminderAction({ taskId: "a", action: "snooze" }), true);
  assert.equal(validReminderAction({ taskId: "a", action: "run-code" }), false);
});

test("builds the exact visible and spoken localized reminder text", () => {
  assert.equal(reminderMessage({ title: "Review Java notes" }, "en"), "Meow! Time to Review Java notes. Let's do this together!");
  assert.match(reminderMessage({ title: "ノート" }, "ja"), /ノート/);
});