import { HUD_WIDTH, HUD_HEIGHT, buildHudBackground, pickKvFile } from "./hud-kv-data.mjs";

const byId = id => document.getElementById(id);
const folder = byId("hud-kv-folder");
const image = byId("hud-kv-image");
const status = byId("hud-kv-status");
const preview = byId("hud-kv-preview");
const referenceImage = byId("hud-kv-reference");
const canvas = byId("hud-kv-result");
const apply = byId("hud-kv-apply");
let prepared;
let referenceUrl;

function report(message, error = false) {
  status.textContent = message;
  status.toggleAttribute("data-error", error);
}

function setBusy(busy) {
  folder.disabled = busy;
  image.disabled = busy;
  apply.disabled = busy || !prepared;
}

async function pixels(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const surface = document.createElement("canvas");
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    surface.width = Math.max(1, Math.round(bitmap.width * scale));
    surface.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = surface.getContext("2d");
    context.drawImage(bitmap, 0, 0, surface.width, surface.height);
    return context.getImageData(0, 0, surface.width, surface.height);
  } finally {
    bitmap.close();
  }
}

async function analyze(files) {
  prepared = undefined;
  preview.hidden = true;
  setBusy(true);
  report("Đang phân tích KV…");
  try {
    const source = pickKvFile(files);
    const response = await fetch("/api/hud-kv/reference");
    if (!response.ok) throw new Error((await response.json()).message);
    const baseline = await response.blob();
    const [sourcePixels, referencePixels] = await Promise.all([pixels(source), pixels(baseline)]);
    const result = buildHudBackground(sourcePixels, referencePixels);
    canvas.getContext("2d").putImageData(new ImageData(result, HUD_WIDTH, HUD_HEIGHT), 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    const revision = response.headers.get("X-Hud-Revision");
    if (!blob || !revision) throw new Error("Không tạo được ảnh xem trước.");

    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    referenceUrl = URL.createObjectURL(baseline);
    referenceImage.src = referenceUrl;
    prepared = { blob, revision };
    preview.hidden = false;
    report(`Đã xem trước ${source.name}. Bấm Áp dụng để đổi nền HUD và Scoreboard Realtime.`);
  } catch (error) {
    report(error.message || "Không đọc được KV.", true);
  } finally {
    setBusy(false);
  }
}

for (const input of [folder, image]) {
  input.addEventListener("change", () => {
    const files = [...input.files];
    input.value = "";
    if (files.length) void analyze(files);
  });
}

apply.addEventListener("click", async () => {
  if (!prepared) return;
  setBusy(true);
  try {
    const response = await fetch("/api/hud-kv/background", {
      method: "PUT",
      headers: { "Content-Type": "image/png", "X-Hud-Revision": prepared.revision },
      body: prepared.blob,
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409) prepared = undefined;
      throw new Error(result.message);
    }
    prepared = undefined;
    if (result.revision) {
      document.body.style.setProperty("--cpr-badge-image",
        `url("/api/hud-kv/cpr-background?v=${encodeURIComponent(result.revision)}")`);
    }
    document.querySelector('iframe[data-overlay="Scoreboard"]')?.contentWindow
      ?.postMessage({ type: "ff-hud-kv-refresh" }, location.origin);
    report(result.unchanged ? "HUD_PIC đã dùng ảnh này."
      : `Đã áp dụng KV cho HUD và Scoreboard Realtime. Bản sao lưu: ${result.backupName}.`);
  } catch (error) {
    report(error.message || "Không áp dụng được KV.", true);
  } finally {
    setBusy(false);
  }
});
