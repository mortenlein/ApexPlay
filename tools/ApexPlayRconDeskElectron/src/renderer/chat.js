const chatList = document.getElementById("chatList");
const rawLogs = document.getElementById("rawLogs");
const MAX_CHAT_ITEMS = 500;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function addChatLine(payload) {
  if (!payload || !payload.line) return;

  const li = document.createElement("li");
  li.className = `chat-item ${payload.team || "none"}`;
  
  const timeStr = payload.ts ? new Date(payload.ts).toLocaleTimeString() : new Date().toLocaleTimeString();
  
  li.innerHTML = `
    <div class="chat-time">${timeStr}</div>
    <div class="chat-text">${escapeHtml(payload.line)}</div>
  `;

  chatList.prepend(li);

  while (chatList.children.length > MAX_CHAT_ITEMS) {
    chatList.removeChild(chatList.lastElementChild);
  }
}

// Listen for chat lines from main process
window.deskApi.onChatLine((payload) => {
  addChatLine(payload);
});

// For debugging: show raw traffic
window.deskApi.onLogLine((line) => {
  console.log("Raw log received:", line);
  
  // Update raw log container if it exists
  if (rawLogs) {
    const div = document.createElement("div");
    div.style.borderBottom = "1px solid #222";
    div.style.padding = "2px 0";
    div.textContent = `[${new Date().toLocaleTimeString()}] ${line}`;
    rawLogs.prepend(div);
    if (rawLogs.children.length > 50) rawLogs.lastChild.remove();
  }

  // Update small debug indicator in header
  const debugEl = document.getElementById("debugInfo");
  if (debugEl) {
    debugEl.textContent = `Last packet: ${line.substring(0, 60)}${line.length > 60 ? "..." : ""}`;
  }
});

console.log("Chat window script initialized.");
