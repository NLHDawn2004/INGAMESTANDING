(() => {
  const STORAGE_KEY = "ff-debugger-terminal-sessions-v1";
  const WS_LOG_PORT = 11022;
  const MAX_LOGS = 1000;

  const terminalOutput = document.getElementById("terminalOutput");
  const sessionMeta = document.getElementById("sessionMeta");
  const btnStartListener = document.getElementById("btn-start-listener");
  const btnStopListener = document.getElementById("btn-stop-listener");
  const btnKillListener = document.getElementById("btn-kill-listener");
  const btnBack = document.getElementById("btn-back");

  const urlParams = new URLSearchParams(window.location.search);
  const listenerIdFromQuery = (urlParams.get("listenerID") || "").trim();
  const filePathFromQuery = (urlParams.get("filePath") || "").trim();

  let sessions = loadSessions();
  let currentSessionId = null;
  let websocket = null;

  function toLogEntry(message, options = {}) {
    const normalizedMessage = String(message || "");
    const level = String(options.level || detectLevel(normalizedMessage)).toLowerCase();
    return {
      time: String(options.time || nowText()),
      source: String(options.source || "ui"),
      level,
      message: normalizedMessage,
    };
  }

  function detectLevel(message) {
    const upper = String(message || "").toUpperCase();
    if (upper.includes("ERROR") || upper.includes("LỖI")) return "error";
    if (upper.includes("WARN") || upper.includes("CẢNH BÁO")) return "warn";
    if (upper.includes("DEBUG") || upper.includes("[RAW]")) return "debug";
    if (upper.includes("SUCCESS") || upper.includes("THÀNH CÔNG")) return "success";
    return "info";
  }

  function normalizeSessionLogs(logs) {
    if (!Array.isArray(logs)) return [];

    return logs
      .map((item) => {
        if (item && typeof item === "object") {
          return toLogEntry(item.message, {
            time: item.time,
            source: item.source,
            level: item.level,
          });
        }

        const text = String(item || "");
        return toLogEntry(text, { source: "legacy" });
      })
      .slice(-MAX_LOGS);
  }

  function normalizeSingleSession() {
    if (!Array.isArray(sessions) || !sessions.length) {
      sessions = [];
      currentSessionId = null;
      return;
    }

    const first = sessions[0];
    first.logs = normalizeSessionLogs(first.logs);
    sessions = [first];
    currentSessionId = first.id || null;
  }

  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function saveSessions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  function nowText() {
    return new Date().toLocaleString("vi-VN", { hour12: false });
  }

  function makeSessionId() {
    return `S-${Date.now().toString(36).toUpperCase()}`;
  }

  function getCurrentSession() {
    return sessions.find((s) => s.id === currentSessionId) || null;
  }

  function pushLog(session, line, options = {}) {
    if (!session) return;
    session.logs = normalizeSessionLogs(session.logs);
    session.logs.push(toLogEntry(line, options));
    if (session.logs.length > MAX_LOGS) {
      session.logs = session.logs.slice(-MAX_LOGS);
    }
    session.lastActivity = nowText();
  }

  function renderLogLine(entry) {
    const row = document.createElement("div");
    row.className = `terminal-line level-${entry.level}`;

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = `[${entry.time}]`;

    const source = document.createElement("span");
    source.className = "log-source";
    source.textContent = `[${entry.source}]`;

    const level = document.createElement("span");
    level.className = `log-level level-${entry.level}`;
    level.textContent = `[${entry.level.toUpperCase()}]`;

    const message = document.createElement("span");
    message.className = "log-message";
    message.textContent = entry.message;

    row.append(time, source, level, message);
    return row;
  }

  function renderOutput() {
    const current = getCurrentSession();

    if (!current) {
      terminalOutput.textContent = "Chưa có session terminal.";
      sessionMeta.textContent = "Session: -";
      return;
    }

    sessionMeta.textContent = `Session: ${current.id} | Trang thái: ${current.status} | File: ${current.filePath || "(trong)"}`;
    terminalOutput.innerHTML = "";
    const logs = normalizeSessionLogs(current.logs);
    const fragment = document.createDocumentFragment();
    logs.forEach((entry) => {
      fragment.appendChild(renderLogLine(entry));
    });
    terminalOutput.appendChild(fragment);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function createSession(filePath) {
    const session = {
      id: makeSessionId(),
      status: "ready",
      filePath: String(filePath || "").trim(),
      createdAt: nowText(),
      lastActivity: nowText(),
      logs: []
    };

    pushLog(session, "Session được khởi tạo.", { source: "system", level: "info" });
    if (session.filePath) {
      pushLog(session, `Đường dẫn file: ${session.filePath}`, { source: "system", level: "info" });
    } else {
      pushLog(session, "Chưa có đường dẫn file được cấu hình.", { source: "system", level: "warn" });
    }
    pushLog(session, `Listener ID: ${listenerIdFromQuery || "(trong)"}`, { source: "system", level: "info" });
    pushLog(session, "Trang thái ban đầu: ready (chưa start).", { source: "system", level: "info" });

    sessions = [session];
    currentSessionId = session.id;
    saveSessions();
    renderOutput();
  }

  function getWsUrl() {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname || "localhost";
    return `${protocol}://${host}:${WS_LOG_PORT}`;
  }

  function connectWebSocket() {
    const current = getCurrentSession();
    if (!current) return;

    if (websocket && (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING)) {
      pushLog(current, "WebSocket đang kết nối hoặc đã kết nối. Không tạo kết nối mới.", { source: "ws", level: "warn" });
      saveSessions();
      renderOutput();
      return;
    }

    const wsUrl = getWsUrl();
    websocket = new WebSocket(wsUrl);

    websocket.addEventListener("open", () => {
      const active = getCurrentSession();
      if (!active) return;
      pushLog(active, `WebSocket connected: ${wsUrl}`, { source: "ws", level: "success" });
      saveSessions();
      renderOutput();
    });

    websocket.addEventListener("message", (event) => {
      const active = getCurrentSession();
      if (!active) return;

      try {
        const data = JSON.parse(String(event.data));
        if (data.type === "log" && data.message) {
          if (String(data.source || "").toLowerCase() === "raw") {
            return;
          }
          pushLog(active, data.message, {
            source: data.source || "debugger",
            level: data.level || "info",
            time: data.timestamp || nowText(),
          });
        } else {
          pushLog(active, `WS message: ${String(event.data)}`, { source: "ws", level: "debug" });
        }
      } catch {
        pushLog(active, `WS message: ${String(event.data)}`, { source: "ws", level: "debug" });
      }

      saveSessions();
      renderOutput();
    });

    websocket.addEventListener("close", () => {
      const active = getCurrentSession();
      if (!active) return;
      pushLog(active, "WebSocket closed.", { source: "ws", level: "warn" });
      saveSessions();
      renderOutput();
    });

    websocket.addEventListener("error", () => {
      const active = getCurrentSession();
      if (!active) return;
      pushLog(active, "WebSocket error.", { source: "ws", level: "error" });
      saveSessions();
      renderOutput();
    });
  }

  function disconnectWebSocket() {
    if (websocket && (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING)) {
      websocket.close();
    }
    websocket = null;
  }

  async function callListenerApi(endpoint) {
    if (!listenerIdFromQuery) {
      const current = getCurrentSession();
      if (current) {
        pushLog(current, "Khong tim thay listenerID de thuc hien thao tac.", { source: "api", level: "error" });
        saveSessions();
        renderOutput();
      }
      return;
    }

    const current = getCurrentSession();
    if (!current) return;

    try {
      const response = await fetch(`/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listenerID: listenerIdFromQuery })
      });

      const result = await response.json();

      if (!response.ok) {
        pushLog(current, `Loi ${endpoint}: ${result.message || "Khong xac dinh"}`, { source: "api", level: "error" });
      } else {
        pushLog(current, `${endpoint}: ${result.message || "Thanh cong"}`, { source: "api", level: "success" });

        if (endpoint === "start-listener") {
          current.status = "running";
          connectWebSocket();
        }

        if (endpoint === "stop-listener") {
          current.status = "stopped";
          disconnectWebSocket();
        }

        if (endpoint === "kill-listener") {
          current.status = "killed";
          disconnectWebSocket();
          pushLog(current, "Listener đã bị hủy hoàn toàn.", { source: "system", level: "warn" });
        }
      }
    } catch (error) {
      pushLog(current, `Khong goi duoc ${endpoint}: ${String(error)}`, { source: "api", level: "error" });
    }

    saveSessions();
    renderOutput();
  }

  async function killListenerBeforeBack() {
    const current = getCurrentSession();

    if (!listenerIdFromQuery) {
      if (current) {
        pushLog(current, "Không có listenerID, bỏ qua kill trước khi quay lại.", { source: "api", level: "warn" });
        saveSessions();
        renderOutput();
      }
      return;
    }

    try {
      const response = await fetch("/kill-listener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listenerID: listenerIdFromQuery })
      });

      const result = await response.json();

      if (!response.ok) {
        if (current) {
          pushLog(current, `Lỗi kill-listener khi quay lại: ${result.message || "Không xác định"}`, { source: "api", level: "warn" });
        }
        return;
      }

      if (current) {
        current.status = "killed";
        pushLog(current, `kill-listener: ${result.message || "Thành công"}`, { source: "api", level: "success" });
      }
      disconnectWebSocket();
    } catch (error) {
      if (current) {
        pushLog(current, `Không gọi được kill-listener khi quay lại: ${String(error)}`, { source: "api", level: "warn" });
      }
    } finally {
      saveSessions();
      renderOutput();
    }
  }

  btnBack?.addEventListener("click", async () => {
    btnBack.disabled = true;
    await killListenerBeforeBack();
    disconnectWebSocket();
    window.location.href = "index.html";
  });

  btnStartListener?.addEventListener("click", () => {
    callListenerApi("start-listener");
  });

  btnStopListener?.addEventListener("click", () => {
    callListenerApi("stop-listener");
  });

  btnKillListener?.addEventListener("click", () => {
    callListenerApi("kill-listener");
  });

  window.addEventListener("beforeunload", () => {
    disconnectWebSocket();
  });

  normalizeSingleSession();

  if (!sessions.length || filePathFromQuery) {
    createSession(filePathFromQuery);
  } else {
    currentSessionId = sessions[0].id;
    renderOutput();
  }
})();
