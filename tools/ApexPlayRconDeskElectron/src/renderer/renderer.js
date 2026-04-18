const state = {
  settings: null,
  connected: false,
  pollTimer: null,
  lastPlayers: [],
  chatListenerEnabled: false,
  chatListenerPort: 27555,
  playerSides: {},
  playerSidesBySteamId: {},
  lastSnapshotFeedAt: 0
};

const MAX_ACTION_LOG_ITEMS = 300;
const MAX_EVENT_FEED_ITEMS = 300;

function trimList(listElement, maxItems) {
  if (!listElement) return;
  while (listElement.children.length > maxItems) {
    listElement.removeChild(listElement.lastElementChild);
  }
}

const els = {
  serverSelect: document.getElementById("serverSelect"),
  addServerBtn: document.getElementById("addServerBtn"),
  saveServerBtn: document.getElementById("saveServerBtn"),
  deleteServerBtn: document.getElementById("deleteServerBtn"),
  hostInput: document.getElementById("hostInput"),
  portInput: document.getElementById("portInput"),
  publicLogUrlInput: document.getElementById("publicLogUrlInput"),
  detectPublicIpBtn: document.getElementById("detectPublicIpBtn"),
  serverPasswordInput: document.getElementById("serverPasswordInput"),
  rconPasswordInput: document.getElementById("rconPasswordInput"),
  connectBtn: document.getElementById("connectBtn"),
  disconnectBtn: document.getElementById("disconnectBtn"),
  actionsGrid: document.getElementById("actionsGrid"),
  hotkeyHint: document.getElementById("hotkeyHint"),
  macroInput: document.getElementById("macroInput"),
  runMacroBtn: document.getElementById("runMacroBtn"),
  logList: document.getElementById("logList"),
  eventFeed: document.getElementById("eventFeed"),
  manualInput: document.getElementById("manualInput"),
  sendManualBtn: document.getElementById("sendManualBtn"),
  copyJoinLinkBtn: document.getElementById("copyJoinLinkBtn"),
  togglePollBtn: document.getElementById("togglePollBtn"),
  connectionBadge: document.getElementById("connectionBadge"),
  refreshStatusBtn: document.getElementById("refreshStatusBtn"),
  overviewUpdated: document.getElementById("overviewUpdated"),
  ovHostname: document.getElementById("ovHostname"),
  ovMap: document.getElementById("ovMap"),
  ovIp: document.getElementById("ovIp"),
  ovPlayers: document.getElementById("ovPlayers"),
  playersCtBody: document.getElementById("playersCtBody"),
  playersTBody: document.getElementById("playersTBody"),
  playersUnknownBody: document.getElementById("playersUnknownBody"),
  ctNameInput: document.getElementById("ctNameInput"),
  tNameInput: document.getElementById("tNameInput"),
  setCtNameBtn: document.getElementById("setCtNameBtn"),
  setTNameBtn: document.getElementById("setTNameBtn"),
  setBothNamesBtn: document.getElementById("setBothNamesBtn"),
  startChatBtn: document.getElementById("startChatBtn"),
  stopChatBtn: document.getElementById("stopChatBtn"),
  openChatWinBtn: document.getElementById("openChatWinBtn"),
  logPortInput: document.getElementById("logPortInput")
};

function addLog(line) {
  if (!els.logList) {
    console.log(line);
    return;
  }
  const li = document.createElement("li");
  li.textContent = `[${new Date().toLocaleTimeString()}] ${line}`;
  els.logList.prepend(li);
  trimList(els.logList, MAX_ACTION_LOG_ITEMS);
}

function shouldHideFeedLine(line) {
  const text = String(line || "").toLowerCase();
  return text.includes("loaded spawngroup(") || text.includes("---------spawngroups----");
}

function compactLine(line, max = 260) {
  const normalized = String(line || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

function addFeed(kind, line) {
  if (!els.eventFeed) return;
  if (shouldHideFeedLine(line)) return;
  const li = document.createElement("li");
  li.className = "feed-item";
  li.innerHTML = `<span class="feed-kind">${kind}</span><span class="feed-text">${escapeHtml(compactLine(line))}</span>`;
  els.eventFeed.prepend(li);
  trimList(els.eventFeed, MAX_EVENT_FEED_ITEMS);
}

function currentProfile() {
  if (!state.settings) return null;
  const index = Number(els.serverSelect.value);
  return state.settings.servers[index] || null;
}

function updateProfileInputs(profile) {
  if (!profile) return;
  els.hostInput.value = profile.host || "";
  els.portInput.value = profile.port || 27015;
  els.publicLogUrlInput.value = profile.publicLogUrl || "";
  els.serverPasswordInput.value = profile.serverPassword || "";
  els.rconPasswordInput.value = profile.rconPassword || "";
}

function saveProfileInputs() {
  const profile = currentProfile();
  if (!profile) return;
  profile.host = els.hostInput.value.trim();
  profile.port = Number(els.portInput.value || 27015);
  profile.publicLogUrl = els.publicLogUrlInput.value.trim();
  profile.serverPassword = els.serverPasswordInput.value;
  profile.rconPassword = els.rconPasswordInput.value;
}

async function persistSettings() {
  saveProfileInputs();
  const profile = currentProfile();
  if (profile) state.settings.lastServerName = profile.name;
  await window.deskApi.saveSettings(state.settings);
}

function renderServerSelect() {
  els.serverSelect.innerHTML = "";
  state.settings.servers.forEach((server, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = `${server.name} (${server.host}:${server.port})`;
    els.serverSelect.appendChild(opt);
  });

  let idx = state.settings.servers.findIndex((s) => s.name === state.settings.lastServerName);
  if (idx < 0) idx = 0;
  els.serverSelect.value = String(idx);
  updateProfileInputs(currentProfile());
}

function normalizeHotkey(value) {
  return String(value || "").replace(/\s+/g, "");
}

function renderActions() {
  els.actionsGrid.innerHTML = "";
  const hint = [];
  state.settings.actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.className = "action-btn";
    btn.innerHTML = `
      <span class="action-name">${action.name}</span>
      <span class="action-hotkey">${action.hotkey || ""}</span>
      <span class="action-command">${action.commandScript || ""}</span>
    `;
    btn.addEventListener("click", () => runAction(action));
    els.actionsGrid.appendChild(btn);
    els.actionsGrid.appendChild(btn);
  });
  els.hotkeyHint.textContent = "Global hotkeys disabled";
}

function parseScript(script) {
  return String(script || "")
    .split(/[\n\r;]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function sendCommand(command) {
  if (!state.connected) {
    addLog("Not connected.");
    return;
  }
  addLog(`> ${command}`);
  const normalizedCommand = String(command || "").trim().toLowerCase();
  const isStatusCommand = normalizedCommand.startsWith("status");
  if (!isStatusCommand) {
    addFeed("cmd", command);
  }
  const res = await window.deskApi.send(command);
  if (!res.ok) {
    addLog(`Error: ${res.error}`);
    addFeed("error", res.error || "Command failed");
  } else if (res.output) {
    if (!isStatusCommand) {
      addLog(compactLine(res.output, 180));
      addFeed("rcon", res.output);
    }
    maybeParseStatusOutput(command, res.output);
  }
  return res;
}

async function runScript(name, script, confirm, confirmMessage) {
  if (confirm) {
    const ok = window.confirm(confirmMessage || `Run ${name}?`);
    if (!ok) return;
  }
  const commands = parseScript(script);
  if (!commands.length) return;
  addLog(`Running: ${name}`);
  for (const command of commands) {
    await sendCommand(command);
  }
  addLog(`Completed: ${name}`);
}

async function runAction(action) {
  await runScript(action.name, action.commandScript, action.confirm, action.confirmMessage);
}

function setConnected(connected) {
  state.connected = Boolean(connected);
  els.connectBtn.disabled = state.connected;
  els.disconnectBtn.disabled = !state.connected;
  if (els.connectionBadge) {
    els.connectionBadge.textContent = state.connected ? "Online" : "Offline";
    els.connectionBadge.classList.toggle("online", state.connected);
    els.connectionBadge.classList.toggle("offline", !state.connected);
  }
  if (!state.connected && state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
    els.togglePollBtn.textContent = "Start Poll";
  }
}

function buildJoinLink(profile) {
  const host = profile.host || "";
  const port = profile.port || 27015;
  const pw = profile.serverPassword || "";
  return pw ? `steam://connect/${host}:${port}/${pw}` : `steam://connect/${host}:${port}`;
}

async function startChatListener() {
  const requestedPort = Number(els.logPortInput.value || state.chatListenerPort || 27555);
  const res = await window.deskApi.startLogListener({ port: requestedPort });
  if (!res?.ok) {
    addLog("Failed to start chat listener.");
    return null;
  }
  state.chatListenerEnabled = true;
  state.chatListenerPort = res.port;
  els.logPortInput.value = String(res.port);
  addLog(`Chat listener started on HTTP ${res.localIp}:${res.port}`);
  addFeed("system", `Listener started on ${res.localIp}:${res.port}`);
  return res;
}

async function stopChatListener() {
  await window.deskApi.stopLogListener();
  state.chatListenerEnabled = false;
  addLog("Chat listener stopped.");
  addFeed("system", "Listener stopped");
}

async function enableServerChatForwarding() {
  if (!state.connected) {
    addLog("Connect first before enabling chat feed.");
    return;
  }
  const listener = await startChatListener();
  if (!listener) return;

  // CS2 server log forwarding via HTTP. Requires server to reach this listener endpoint.
  await sendCommand(`log on`);
  await sendCommand(`mp_logdetail 3`);
  await sendCommand(`sv_logchat 1`);
  await sendCommand(`sv_logecho 1`);
  
  const profile = currentProfile();
  const override = profile?.publicLogUrl?.trim();
  const endpoint = override || listener.endpointUrl;
  
  const isLocalIp = listener.localIp.startsWith("192.168.") || listener.localIp.startsWith("10.") || listener.localIp.startsWith("172.");
  const isRemoteServer = profile?.host && !profile.host.startsWith("192.168.") && !profile.host.startsWith("127.0.0.1") && !profile.host.startsWith("localhost");
  
  if (isLocalIp && isRemoteServer && !override) {
    addLog("WARNING: You are sending a local IP to a remote server. The server won't be able to reach your PC.");
    addLog("Please use a Public IP or Ngrok in the 'Public Log URL' field.");
  }

  await sendCommand(`logaddress_add_http "${endpoint}"`);
  addLog(`Requested server log forwarding to ${endpoint}`);
  addFeed("system", `Requested log forwarding to ${endpoint}`);
  if (override) {
    addLog("Using Public Log URL override from profile.");
  } else {
    addLog("Using auto-detected local listener URL.");
  }
  addLog("If chat remains empty, use a public/tunneled URL reachable by the game server.");
}

function parseStatusOutput(text) {
  const source = String(text || "").replace(/\r/g, " ");
  const hostname = source.match(/hostname\s*:\s*(.+?)(?=\s+(spawn|version|secure|public)\s*:|$)/i)?.[1]?.trim() || "-";
  const map =
    source.match(/spawngroup\(\s*1\)\s*:\s*SV:\s*\[\s*1:\s*([^\s|]+)\s*\|/i)?.[1]?.trim() ||
    source.match(/map\s*:\s*([^\s]+)/i)?.[1]?.trim() ||
    "-";
  const ip = source.match(/udp\/ip\s*:\s*([0-9.:]+)/i)?.[1]?.trim() || "-";
  const playersInfo = source.match(/players\s*:\s*(\d+)\s+humans,\s*(\d+)\s+bots\s+\((\d+)\s+max\)/i);
  const playersSummary = playersInfo
    ? `${playersInfo[1]} humans, ${playersInfo[2]} bots / ${playersInfo[3]} max`
    : "-";

  const players = [];
  const rowRegex = /(\d+)\s+([\d:]+)\s+(\d+)\s+(\d+)\s+([A-Za-z_]+)\s+(\d+)\s+([^\s]+)\s+'([^']*)'/g;
  let match;
  while ((match = rowRegex.exec(source)) !== null) {
    const id = Number(match[1]);
    const name = (match[8] || "").trim();
    if (!name || id === 65535) continue;
    players.push({
      id,
      time: match[2],
      ping: Number(match[3]),
      loss: Number(match[4]),
      state: match[5],
      rate: Number(match[6]),
      address: match[7],
      name
    });
  }

  return { hostname, map, ip, playersSummary, players };
}

function renderTeamBody(target, players, emptyText) {
  if (!players.length) {
    target.innerHTML = `<tr><td colspan="5" class="muted">${emptyText}</td></tr>`;
    return;
  }
  target.innerHTML = players
    .map((p) => `<tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${Number.isFinite(Number(p.kills)) ? Number(p.kills) : "-"}</td>
      <td>${Number.isFinite(Number(p.assists)) ? Number(p.assists) : "-"}</td>
      <td>${Number.isFinite(Number(p.deaths)) ? Number(p.deaths) : "-"}</td>
      <td>${Number.isFinite(p.ping) ? p.ping : "-"}</td>
    </tr>`)
    .join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderUnknownBody(players) {
  if (!players.length) {
    els.playersUnknownBody.innerHTML = `<tr><td colspan="4" class="muted">No unknown players.</td></tr>`;
    return;
  }

  els.playersUnknownBody.innerHTML = players
    .map((p) => {
      const safeName = escapeHtml(p.name);
      const encodedName = encodeURIComponent(p.name);
      return `<tr>
        <td>${safeName}</td>
        <td>${escapeHtml(normalizeSide(p.team) || "UNK")}</td>
        <td>${Number.isFinite(p.ping) ? p.ping : "-"}</td>
        <td>
          <span class="side-assign">
            <button class="mini-btn assign-btn" data-side="CT" data-name="${encodedName}">CT</button>
            <button class="mini-btn assign-btn" data-side="T" data-name="${encodedName}">T</button>
          </span>
        </td>
      </tr>`;
    })
    .join("");
}

function renderPlayers(players) {
  const ct = [];
  const t = [];
  const unknown = [];

  for (const player of players || []) {
    const side =
      normalizeSide(player.team) ||
      state.playerSidesBySteamId[player.steamId] ||
      state.playerSides[player.name];
    if (side === "CT") ct.push(player);
    else if (side === "T") t.push(player);
    else unknown.push(player);
  }

  renderTeamBody(els.playersCtBody, ct, "No CT players.");
  renderTeamBody(els.playersTBody, t, "No T players.");
  renderUnknownBody(unknown);
}

function normalizeSide(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric === 3) return "CT";
    if (numeric === 2) return "T";
  }
  const token = String(value || "")
    .toUpperCase()
    .replaceAll('"', "")
    .replaceAll(" ", "");
  if (
    token === "CT" ||
    token === "CTS" ||
    token === "COUNTER-TERRORIST" ||
    token === "COUNTERTERRORIST" ||
    token === "COUNTER-TERRORISTS" ||
    token === "COUNTERTERRORISTS"
  ) return "CT";
  if (token === "T" || token === "TS" || token === "TERRORIST" || token === "TERRORISTS") return "T";
  return "";
}

function applyWebhookPayload(line) {
  let payload = null;
  try {
    payload = JSON.parse(String(line || "").trim());
  } catch {
    return false;
  }
  if (!payload || typeof payload !== "object" || !payload.event) {
    return false;
  }

  if (payload.event === "player_snapshot") {
    const rows = Array.isArray(payload.players) ? payload.players : [];
    const mapped = rows.map((row) => {
      const name = String(row?.name || row?.steamId || row?.steamid || "Unknown");
      const steamId = String(row?.steamId || row?.steamid || "");
      const side = normalizeSide(row?.team);
      if (side) {
        state.playerSides[name] = side;
      }
      if (steamId && side) {
        state.playerSidesBySteamId[steamId] = side;
      }
      return {
        id: steamId || name,
        steamId,
        name,
        ping: Number.isFinite(Number(row?.ping)) ? Number(row?.ping) : Number.NaN,
        kills: Number(row?.kills || 0),
        assists: Number(row?.assists || 0),
        deaths: Number(row?.deaths || 0),
        state: "",
        team: side || "UNKNOWN"
      };
    });
    state.lastPlayers = mapped;
    renderPlayers(state.lastPlayers);
    els.ovPlayers.textContent = `${mapped.length} live (webhook)`;
    if (payload.matchId || payload.tournamentId) {
      const parts = [];
      if (payload.matchId) parts.push(`match ${payload.matchId}`);
      if (payload.tournamentId) parts.push(`tournament ${payload.tournamentId}`);
      els.ovMap.textContent = parts.join(" | ");
    }
    els.overviewUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    const now = Date.now();
    if (now - state.lastSnapshotFeedAt > 8000) {
      state.lastSnapshotFeedAt = now;
      addFeed("snapshot", `${mapped.length} players (${mapped.filter((p) => normalizeSide(p.team) === "CT").length} CT / ${mapped.filter((p) => normalizeSide(p.team) === "T").length} T)`);
    }
    return true;
  }

  if (payload.event === "team_change") {
    const steamId = String(payload.player?.steamId || payload.player?.steamid || "");
    const side = normalizeSide(payload.player?.team || payload.player?.teamNum);
    if (steamId && side) {
      state.playerSidesBySteamId[steamId] = side;
      const existing = (state.lastPlayers || []).find((p) => p.steamId === steamId);
      if (existing) {
        existing.team = side;
      }
      renderPlayers(state.lastPlayers || []);
      addLog(`Team change: ${steamId} -> ${side}`);
      addFeed("team", `${steamId} -> ${side}`);
    }
    return true;
  }

  if (payload.event === "player_death") {
    const attacker = payload.attacker?.steamId || payload.attacker?.steamid || "unknown";
    const victim = payload.victim?.steamId || payload.victim?.steamid || "unknown";
    addLog(`Kill event: ${attacker} -> ${victim}`);
    addFeed("kill", `${attacker} -> ${victim}`);
    return true;
  }

  return true;
}

function inferPlayerSideFromLine(line) {
  const text = String(line || "");

  const patterns = [
    /"([^"]+)<[^>]+><[^>]*><[^>]*>"\s+joined team\s+"?(CT|T|COUNTER-TERRORIST|TERRORIST)"?/i,
    /"([^"]+)<[^>]+><[^>]*><[^>]*>"\s+switched from team\s+"?[^"]+"?\s+to\s+"?(CT|T|COUNTER-TERRORIST|TERRORIST)"?/i,
    /"([^"]+)<[^>]+><[^>]*><[^>]*>"\s+joined team\s+([A-Z-]+)/i,
    /player\s+"?([^"<]+)"?\s+joined team\s+"?([A-Z-]+)"?/i,
    /player\s+"?([^"<]+)"?\s+switched team\s+to\s+"?([A-Z-]+)"?/i,
    /"([^"]+)"\s+joined team\s+"?([A-Z-]+)"?/i
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const name = m[1]?.trim();
    const normalized = normalizeSide(m[2]);
    if (!name || !normalized) continue;
    state.playerSides[name] = normalized;
    addLog(`Detected side: ${name} -> ${normalized}`);
    return true;
  }
  return false;
}

function maybeParseStatusOutput(command, output) {
  const normalized = String(command || "").trim().toLowerCase();
  if (!normalized.startsWith("status")) {
    return;
  }

  const parsed = parseStatusOutput(output);
  els.ovHostname.textContent = parsed.hostname;
  els.ovMap.textContent = parsed.map;
  els.ovIp.textContent = parsed.ip;
  els.ovPlayers.textContent = parsed.playersSummary;
  els.overviewUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  for (const p of parsed.players) {
    p.kills = null;
    p.assists = null;
    p.deaths = null;
  }
  renderPlayers(parsed.players);

  const prev = new Set((state.lastPlayers || []).map((p) => p.name));
  const next = new Set(parsed.players.map((p) => p.name));
  const joined = [...next].filter((name) => !prev.has(name));
  const left = [...prev].filter((name) => !next.has(name));
  joined.forEach((name) => addLog(`Player joined server: ${name}`));
  left.forEach((name) => addLog(`Player left server: ${name}`));
  state.lastPlayers = parsed.players;
}

function startStatusPolling(intervalMs = 5000) {
  if (!state.connected || state.pollTimer) return;
  state.pollTimer = setInterval(() => {
    void sendCommand("status");
  }, intervalMs);
  els.togglePollBtn.textContent = "Stop Poll";
  void sendCommand("status");
  addLog(`Started server polling: status every ${Math.round(intervalMs / 1000)}s.`);
}

function bindUi() {
  els.serverSelect.addEventListener("change", () => {
    updateProfileInputs(currentProfile());
  });

  els.addServerBtn.addEventListener("click", async () => {
    const name = window.prompt("Server profile name", `Server ${state.settings.servers.length + 1}`);
    if (!name) return;
    state.settings.servers.push({
      name,
      host: "127.0.0.1",
      port: 27015,
      publicLogUrl: "",
      serverPassword: "",
      rconPassword: ""
    });
    state.settings.lastServerName = name;
    renderServerSelect();
    await persistSettings();
    addLog(`Added profile: ${name}`);
  });

  els.saveServerBtn.addEventListener("click", async () => {
    await persistSettings();
    renderServerSelect();
    addLog("Profile saved.");
  });

  els.deleteServerBtn.addEventListener("click", async () => {
    const idx = Number(els.serverSelect.value);
    const profile = currentProfile();
    if (!profile) return;
    if (!window.confirm(`Delete profile "${profile.name}"?`)) return;
    state.settings.servers.splice(idx, 1);
    if (!state.settings.servers.length) {
      state.settings.servers.push({
        name: "Server 1",
        host: "127.0.0.1",
        port: 27015,
        publicLogUrl: "",
        serverPassword: "",
        rconPassword: ""
      });
    }
    state.settings.lastServerName = state.settings.servers[0].name;
    renderServerSelect();
    await persistSettings();
    addLog("Profile deleted.");
  });

  els.connectBtn.addEventListener("click", async () => {
    try {
      addLog("Connect clicked.");
      const profile = currentProfile();
      if (!profile) {
        addLog("No server profile selected.");
        return;
      }
      saveProfileInputs();
      await persistSettings();
      addLog(`Connecting to ${profile.host}:${profile.port} ...`);
      const res = await window.deskApi.connect(profile);
      if (!res.ok) {
        addLog(`Connect failed: ${res.error || "Unknown error"}`);
        setConnected(false);
        return;
      }
      addLog("Connected.");
      setConnected(true);
      startStatusPolling(5000);
    } catch (error) {
      addLog(`Connect exception: ${error?.message || error}`);
      setConnected(false);
    }
  });

  els.disconnectBtn.addEventListener("click", async () => {
    try {
      await window.deskApi.disconnect();
      setConnected(false);
      addLog("Disconnected.");
    } catch (error) {
      addLog(`Disconnect exception: ${error?.message || error}`);
    }
  });

  els.runMacroBtn.addEventListener("click", async () => {
    await runScript("Macro", els.macroInput.value, false, "");
  });

  els.sendManualBtn.addEventListener("click", async () => {
    const cmd = els.manualInput.value.trim();
    if (!cmd) return;
    els.manualInput.value = "";
    await runScript("Manual", cmd, false, "");
  });

  els.manualInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const cmd = els.manualInput.value.trim();
      if (!cmd) return;
      els.manualInput.value = "";
      await runScript("Manual", cmd, false, "");
    }
  });

  els.copyJoinLinkBtn.addEventListener("click", async () => {
    const profile = currentProfile();
    if (!profile) return;
    saveProfileInputs();
    await persistSettings();
    const join = buildJoinLink(profile);
    window.deskApi.copyText(join);
    addLog("Copied join link to clipboard.");
  });

  els.startChatBtn.addEventListener("click", async () => {
    await enableServerChatForwarding();
  });

  els.stopChatBtn.addEventListener("click", async () => {
    await stopChatListener();
  });

  els.openChatWinBtn.addEventListener("click", async () => {
    await window.deskApi.openChat();
  });

  els.detectPublicIpBtn.addEventListener("click", async () => {
    els.detectPublicIpBtn.disabled = true;
    els.detectPublicIpBtn.textContent = "...";
    try {
      const ip = await window.deskApi.getPublicIp();
      if (ip) {
        els.publicLogUrlInput.value = `http://${ip}:${els.logPortInput.value || 27555}/logs`;
        addLog(`Detected public IP: ${ip}`);
      } else {
        addLog("Failed to detect public IP. Check your internet connection.");
      }
    } finally {
      els.detectPublicIpBtn.disabled = false;
      els.detectPublicIpBtn.textContent = "Detect";
    }
  });

  els.togglePollBtn.addEventListener("click", async () => {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
      els.togglePollBtn.textContent = "Start Poll";
      addLog("Stopped server polling.");
      return;
    }

    if (!state.connected) {
      addLog("Connect first before starting poll.");
      return;
    }

    startStatusPolling(5000);
  });

  els.refreshStatusBtn.addEventListener("click", async () => {
    await sendCommand("status");
  });

  els.playersUnknownBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("assign-btn")) return;
    const side = target.getAttribute("data-side");
    const encodedName = target.getAttribute("data-name");
    if (!side || !encodedName) return;
    const name = decodeURIComponent(encodedName);
    state.playerSides[name] = side;
    addLog(`Manual side set: ${name} -> ${side}`);
    renderPlayers(state.lastPlayers || []);
  });

  els.setCtNameBtn.addEventListener("click", async () => {
    const value = els.ctNameInput.value.trim();
    if (!value) return;
    await sendCommand(`mp_teamname_1 "${value.replaceAll('"', '\\"')}"`);
    addLog(`Set CT name: ${value}`);
  });

  els.setTNameBtn.addEventListener("click", async () => {
    const value = els.tNameInput.value.trim();
    if (!value) return;
    await sendCommand(`mp_teamname_2 "${value.replaceAll('"', '\\"')}"`);
    addLog(`Set T name: ${value}`);
  });

  els.setBothNamesBtn.addEventListener("click", async () => {
    const ct = els.ctNameInput.value.trim();
    const t = els.tNameInput.value.trim();
    if (ct) {
      await sendCommand(`mp_teamname_1 "${ct.replaceAll('"', '\\"')}"`);
      addLog(`Set CT name: ${ct}`);
    }
    if (t) {
      await sendCommand(`mp_teamname_2 "${t.replaceAll('"', '\\"')}"`);
      addLog(`Set T name: ${t}`);
    }
  });

  window.addEventListener("keydown", async (event) => {
    // Local hotkeys disabled as per user request
  });
}

async function init() {
  state.settings = await window.deskApi.loadSettings();
  renderServerSelect();
  renderActions();
  bindUi();

  const ping = await window.deskApi.ping();
  addLog(`IPC ready (${new Date(ping.ts).toLocaleTimeString()}).`);

  const appState = await window.deskApi.state();
  setConnected(Boolean(appState.connected));
  const logState = await window.deskApi.logState();
  if (logState?.port) {
    state.chatListenerPort = logState.port;
    els.logPortInput.value = String(logState.port);
  }
  if (!logState?.enabled) {
    const started = await startChatListener();
    if (started?.ok) {
      addLog("Webhook listener auto-started.");
    }
  } else {
    state.chatListenerEnabled = true;
    addLog(`Webhook listener active on port ${logState.port}.`);
  }

  window.deskApi.onLog((line) => {
    if (line) {
      addLog(line);
      // Fallback: If the server is streaming logs over RCON, check for chat
      if (line.toLowerCase().includes(" say ")) {
        maybeEmitChatFromLog(line);
      }
    }
  });
  window.deskApi.onDebug((line) => {
    if (line) addLog(line);
  });
  window.deskApi.onLogLine((line) => {
    if (line) {
      if (applyWebhookPayload(line)) {
        return;
      }
      addFeed("log", line);
      if (inferPlayerSideFromLine(line)) {
        renderPlayers(state.lastPlayers || []);
      }
    }
  });
  window.deskApi.onChatLine((line) => {
    if (line) addFeed("chat", line);
  });
  window.deskApi.onRaw((packet) => {
    // Intentionally quiet: raw packet stream is high-volume and can degrade UI responsiveness.
    void packet;
  });
  window.deskApi.onState((nextState) => setConnected(Boolean(nextState?.connected)));
  window.deskApi.onHotkeyAction(async (actionName) => {
    const action = state.settings.actions.find((x) => x.name === actionName);
    if (action) await runAction(action);
  });

  addLog("ApexPlay RCON Desk ready.");
  addFeed("system", "Ready");

  // Hard fallback in case direct binding changes in future UI refactors.
  document.addEventListener("click", async (event) => {
    if (event.target && event.target.id === "connectBtn") {
      addLog("Connect click captured by delegation.");
    }
  });
}

window.addEventListener("error", (event) => {
  addLog(`JS error: ${event.message}`);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason?.message || String(event.reason);
  addLog(`Unhandled promise rejection: ${reason}`);
});

init().catch((error) => addLog(`Init failed: ${error.message || error}`));
