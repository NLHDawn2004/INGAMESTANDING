import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";

type CprSettings = { threshold: number | null; outlineColor: string };
const defaultIcon = "/overlays/Scoreboard/assets/cpr-crown.png";
const defaultOutlineColor = "#ffffff";
const hexColor = /^#[0-9a-f]{6}$/i;

function sameOrigin(req: Request) {
  const origin = req.get("origin");
  return !origin || origin === `${req.protocol}://${req.get("host")}`;
}

function readCprSettings(file: string): CprSettings {
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      threshold: Number.isSafeInteger(saved?.threshold) && saved.threshold > 0 ? saved.threshold : null,
      outlineColor: typeof saved?.outlineColor === "string" && hexColor.test(saved.outlineColor)
        ? saved.outlineColor.toLowerCase() : defaultOutlineColor,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.warn("Could not load saved CPR settings.");
    return { threshold: null, outlineColor: defaultOutlineColor };
  }
}

export function createScoreboardVisibilityRouter(cprFile = path.resolve("scoreboard-cpr.json")) {
  const router = express.Router();
  const viewers = new Set<Response>();
  let visible = true;
  let cpr = readCprSettings(cprFile);

  function publicCpr() {
    return { ...cpr, iconUrl: defaultIcon };
  }

  function sendCpr(viewer: Response) {
    viewer.write(`event: cpr\ndata: ${JSON.stringify(publicCpr())}\n\n`);
  }

  function send(viewer: Response, animate: boolean) {
    viewer.write(`data: ${JSON.stringify({ visible, animate })}\n\n`);
  }

  router.get("/events", (_req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    viewers.add(res);
    send(res, false);
    sendCpr(res);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20000);
    heartbeat.unref();
    res.once("close", () => {
      clearInterval(heartbeat);
      viewers.delete(res);
    });
  });

  router.post("/", express.json({ limit: "1kb" }), (req, res) => {
    if (!sameOrigin(req)) {
      return res.status(403).json({ message: "Hãy điều khiển Scoreboard từ bảng điều khiển." });
    }
    const requested = req.body?.visible;
    if (typeof requested !== "boolean") {
      return res.status(400).json({ message: "Lệnh Scoreboard không hợp lệ." });
    }
    if (requested || visible !== requested) {
      visible = requested;
      viewers.forEach(viewer => send(viewer, true));
    }
    return res.json({ visible });
  });

  router.get("/cpr", (_req, res) => res.set("Cache-Control", "no-store").json(publicCpr()));
  router.put("/cpr", express.json({ limit: "1kb" }), (req, res) => {
    if (!sameOrigin(req)) return res.status(403).json({ message: "Hãy chỉnh CPR từ bảng điều khiển." });
    const { threshold, outlineColor = cpr.outlineColor } = req.body ?? {};
    if (threshold !== null && (!Number.isSafeInteger(threshold) || threshold < 1)) {
      return res.status(400).json({ message: "Điểm CPR không hợp lệ." });
    }
    if (typeof outlineColor !== "string" || !hexColor.test(outlineColor)) {
      return res.status(400).json({ message: "Màu vệt sáng CPR không hợp lệ." });
    }
    const next: CprSettings = { threshold, outlineColor: outlineColor.toLowerCase() };
    try {
      fs.writeFileSync(`${cprFile}.tmp`, JSON.stringify(next));
      fs.renameSync(`${cprFile}.tmp`, cprFile);
      cpr = next;
    } catch {
      return res.status(500).json({ message: "Không lưu được cấu hình CPR." });
    }
    viewers.forEach(sendCpr);
    return res.json(publicCpr());
  });

  return router;
}
