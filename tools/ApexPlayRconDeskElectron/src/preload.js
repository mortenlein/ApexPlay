const { contextBridge, ipcRenderer, clipboard } = require("electron");

contextBridge.exposeInMainWorld("deskApi", {
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  connect: (profile) => ipcRenderer.invoke("rcon:connect", profile),
  disconnect: () => ipcRenderer.invoke("rcon:disconnect"),
  send: (command) => ipcRenderer.invoke("rcon:send", command),
  startLogListener: (opts) => ipcRenderer.invoke("log:start", opts),
  stopLogListener: () => ipcRenderer.invoke("log:stop"),
  logState: () => ipcRenderer.invoke("log:state"),
  state: () => ipcRenderer.invoke("app:state"),
  ping: () => ipcRenderer.invoke("app:ping"),
  copyText: (value) => clipboard.writeText(value),
  onLog: (handler) => ipcRenderer.on("rcon-log", (_e, line) => handler(line)),
  onRaw: (handler) => ipcRenderer.on("rcon-raw", (_e, packet) => handler(packet)),
  onDebug: (handler) => ipcRenderer.on("rcon-debug", (_e, line) => handler(line)),
  onLogLine: (handler) => ipcRenderer.on("log-line", (_e, line) => handler(line)),
  onChatLine: (handler) => ipcRenderer.on("chat-line", (_e, line) => handler(line)),
  onState: (handler) => ipcRenderer.on("rcon-state", (_e, state) => handler(state)),
  onHotkeyAction: (handler) => ipcRenderer.on("trigger-action-hotkey", (_e, actionName) => handler(actionName))
});
