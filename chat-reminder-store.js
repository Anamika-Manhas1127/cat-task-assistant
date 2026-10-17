"use strict";

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { reminderMessage } = require("./reminder-core");

const LANGUAGES = new Set(["en", "hi", "kn", "ja"]);

class ChatReminderStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.records = [];
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      this.records = Array.isArray(saved)
        ? saved.filter(record => record && typeof record.id === "string" &&
          typeof record.title === "string" && record.title.length <= 180 &&
          Number.isFinite(Date.parse(record.dueAt)) &&
          ["pending", "fired", "done"].includes(record.status) && LANGUAGES.has(record.language))
          .slice(-1000)
          .map(record => ({
            ...record,
            message: typeof record.message === "string" && record.message.trim()
              ? record.message
              : reminderMessage({ title: record.title }, record.language)
          }))
        : [];
    } catch (_) { this.records = []; }
    return this.records;
  }

  persist(records) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(records), "utf8");
      fs.renameSync(tempPath, this.filePath);
    } catch (error) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
      throw error;
    }
  }

  schedule(parsed, language) {
    if (!parsed || typeof parsed.title !== "string" || parsed.title.length > 180 ||
        !Number.isFinite(Date.parse(parsed.dueAt)) || !LANGUAGES.has(language)) return null;
    this.load();
    const record = {
      id: randomUUID(),
      title: parsed.title,
      message: typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim()
        : reminderMessage({ title: parsed.title }, language),
      dueAt: parsed.dueAt,
      delayMs: parsed.delayMs,
      language,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    const next = [...this.records, record];
    this.persist(next);
    this.records = next;
    return record;
  }

  claimDue(now = new Date()) {
    this.load();
    const timestamp = now.getTime();
    const due = this.records
      .filter(record => record.status === "pending" && Date.parse(record.dueAt) <= timestamp)
      .sort((left, right) => {
        const createdOrder = Date.parse(right.createdAt || "") - Date.parse(left.createdAt || "");
        return Number.isFinite(createdOrder) && createdOrder !== 0
          ? createdOrder
          : Date.parse(left.dueAt) - Date.parse(right.dueAt);
      });
    if (!due.length) return [];
    const dueIds = new Set(due.map(record => record.id));
    const next = this.records.map(record => dueIds.has(record.id)
      ? { ...record, status: "fired", firedAt: now.toISOString() }
      : record);
    this.persist(next);
    this.records = next;
    return due.map(record => ({ ...record, status: "fired", firedAt: now.toISOString() }));
  }

  applyAction(id, action, now = new Date()) {
    this.load();
    const current = this.records.find(record => record.id === id && record.status === "fired");
    if (!current || !["done", "snooze", "later"].includes(action)) return false;
    const next = this.records.map(record => {
      if (record.id !== id) return record;
      if (action === "done") return { ...record, status: "done", completedAt: now.toISOString() };
      const delayMs = action === "snooze" ? 10 * 60_000 : 60 * 60_000;
      return { ...record, status: "pending", dueAt: new Date(now.getTime() + delayMs).toISOString(), delayMs };
    });
    this.persist(next);
    this.records = next;
    return true;
  }
}

module.exports = { ChatReminderStore };