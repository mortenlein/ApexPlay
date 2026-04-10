const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const http = require("http");
const os = require("os");

let win = null;
let socket = null;
let connected = false;
let nextRequestId = 1000;
let pendingResponses = new Map();
let readBuffer = Buffer.alloc(0);
let settingsCache = null;
let logHttpServer = null;
let logEnabled = false;
let logBindPort = 27555;

const DEFAULT_SETTINGS = {
  servers: [
    {
      name: "DatHost CS2",
      host: "sul.ggwp.cc",
      port: 25923,
      publicLogUrl: "",
      serverPassword: "",
      rconPassword: ""
    }
  ],
  lastServerName: "DatHost CS2",
  actions: [
    { name: "Live On", commandScript: "mp_warmup_end", hotkey: "F1", confirm: false, confirmMessage: "Run this command?" },
    { name: "Pause", commandScript: "mp_pause_match", hotkey: "F2", confirm: false, confirmMessage: "Run this command?" },
    { name: "Unpause", commandScript: "mp_unpause_match", hotkey: "F3", confirm: false, confirmMessage: "Run this command?" },
    { name: "Restart Round", commandScript: "mp_restartgame 1", hotkey: "F4", confirm: true, confirmMessage: "Restart current round?" },
    { name: "Tech Timeout CT", commandScript: "say [ADMIN] TECH TIMEOUT CT", hotkey: "Control+1", confirm: false, confirmMessage: "Run this command?" },
    { name: "Tech Timeout T", commandScript: "say [ADMIN] TECH TIMEOUT T", hotkey: "Control+2", confirm: false, confirmMessage: "Run this command?" },
    { name: "Knife Round", commandScript: "say [ADMIN] Knife round live in 10s;mp_restartgame 10", hotkey: "Control+K", confirm: false, confirmMessage: "Run this command?" },
    { name: "End Match", commandScript: "say [ADMIN] Match concluded", hotkey: "Control+E", confirm: true, confirmMessage: "Mark end of match announcement?" }
  ]
};

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
  if (settingsCache) return settingsCache;
  const file = settingsPath();
  try {
    if (!fs.existsSync(file)) {
      settingsCache = { ...DEFAULT_SETTINGS };
      saveSettings(settingsCache);
      return settingsCache;
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    settingsCache = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      servers: Array.isArray(parsed?.servers) && parsed.servers.length > 0 ? parsed.servers : DEFAULT_SETTINGS.servers,
      actions: Array.isArray(parsed?.actions) && parsed.actions.length > 0 ? parsed.actions : DEFAULT_SETTINGS.actions
    };
    return settingsCache;
  } catch {
    settingsCache = { ...DEFAULT_SETTINGS };
    return settingsCache;
  }
}

function saveSettings(settings) {
  settingsCache = settings;
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf-8");
}

function createWindow() {
  win = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#0f1319",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function writePacket(id, type, body) {
  const bodyBuf = Buffer.from(body || "", "utf8");
  const size = 4 + 4 + bodyBuf.length + 2;
  const packet = Buffer.alloc(4 + size);
  packet.writeInt32LE(size, 0);
  packet.writeInt32LE(id, 4);
  packet.writeInt32LE(type, 8);
  bodyBuf.copy(packet, 12);
  packet.writeInt16LE(0, packet.length - 2);
  socket.write(packet);
}

function parsePackets(chunk) {
  readBuffer = Buffer.concat([readBuffer, chunk]);
  while (readBuffer.length >= 4) {
    const size = readBuffer.readInt32LE(0);
    if (size < 10 || size > 65536) {
      readBuffer = Buffer.alloc(0);
      return;
    }
    if (readBuffer.length < 4 + size) return;
    const packet = readBuffer.subarray(4, 4 + size);
    readBuffer = readBuffer.subarray(4 + size);
    const id = packet.readInt32LE(0);
    const type = packet.readInt32LE(4);
    const bodyLen = size - 10;
    const body = bodyLen > 0 ? packet.subarray(8, 8 + bodyLen).toString("utf8") : "";
    if (win) {
      win.webContents.send("rcon-raw", {
        id,
        type,
        body: (body || "").trim()
      });
    }
    const resolver = pendingResponses.get(id);
    if (resolver) {
      resolver({ id, type, body });
      pendingResponses.delete(id);
    } else if (win) {
      win.webContents.send("rcon-log", body.trim());
    }
  }
}

function registerGlobalHotkeys(actions) {
  globalShortcut.unregisterAll();
  actions.forEach((action) => {
    if (!action.hotkey) return;
    globalShortcut.register(action.hotkey, () => {
      if (win) win.webContents.send("trigger-action-hotkey", action.name);
    });
  });
}

ipcMain.handle("settings:load", async () => {
  const settings = loadSettings();
  registerGlobalHotkeys(settings.actions || []);
  return settings;
});

ipcMain.handle("settings:save", async (_event, settings) => {
  saveSettings(settings);
  registerGlobalHotkeys(settings.actions || []);
  return { ok: true };
});

ipcMain.handle("rcon:connect", async (_event, profile) => {
  if (connected) {
    return { ok: true, message: "Already connected." };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      emitDebug(`connect finished: ${payload.ok ? "ok" : `error=${payload.error || "unknown"}`}`);
      resolve(payload);
    };
    const hardTimeout = setTimeout(() => {
      emitDebug("hard timeout hit while connecting.");
      if (socket) {
        socket.destroy();
      }
      connected = false;
      finish({ ok: false, error: "Connect timeout (no TCP/auth response)." });
    }, 10000);

    socket = new net.Socket();
    readBuffer = Buffer.alloc(0);
    pendingResponses = new Map();

    socket.setTimeout(5000);
    socket.connect(profile.port, profile.host, async () => {
      try {
        emitDebug(`tcp connected to ${profile.host}:${profile.port}`);
        const authId = ++nextRequestId;
        const authResponse = new Promise((res) => pendingResponses.set(authId, res));
        writePacket(authId, 3, profile.rconPassword || "");
        emitDebug("auth packet sent");
        const first = await Promise.race([
          authResponse,
          new Promise((_, reject) => setTimeout(() => reject(new Error("RCON auth timeout.")), 5000))
        ]);

        if (first.id === -1) {
          socket.destroy();
          connected = false;
          clearTimeout(hardTimeout);
          finish({ ok: false, error: "RCON authentication failed." });
          return;
        }
        connected = true;
        // Disable idle timeout after successful auth; command-level timeouts are handled separately.
        socket.setTimeout(0);
        clearTimeout(hardTimeout);
        finish({ ok: true });
      } catch (error) {
        connected = false;
        clearTimeout(hardTimeout);
        finish({ ok: false, error: String(error?.message || error) });
      }
    });

    socket.on("data", parsePackets);
    socket.on("close", () => {
      connected = false;
      clearTimeout(hardTimeout);
      emitDebug("socket closed");
      if (win) win.webContents.send("rcon-state", { connected: false });
    });
    socket.on("timeout", () => {
      if (socket) {
        socket.destroy();
      }
      connected = false;
      clearTimeout(hardTimeout);
      emitDebug("socket timeout event");
      finish({ ok: false, error: "Socket timeout while connecting/authenticating." });
    });
    socket.on("error", (err) => {
      connected = false;
      clearTimeout(hardTimeout);
      emitDebug(`socket error: ${err.message}`);
      finish({ ok: false, error: err.message });
    });
  });
});

ipcMain.handle("rcon:disconnect", async () => {
  if (socket) {
    socket.destroy();
    socket = null;
  }
  connected = false;
  return { ok: true };
});

ipcMain.handle("rcon:send", async (_event, command) => {
  if (!connected || !socket) return { ok: false, error: "Not connected." };
  const id = ++nextRequestId;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingResponses.delete(id);
      resolve({ ok: false, error: "Command timeout." });
    }, 1200);

    pendingResponses.set(id, (packet) => {
      clearTimeout(timeout);
      resolve({ ok: true, output: (packet.body || "").trim() });
    });

    writePacket(id, 2, command);
  });
});

ipcMain.handle("app:state", async () => ({ connected }));
ipcMain.handle("app:ping", async () => ({ ok: true, ts: Date.now() }));

ipcMain.handle("log:start", async (_event, opts) => {
  const requestedPort = Number(opts?.port || logBindPort);
  logBindPort = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 27555;

  if (logHttpServer) {
    try {
      logHttpServer.close();
    } catch {
      // ignore
    }
    logHttpServer = null;
  }

  logHttpServer = http.createServer((req, res) => {
    if (req.method === "POST") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8").trim();
        if (body && win) {
          win.webContents.send("log-line", body);
        }
        try {
          const parsed = body ? JSON.parse(body) : null;
          if (parsed?.event) {
            emitDebug(`webhook received event=${parsed.event}`);
          } else {
            emitDebug("webhook received payload");
          }
        } catch {
          if (body) {
            emitDebug("webhook received text payload");
          }
        }
        maybeEmitChatFromLog(body);
        res.statusCode = 200;
        res.end("ok");
      });
      return;
    }

    res.statusCode = 200;
    res.end("ok");
  });
  logHttpServer.on("error", (err) => {
    emitDebug(`http log listener error: ${err.message}`);
    logEnabled = false;
  });

  await new Promise((resolve, reject) => {
    logHttpServer.listen(logBindPort, "0.0.0.0", () => resolve());
    logHttpServer.once("error", reject);
  }).catch((err) => {
    emitDebug(`failed to bind http log port ${logBindPort}: ${err.message}`);
    throw err;
  });

  logEnabled = true;
  const localIp = getBestLocalIpv4();
  const endpointUrl = `http://${localIp}:${logBindPort}/logs`;
  emitDebug(`http log listener started on 0.0.0.0:${logBindPort}, endpoint=${endpointUrl}`);
  return { ok: true, port: logBindPort, localIp, endpointUrl };
});

ipcMain.handle("log:stop", async () => {
  if (logHttpServer) {
    try {
      logHttpServer.close();
    } catch {
      // ignore
    }
    logHttpServer = null;
  }
  logEnabled = false;
  emitDebug("http log listener stopped");
  return { ok: true };
});

ipcMain.handle("log:state", async () => ({
  enabled: logEnabled,
  port: logBindPort,
  localIp: getBestLocalIpv4()
}));

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  if (process.platform !== "darwin") app.quit();
});
function emitDebug(message) {
  if (win) {
    win.webContents.send("rcon-debug", `[main] ${message}`);
  }
}

function getBestLocalIpv4() {
  const interfaces = os.networkInterfaces();
  for (const values of Object.values(interfaces)) {
    for (const iface of values || []) {
      if (iface && iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

function emitChatLine(line) {
  if (win) {
    win.webContents.send("chat-line", line);
  }
}

function maybeEmitChatFromLog(line) {
  const text = String(line || "").trim();
  if (!text) return;

  const quoted = text.match(/"([^"]+)<\d+><[^>]*><[^>]*>"\s+say\s+"(.+)"$/i);
  if (quoted) {
    emitChatLine(`${quoted[1]}: ${quoted[2]}`);
    return;
  }

  const rawSay = text.match(/L\s+\d+\/\d+\/\d+\s+-\s+\d+:\d+:\d+:\s+(.+?)\s+say\s+(.+)$/i);
  if (rawSay) {
    emitChatLine(`${rawSay[1]}: ${rawSay[2].replace(/^"|"$/g, "")}`);
    return;
  }

  const loose = text.match(/say:\s*(.+)$/i);
  if (loose) {
    emitChatLine(loose[1]);
  }
}
