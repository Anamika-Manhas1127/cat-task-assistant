const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("catDesktop", {
  askGemma: (message) => ipcRenderer.invoke("cat:ask-gemma", message),
  openDashboard: () => ipcRenderer.invoke("cat:open-dashboard"),
  closeFloating: () => ipcRenderer.invoke("cat:close-floating"),
  openExternal: (url) => ipcRenderer.invoke("cat:open-external", url),
  syncTasks: (tasks, language) => ipcRenderer.invoke("dashboard:sync-reminders", { tasks, language }),
  reminderAction: (taskId, action) => ipcRenderer.invoke("cat:reminder-action", { taskId, action }),
  onReminder: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, reminder) => callback(reminder);
    ipcRenderer.on("reminder:show", listener);
    ipcRenderer.invoke("cat:renderer-ready").catch(() => {});
    return () => ipcRenderer.removeListener("reminder:show", listener);
  },
  onLanguage: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, language) => callback(language);
    ipcRenderer.on("cat:language", listener);
    return () => ipcRenderer.removeListener("cat:language", listener);
  },
  onReminderAction: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, action) => callback(action);
    ipcRenderer.on("dashboard:reminder-action", listener);
    return () => ipcRenderer.removeListener("dashboard:reminder-action", listener);
  },
  onChatReminderHistory: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, entry) => callback(entry);
    ipcRenderer.on("dashboard:chat-reminder-history", listener);
    return () => ipcRenderer.removeListener("dashboard:chat-reminder-history", listener);
  },
  getLanguage: () => ipcRenderer.invoke("cat:get-language"),
  recognizeSpeech: (language) => ipcRenderer.invoke("cat:speech-recognition", language)
});
