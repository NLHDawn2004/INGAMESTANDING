const bulkUpload = document.getElementById("branding-bulk-upload");
const scoreboard = document.querySelector('iframe[data-overlay="Scoreboard"]');
const bulkStatus = document.getElementById("branding-bulk-status");
const inlineStatus = document.getElementById("branding-inline-status");
const endpoint = "/api/team-branding";
const normalizeTeam = value => value.trim().normalize("NFC").toUpperCase();
let rosterTeams = [];
let liveTeams = [];

export function setBrandingTeams(names) {
  rosterTeams = names;
}

function readLogo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Không đọc được ảnh logo."));
    reader.readAsDataURL(file);
  });
}

async function saveBrand(team, changes) {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team, ...changes }),
  });
  if (response.status === 413) throw new Error("Ảnh vượt dung lượng máy chủ có thể nhận (khoảng 48 MB mỗi ảnh).");
  const brand = await response.json();
  if (!response.ok) throw new Error(brand.message || "Không lưu được thay đổi.");
}

function refreshScoreboardBranding() {
  scoreboard.contentWindow.postMessage({ type: "ff-scoreboard-branding-refresh" }, location.origin);
}

function logoTeam(filename, knownTeams, teams) {
  const match = /^(.+)\.(?:png|jpe?g|webp|gif)$/i.exec(filename);
  if (!match || !match[1].trim()) throw new Error("Tên file hoặc định dạng ảnh không hợp lệ.");
  const key = normalizeTeam(match[1]);
  if (knownTeams.has(key)) return key;
  const aliases = Object.entries(teams).filter(([, brand]) =>
    brand.displayName && normalizeTeam(brand.displayName) === key);
  if (aliases.length > 1) throw new Error("Tên hiển thị trùng giữa nhiều đội.");
  return aliases[0]?.[0] || key;
}

bulkUpload.addEventListener("change", async () => {
  const files = [...bulkUpload.files];
  bulkUpload.value = "";
  if (!files.length) return;
  bulkUpload.disabled = true;
  bulkStatus.textContent = "Đang nhập logo…";
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("Không tải được thông tin đội.");
    const { teams } = await response.json();
    const knownTeams = new Set([...rosterTeams, ...liveTeams, ...Object.keys(teams)].map(normalizeTeam));
    const byTeam = new Map();
    const errors = [];
    for (const file of files) {
      try {
        const key = logoTeam(file.name, knownTeams, teams);
        const group = byTeam.get(key) || [];
        group.push(file);
        byTeam.set(key, group);
      } catch (error) {
        errors.push(`${file.name} (${error.message})`);
      }
    }
    let count = 0;
    for (const [key, group] of byTeam) {
      if (group.length > 1) {
        errors.push(`${key} (có ${group.length} ảnh cùng tên đội)`);
        continue;
      }
      const [file] = group;
      try {
        await saveBrand(key, { logoOnly: true, logoData: await readLogo(file) });
        count++;
      } catch (error) {
        errors.push(`${file.name} (${error.message})`);
      }
    }
    if (count) refreshScoreboardBranding();
    const omitted = errors.length > 5 ? ` và ${errors.length - 5} mục khác` : "";
    bulkStatus.textContent = `Đã lưu ${count}/${files.length} logo.`
      + (errors.length ? ` Bỏ qua ${errors.slice(0, 5).join(", ")}${omitted}.` : "");
  } catch (error) {
    bulkStatus.textContent = error.message;
  } finally {
    bulkUpload.disabled = false;
  }
});

window.addEventListener("message", async event => {
  if (event.origin !== location.origin || event.source !== scoreboard.contentWindow) return;
  const { type, team, displayName, file, teams, boardHeight } = event.data ?? {};
  if (type === "ff-scoreboard-teams" && Array.isArray(teams)) {
    liveTeams = teams.filter(name => typeof name === "string" && name.trim());
    const previewHeight = Number.isFinite(boardHeight) ? boardHeight + 8 : 68 + liveTeams.length * 48;
    scoreboard.parentElement.style.setProperty("--scoreboard-height", String(Math.max(300, previewHeight)));
    return;
  }
  if (type !== "ff-scoreboard-edit" || !liveTeams.includes(team)) return;
  inlineStatus.textContent = `Đang lưu ${team}…`;
  inlineStatus.removeAttribute("data-error");
  try {
    if (file instanceof File) {
      await saveBrand(team, { logoOnly: true, logoData: await readLogo(file) });
    } else if (typeof displayName === "string") {
      await saveBrand(team, { displayNameOnly: true, displayName });
    } else {
      return;
    }
    refreshScoreboardBranding();
    inlineStatus.textContent = `Đã lưu ${file ? "logo" : "tên"} cho ${team}.`;
  } catch (error) {
    inlineStatus.textContent = error.message;
    inlineStatus.setAttribute("data-error", "");
  }
});
