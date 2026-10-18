"use strict";

class ReminderDelivery {
  constructor({ getWindow, ensureWindow, notify, isRendererReady }) {
    this.getWindow = getWindow;
    this.ensureWindow = ensureWindow;
    this.notify = notify;
    this.isRendererReady = typeof isRendererReady === "function" ? isRendererReady : null;
    this.pending = [];
    this.delivered = new Set();
  }

  deliver(reminder, occurrenceKey = `${reminder.id}:${reminder.dueAt || "once"}`) {
    if (!reminder || typeof reminder.id !== "string" || typeof reminder.message !== "string") return false;
    if (this.delivered.has(occurrenceKey)) return false;
    this.delivered.add(occurrenceKey);
    try { this.notify(reminder); } catch (_) {}

    const window = this.getWindow();
    if (!this.isReady(window)) {
      this.pending.push(reminder);
      this.ensureWindow();
      return true;
    }
    this.present(window, reminder);
    return true;
  }

  flush(window = this.getWindow()) {
    if (!this.isReady(window) || this.pending.length === 0) return 0;
    const pending = this.pending.splice(0);
    for (const reminder of pending) this.present(window, reminder);
    return pending.length;
  }

  isReady(window) {
    if (!window || (typeof window.isDestroyed === "function" && window.isDestroyed())) return false;
    if (this.isRendererReady) {
      return Boolean(this.isRendererReady());
    }
    if (typeof window.webContents?.isLoading === "function" && window.webContents.isLoading()) {
      return false;
    }
    return true;
  }

  present(window, reminder) {
    if (window.isMinimized()) window.restore();
    window.setAlwaysOnTop(true, "floating");
    window.showInactive();
    window.moveTop();
    window.webContents.send("reminder:show", reminder);
  }
}

module.exports = { ReminderDelivery };
