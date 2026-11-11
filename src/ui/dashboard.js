import { parseRoster } from "./dashboard-data.mjs";
import { setBrandingTeams } from "./team-branding.js";
import { scoreboardDimension, scoreboardPercent } from "./scoreboard-size.mjs";

const byId = id => document.getElementById(id);
const storageKey = "ff-debugger-dashboard-v2";
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(storageKey)
    ?? localStorage.getItem("ff-debugger-dashboard-v1")) || {};
} catch {
  // A damaged saved setup can be replaced from the dashboard.
}
let players = saved.players ?? [];
const matchIds = new Set(saved.matchIds
  ?? saved.matches?.filter(match => match.include).map(match => match.matchId));
let listenerId = sessionStorage.getItem("ff-dashboard-listener");
let logSocket;
const logLines = [];
const overlays = [...document.querySelectorAll("[data-overlay]")];
const scoreboardFrame = overlays.find(frame => frame.dataset.overlay === "Scoreboard");
const scoreboardWidth = byId("scoreboard-width");
const scoreboardHeight = byId("scoreboard-height");
const scoreboardSizeKey = "ff-scoreboard-dimensions";
let savedScoreboardSize;
try {
  savedScoreboardSize = JSON.parse(localStorage.getItem(scoreboardSizeKey));
} catch {
  // Invalid saved dimensions fall back to automatic fit.
}
const oldPercent = scoreboardPercent(localStorage.getItem("ff-scoreboard-scale"));
scoreboardWidth.value = savedScoreboardSize
  ? scoreboardDimension(savedScoreboardSize.width) ?? ""
  : oldPercent < 100 ? Math.round(360 * oldPercent / 100) : "";
scoreboardHeight.value = scoreboardDimension(savedScoreboardSize?.height) ?? "";

function fitPreview(frame, width, height) {
  const naturalWidth = frame.offsetWidth || Number(frame.dataset.previewWidth || 1920);
  const naturalHeight = frame.offsetHeight || 1080;
  frame.style.transform = `scale(${Math.min(width / naturalWidth, height / naturalHeight)})`;
}

const resizePreviews = new ResizeObserver(entries => {
  for (const { target, contentRect } of entries) {
    fitPreview(target.firstElementChild, contentRect.width, contentRect.height);
  }
});
overlays.forEach(frame => resizePreviews.observe(frame.parentElement));
const debugPath = byId("debug-path");
debugPath.value = saved.debugPath ?? "";
const { hosted } = await fetch("/api/runtime").then(response => response.json());
const pickDebug = byId("pick-debug");
let debugHandle;
let logUpload;
if (hosted) {
  document.body.dataset.hosted = "";
  debugPath.hidden = byId("local-debug-help").hidden = true;
  byId("hosted-debug-help").hidden = pickDebug.hidden = false;
  document.querySelector('label[for="debug-path"]').htmlFor = "pick-debug";
  byId("hud-kv-description").textContent = "Chọn một ảnh KV để thay nền Scoreboard trên web.";
  byId("hud-kv-apply").textContent = "Áp dụng cho Scoreboard";
  byId("cpr-background-source").textContent = "Nền tự lấy từ KV của Scoreboard.";
  if (listenerId) report("Tab đã tải lại. Hãy dừng phiên và chọn lại file debug để tiếp tục.");
  pickDebug.addEventListener("click", async () => {
    if (!window.showOpenFilePicker) return report("Hãy mở bảng điều khiển bằng Chrome hoặc Edge để đọc file debug.", true);
    try {
      [debugHandle] = await window.showOpenFilePicker();
      byId("hosted-debug-help").textContent = `Đã chọn ${debugHandle.name}. Giữ tab này mở khi theo dõi.`;
    } catch (error) {
      if (error.name !== "AbortError") report(error.message, true);
    }
  });
}

function scoreboardOptions() {
  return {
    width: scoreboardDimension(scoreboardWidth.value),
    height: scoreboardDimension(scoreboardHeight.value),
  };
}

function scoreboardUrl(preview = false) {
  const url = new URL("/overlays/Scoreboard/", location.origin);
  const { width, height } = scoreboardOptions();
  if (preview) url.searchParams.set("edit", "1");
  if (width) url.searchParams.set("width", String(width));
  if (height) url.searchParams.set("height", String(height));
  return url;
}

function updateScoreboardSize() {
  const options = scoreboardOptions();
  const url = scoreboardUrl().href;
  byId("scoreboard-obs-link").href = url;
  byId("scoreboard-obs-url").value = url;
  const viewport = scoreboardFrame.parentElement;
  const { width, height } = options;
  viewport.style.setProperty("--scoreboard-preview-width", String(Math.max(404, Math.ceil((width || 0) * 404 / 360))));
  viewport.style.setProperty("--scoreboard-requested-height", String(height || 0));
  viewport.style.setProperty("--scoreboard-width-only-factor", String(!height && width ? Math.max(1, width / 360) : 1));
  viewport.style.setProperty("--scoreboard-height-only", String(!width && height ? height : 0));
  fitPreview(scoreboardFrame, viewport.clientWidth, viewport.clientHeight);
  scoreboardFrame.contentWindow?.postMessage({ type: "ff-scoreboard-size", ...options }, location.origin);
}

for (const field of [scoreboardWidth, scoreboardHeight]) {
  field.addEventListener("input", () => {
    localStorage.setItem(scoreboardSizeKey, JSON.stringify(scoreboardOptions()));
    updateScoreboardSize();
  });
}
byId("scoreboard-copy-link").addEventListener("click", async () => {
  const status = byId("scoreboard-copy-status");
  try {
    await navigator.clipboard.writeText(scoreboardUrl().href);
    status.textContent = "Đã sao chép link OBS.";
  } catch {
    const input = byId("scoreboard-obs-url");
    input.focus();
    input.select();
    status.textContent = "Nhấn Ctrl+C để sao chép link.";
  }
});
updateScoreboardSize();

const showScoreboard = byId("scoreboard-show");
const hideScoreboard = byId("scoreboard-hide");
async function sendScoreboardMotion(visible) {
  const status = byId("scoreboard-motion-status");
  showScoreboard.disabled = hideScoreboard.disabled = true;
  status.removeAttribute("data-error");
  try {
    await post("/api/scoreboard-visibility", { visible });
    status.textContent = visible ? "Đã gửi lệnh chạy bảng điểm." : "Đã gửi lệnh tắt bảng điểm.";
  } catch (error) {
    status.textContent = error.message;
    status.setAttribute("data-error", "");
  } finally {
    showScoreboard.disabled = hideScoreboard.disabled = false;
  }
}
showScoreboard.addEventListener("click", () => void sendScoreboardMotion(true));
hideScoreboard.addEventListener("click", () => void sendScoreboardMotion(false));

function persist() {
  localStorage.setItem(storageKey, JSON.stringify({
    debugPath: debugPath.value, players, matchIds: [...matchIds],
  }));
}

function report(message, error = false) {
  byId("status").textContent = message;
  byId("status").toggleAttribute("data-error", error);
}

function setControls(busy = false) {
  byId("start").disabled = busy || Boolean(listenerId);
  byId("stop").disabled = busy || !listenerId;
  pickDebug.disabled = busy || Boolean(listenerId);
  byId("add-match").disabled = busy;
  byId("finish-match").disabled = busy;
  byId("finish-match").hidden = !listenerId;
  byId("matches").querySelectorAll("button[data-remove]").forEach(button => {
    button.disabled = busy;
  });
}

function setListener(id) {
  listenerId = id;
  if (id) sessionStorage.setItem("ff-dashboard-listener", id);
  else sessionStorage.removeItem("ff-dashboard-listener");
}

function renderRoster() {
  const teams = new Set(players.map(player => player.teamName));
  setBrandingTeams([...teams]);
  if (players.length) {
    byId("roster-info").textContent = `${players.length} người chơi · ${teams.size} đội`;
  }
}

function showMatch(matchId) {
  const details = byId("details");
  details.src = `/match-details.html?matchId=${encodeURIComponent(matchId)}`;
  details.hidden = false;
}

function renderMatches() {
  const list = byId("matches");
  list.replaceChildren();
  for (const matchId of matchIds) {
    const row = document.createElement("li");
    row.className = "row";
    const label = document.createElement("span");
    label.textContent = matchId;
    const view = document.createElement("button");
    view.textContent = "Xem thống kê";
    view.addEventListener("click", () => showMatch(matchId));
    const remove = document.createElement("button");
    remove.textContent = "Xóa";
    remove.setAttribute("aria-label", `Xóa trận ${matchId}`);
    remove.setAttribute("data-remove", "");
    remove.addEventListener("click", () => saveMatches([...matchIds].filter(id => id !== matchId)));
    row.append(label, view, remove);
    list.append(row);
  }
  if (!matchIds.size) list.textContent = "Chưa có trận nào để cộng điểm.";
}

async function post(endpoint, body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.errors?.join(" · ") || data.message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function loadPreviews() {
  for (const frame of overlays) {
    frame.src = frame === scoreboardFrame ? scoreboardUrl(true).href : `/overlays/${frame.dataset.overlay}/`;
  }
}

function preparePreviews() {
  return new Promise((resolve, reject) => {
    const waiting = new Set(overlays.map(frame => frame.contentWindow));
    const timeout = setTimeout(() => {
      window.removeEventListener("message", ready);
      reject(new Error("Chưa kết nối được overlay. Hãy dừng phiên và thử lại."));
    }, 6000);
    function ready(event) {
      if (event.origin !== location.origin || event.data?.type !== "ff-overlay-ready") return;
      waiting.delete(event.source);
      if (waiting.size) return;
      clearTimeout(timeout);
      window.removeEventListener("message", ready);
      resolve();
    }
    window.addEventListener("message", ready);
    loadPreviews();
  });
}

function writeLog(message) {
  logLines.push(message);
  if (logLines.length > 200) logLines.shift();
  const output = byId("terminal");
  output.textContent = logLines.join("\n");
  output.scrollTop = output.scrollHeight;
}

function connectLog() {
  const url = new URL(location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  if (!hosted) url.port = "11022";
  url.pathname = hosted ? "/ws/11022" : "/";
  url.search = "";
  url.hash = "";
  logSocket = hosted ? new WebSocket(url, ["ff-live-log", listenerId]) : new WebSocket(url);
  logSocket.addEventListener("message", event => {
    const entry = JSON.parse(event.data);
    writeLog(`[${entry.timestamp}] ${entry.message}`);
    if (entry.source === "standings" && entry.level === "warn") report(entry.message, true);
  });
}

async function uploadDebug(handle, id, signal) {
  let offset = 0;
  const chunkSize = 1024 * 1024;
  while (!signal.aborted) {
    const file = await handle.getFile();
    if (file.size < offset) throw new Error("File debug đã bị ghi lại.");
    while (offset < file.size && !signal.aborted) {
      const chunk = file.slice(offset, offset + chunkSize);
      const response = await fetch("/live-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Listener-ID": id,
          "X-Log-Offset": String(offset),
        },
        body: chunk,
        signal,
      });
      if (!response.ok) throw new Error((await response.json()).message || "Không gửi được dữ liệu debug.");
      offset += chunk.size;
    }
    await new Promise(resolve => setTimeout(resolve, 750));
  }
}

byId("roster").addEventListener("change", async event => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    players = parseRoster(await file.text(), file.name);
    persist();
    renderRoster();
    report("Đã nạp danh sách người chơi.");
  } catch (error) {
    report(error.message, true);
  }
});

async function saveMatches(ids, completedLiveMatchId) {
  setControls(true);
  try {
    if (listenerId) {
      try {
        await post("/update-listener-matches", { listenerID: listenerId, matchIds: ids, completedLiveMatchId });
      } catch (error) {
        if (error.status !== 409) throw error;
        setListener(null);
        logUpload?.abort();
        logSocket?.close();
        if (completedLiveMatchId) throw error;
      }
    }
    matchIds.clear();
    ids.forEach(id => matchIds.add(id));
    persist();
    renderMatches();
    report(listenerId ? "Đã cập nhật điểm cộng dồn." : "Đã lưu danh sách cho lần theo dõi tiếp theo.");
    return true;
  } catch (error) {
    report(error.message, true);
    return false;
  } finally {
    setControls();
  }
}

byId("match-form").addEventListener("submit", async event => {
  event.preventDefault();
  const input = byId("match-id");
  const matchId = input.value.trim();
  if (!/^\d+$/.test(matchId)) return report("Match ID chỉ gồm chữ số.", true);
  const isCurrent = event.submitter === byId("finish-match");
  if (matchIds.has(matchId) && !listenerId) return report("Trận này đã có trong danh sách.", true);
  const ids = [...new Set([...matchIds, matchId])];
  if (await saveMatches(ids, isCurrent ? matchId : undefined)) input.value = "";
});

byId("start").addEventListener("click", async () => {
  const filePath = debugPath.value.trim().replace(/^"|"$/g, "");
  if (hosted ? !debugHandle : !filePath) {
    return report(hosted ? "Hãy chọn file debug." : "Hãy nhập đường dẫn file debug.", true);
  }
  if (!players.length) return report("Hãy chọn file PlayerName trước khi bắt đầu.", true);
  setControls(true);
  try {
    const created = await post("/create-listener", {
      filePath,
      requireExistingFile: true,
      readExistingLog: true,
      global: { players },
      groups: [{
        groupId: "dashboard",
        matchIds: [...matchIds],
        teamNames: [...new Set(players.map(player => player.teamName))],
      }],
    });
    setListener(created.listenerID);
    logLines.length = 0;
    await preparePreviews();
    connectLog();
    await post("/start-listener", { listenerID: listenerId });
    if (hosted) {
      logUpload = new AbortController();
      const { signal } = logUpload;
      void uploadDebug(debugHandle, listenerId, signal).catch(error => {
        if (!signal.aborted) report(`${error.message} Hãy dừng và bắt đầu lại.`, true);
      });
    }
    report("Đang theo dõi file debug.");
    writeLog("Đã bắt đầu theo dõi file debug.");
    persist();
  } catch (error) {
    report(error.message, true);
  } finally {
    setControls();
  }
});

byId("stop").addEventListener("click", async () => {
  setControls(true);
  try {
    await post("/kill-listener", { listenerID: listenerId });
    setListener(null);
    logUpload?.abort();
    logSocket?.close();
    report("Đã dừng theo dõi.");
    writeLog("Đã dừng theo dõi file debug.");
  } catch (error) {
    if (error.status === 400) setListener(null);
    report(error.message, true);
  } finally {
    setControls();
  }
});

debugPath.addEventListener("change", persist);
const management = byId("management");
management.parentElement.addEventListener("toggle", () => {
  if (management.parentElement.open && !management.getAttribute("src")) management.src = "/index.html";
});
window.addEventListener("ff-open-match", event => showMatch(event.detail));
renderRoster();
renderMatches();
setControls();
if (listenerId) {
  loadPreviews();
  connectLog();
} else {
  scoreboardFrame.src = scoreboardUrl(true).href;
}
