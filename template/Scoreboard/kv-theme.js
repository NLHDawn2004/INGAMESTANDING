import { HUD_WIDTH, HUD_HEIGHT, getHudRows } from "/hud-kv-data.mjs";

const defaultRow = "./assets/TeamRow.png";
const standardStarts = [7, 55, 103, 151, 201, 249, 297, 345, 394, 442, 490, 538];

function readTheme(bitmap) {
  const atlas = document.createElement("canvas");
  atlas.width = HUD_WIDTH;
  atlas.height = HUD_HEIGHT;
  const context = atlas.getContext("2d");
  context.drawImage(bitmap, 0, 0);
  const pixels = context.getImageData(0, 0, HUD_WIDTH, HUD_HEIGHT);
  const detected = getHudRows(pixels);
  const bands = detected.length === 12 ? detected : standardStarts.map(start => [start, start + 44]);
  const crop = document.createElement("canvas");
  crop.width = HUD_WIDTH;
  const colorAt = y => {
    const offset = (y * HUD_WIDTH + 20) * 4;
    return [...pixels.data.subarray(offset, offset + 3)];
  };
  const light = color => color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722 > 150;
  const rows = bands.map(([start, end]) => {
    crop.height = end - start;
    crop.getContext("2d").drawImage(atlas, 0, start, HUD_WIDTH, crop.height, 0, 0, HUD_WIDTH, crop.height);
    return { url: crop.toDataURL("image/png"), ink: light(colorAt(Math.floor((start + end) / 2))) ? "#111" : "#fff" };
  });
  const [start, end] = bands[0];
  const rgb = color => `rgb(${color.join(",")})`;
  return {
    rows,
    header: `linear-gradient(${rgb(colorAt(start + 2))}, ${rgb(colorAt(end - 3))})`,
    ink: rows[0].ink,
  };
}

export function connectScoreboardKv(ranks) {
  let active;
  let revision;
  let loading = false;

  function paint() {
    document.body.classList.toggle("scoreboard-has-kv", Boolean(active));
    document.body.style.setProperty("--cpr-badge-image", revision
      ? `url("/api/hud-kv/cpr-background?v=${encodeURIComponent(revision)}")` : "");
    document.body.style.setProperty("--kv-header", active?.header ?? "");
    document.body.style.setProperty("--kv-header-ink", active?.ink ?? "");
    for (const row of ranks.querySelectorAll(".rank-row")) {
      const index = Math.min(11, Math.max(0, (Number(row.dataset.rank) || 1) - 1));
      const appearance = active?.rows[index];
      const background = row.querySelector(".rank-row-background");
      const source = appearance?.url ?? defaultRow;
      if (background.getAttribute("src") !== source) background.src = source;
      row.style.setProperty("--kv-rank-ink", appearance?.ink ?? "");
    }
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch("/api/hud-kv/active");
      if (response.status === 204) {
        if (active) {
          active = undefined;
          revision = undefined;
          paint();
        }
        return;
      }
      const nextRevision = response.headers.get("X-Hud-Revision");
      if (!response.ok || !nextRevision || nextRevision === revision) return;
      const bitmap = await createImageBitmap(await response.blob());
      try {
        active = readTheme(bitmap);
        revision = nextRevision;
        paint();
      } finally {
        bitmap.close();
      }
    } catch {
      // Keep the last visible theme if the local server is reconnecting.
    } finally {
      loading = false;
    }
  }

  window.addEventListener("message", event => {
    if (event.source === window.parent && event.origin === location.origin
      && event.data?.type === "ff-hud-kv-refresh") void refresh();
  });
  void refresh();
  setInterval(refresh, 2500);
  return paint;
}
