"use strict";

const LANGUAGES = new Set(["en", "hi", "kn", "ja"]);
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validIsoDate(value) {
  if (typeof value !== "string" || value.length > 40) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function dueAt(task, now) {
  if (validIsoDate(task.snoozeUntil)) return new Date(task.snoozeUntil);
  if (typeof task.due !== "string" || !TIME_PATTERN.test(task.due)) return null;
  const [hours, minutes] = task.due.split(":").map(Number);
  const due = new Date(now);
  due.setHours(hours, minutes, 0, 0);
  return due;
}

function occurrenceKey(task) {
  const occurrence = validIsoDate(task.snoozeUntil)
    ? task.snoozeUntil
    : `${task.createdAt || "legacy"}:${task.due}`;
  return `${task.id}:${occurrence}`;
}

function dueReminders(tasks, now = new Date(), fired = new Set()) {
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(task => {
    if (!task || task.status !== "pending" || !task.id || !task.title) return false;
    const due = dueAt(task, now);
    return due !== null && due.getTime() <= now.getTime() && !fired.has(occurrenceKey(task));
  }).map(task => ({ task, key: occurrenceKey(task) }));
}

function reminderMessage(task, language) {
  const copy = {
    en: `Meow! Time to ${task.title}. Let's do this together!`,
    hi: `म्याऊँ! अब ${task.title} करने का समय है। चलो, साथ में करते हैं!`,
    kn: `ಮಿಯಾಂವ್! ಈಗ ${task.title} ಮಾಡುವ ಸಮಯ. ಒಟ್ಟಿಗೆ ಮಾಡೋಣ!`,
    ja: `にゃー！${task.title}の時間だよ。一緒にやろう！`
  };
  return copy[LANGUAGES.has(language) ? language : "en"];
}

function sanitizeTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length > 1000) return null;
  const clean = [];
  for (const task of tasks) {
    if (!task || typeof task !== "object" || Array.isArray(task)) return null;
    if (typeof task.id !== "string" || !task.id || task.id.length > 100) return null;
    if (typeof task.title !== "string" || !task.title.trim() || task.title.length > 90) return null;
    if (typeof task.category !== "string" || task.category.length > 40) return null;
    if (task.due !== undefined && task.due !== null && typeof task.due !== "string") return null;
    if (typeof task.due === "string" && task.due.length > 10) return null;
    if (task.status !== undefined && !["pending", "done", "skipped"].includes(task.status)) return null;
    if (task.createdAt !== undefined && (typeof task.createdAt !== "string" || task.createdAt.length > 40)) return null;
    clean.push({
      id: task.id,
      title: task.title.trim(),
      category: task.category,
      due: typeof task.due === "string" ? task.due : "",
      status: task.status || "pending",
      createdAt: task.createdAt || "legacy",
      snoozeUntil: validIsoDate(task.snoozeUntil) ? task.snoozeUntil : ""
    });
  }
  return clean;
}

function validReminderAction(value) {
  return value && typeof value === "object" &&
    typeof value.taskId === "string" && value.taskId.length > 0 && value.taskId.length <= 100 &&
    ["done", "snooze", "later"].includes(value.action);
}

module.exports = { dueAt, dueReminders, occurrenceKey, reminderMessage, sanitizeTasks, validReminderAction };