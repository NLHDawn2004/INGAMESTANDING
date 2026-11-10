import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";

type CprSettings = {
  threshold: number | null;
  outlineBrightness: number;
  outlineWidth: number;
  outlineSpeed: number;
};
const defaultIcon = "/overlays/Scoreboard/assets/cpr-crown.png";
const outlineControls = {
  outlineBrightness: { min: 20, max: 150, defaultValue: 100 },
  outlineWidth: { min: 0.5, max: 5, defaultValue: 1.75 },
  outlineSpeed: { min: 0.5, max: 2, defaultValue: 1 },
} as const;

function validOutlineValue(value: unknown, key: keyof typeof outlineControls): value is number {
  const { min, max } = outlineControls[key];
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function sameOrigin(req: Request) {
  const origin = req.get("origin");
  return !origin || origin === `${req.protocol}://${req.get("host")}`;
}

function readCprSettings(file: string): CprSettings {
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.warn("Could not load saved CPR settings.");
  }
  const { threshold, outlineBrightness, outlineWidth, outlineSpeed } = saved ?? {};
  return {
    threshold: Number.isSafeInteger(threshold) && threshold > 0 ? threshold : null,
    outlineBrightness: validOutlineValue(outlineBrightness, "outlineBrightness")
      ? outlineBrightness : outlineControls.outlineBrightness.defaultValue,
    outlineWidth: validOutlineValue(outlineWidth, "outlineWidth")
      ? outlineWidth : outlineControls.outlineWidth.defaultValue,
    outlineSpeed: validOutlineValue(outlineSpeed, "outlineSpeed")
      ? outlineSpeed : outlineControls.outlineSpeed.defaultValue,
  };
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
    const {
      threshold, outlineBrightness = cpr.outlineBrightness,
      outlineWidth = cpr.outlineWidth, outlineSpeed = cpr.outlineSpeed,
    } = req.body ?? {};
    if (threshold !== null && (!Number.isSafeInteger(threshold) || threshold < 1)) {
      return res.status(400).json({ message: "Điểm CPR không hợp lệ." });
    }
    if (!validOutlineValue(outlineBrightness, "outlineBrightness")
      || !validOutlineValue(outlineWidth, "outlineWidth")
      || !validOutlineValue(outlineSpeed, "outlineSpeed")) {
      return res.status(400).json({ message: "Độ sáng, độ dày hoặc tốc độ viền CPR không hợp lệ." });
    }
    const next: CprSettings = { threshold, outlineBrightness, outlineWidth, outlineSpeed };
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
