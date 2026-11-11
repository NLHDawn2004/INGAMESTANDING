import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import express from "express";

const defaultHudDirectory = "D:\\FF DATA 1\\OB55\\PC Client 02\\Free Fire_64_Data\\HUD_PIC";
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
const fileName = "ScoreboardBackground.png";

function isHudPng(data: unknown): data is Buffer {
  return Buffer.isBuffer(data) && data.length > 45
    && data.subarray(0, 8).equals(pngSignature)
    && data.readUInt32BE(8) === 13
    && data.toString("ascii", 12, 16) === "IHDR"
    && data.readUInt32BE(16) === 330
    && data.readUInt32BE(20) === 590
    && data.subarray(-12).equals(Buffer.from("0000000049454e44ae426082", "hex"));
}

function revision(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

export function createHudKvRouter(
  hudDirectory?: string,
  backupDirectory = path.resolve("hud-kv-backups"),
) {
  const configuredDirectory = hudDirectory || process.env.HUD_PIC_DIRECTORY;
  const scoreboardOnly = !configuredDirectory && !fs.existsSync(path.join(defaultHudDirectory, fileName));
  hudDirectory = configuredDirectory || (scoreboardOnly ? path.resolve("hud-local") : defaultHudDirectory);
  if (scoreboardOnly) {
    fs.mkdirSync(hudDirectory, { recursive: true });
    const assets = path.resolve("template/Scoreboard/assets");
    const copies = [
      [fileName, path.join(backupDirectory, "ScoreboardBackground.active.png"), path.join(assets, "HudDefault.png")],
      ["ScoreboardBackground.original.png", path.join(backupDirectory, "ScoreboardBackground.original.png"), path.join(assets, "HudReference.png")],
    ];
    for (const [name, saved, bundled] of copies) {
      const destination = path.join(hudDirectory, name);
      if (fs.existsSync(destination)) continue;
      const source = fs.existsSync(saved) ? saved : bundled;
      const data = fs.readFileSync(source);
      if (!isHudPng(data)) throw new Error(`Ảnh mẫu HUD không hợp lệ: ${source}`);
      fs.writeFileSync(destination, data, { flag: "wx" });
    }
    backupDirectory = hudDirectory;
  }
  const router = express.Router();
  const target = path.resolve(hudDirectory, fileName);
  const baseline = path.join(backupDirectory, "ScoreboardBackground.original.png");

  router.get("/cpr-background", (_req, res) => {
    try {
      const current = fs.readFileSync(target);
      if (!isHudPng(current)) return res.status(404).end();
      return res.set("Cache-Control", "no-cache").type("png").send(current);
    } catch {
      return res.status(404).end();
    }
  });

  router.get("/active", (_req, res) => {
    res.set("Cache-Control", "no-cache");
    if (!fs.existsSync(baseline)) return res.status(204).end();
    try {
      const current = fs.readFileSync(target);
      if (!isHudPng(current) || current.equals(fs.readFileSync(baseline))) return res.status(204).end();
      return res.set("X-Hud-Revision", revision(current)).type("png").send(current);
    } catch {
      return res.status(404).end();
    }
  });

  router.get("/reference", (_req, res) => {
    try {
      const current = fs.readFileSync(target);
      const original = fs.existsSync(baseline) ? fs.readFileSync(baseline) : current;
      if (!isHudPng(current) || !isHudPng(original)) {
        return res.status(422).json({ message: "Ảnh HUD hiện tại phải là PNG 330 × 590 px." });
      }
      return res.set("Cache-Control", "no-store").set("X-Hud-Revision", revision(current))
        .set("X-Hud-Scope", scoreboardOnly ? "scoreboard" : "hud")
        .type("png").send(original);
    } catch {
      return res.status(404).json({ message: "Không đọc được ScoreboardBackground.png trong HUD_PIC." });
    }
  });

  router.put("/background", (req, res, next) => {
    const origin = req.get("origin");
    if (origin && origin !== `${req.protocol}://${req.get("host")}`) {
      return res.status(403).json({ message: "Hãy áp dụng KV từ bảng điều khiển." });
    }
    next();
  }, express.raw({ type: "image/png", limit: "4mb" }), (req, res) => {
    if (!isHudPng(req.body)) {
      return res.status(400).json({ message: "Ảnh áp dụng phải là PNG 330 × 590 px." });
    }
    const temporary = path.join(path.dirname(target), `.${fileName}.${randomUUID()}.tmp`);
    try {
      const current = fs.readFileSync(target);
      if (req.get("X-Hud-Revision") !== revision(current)) {
        return res.status(409).json({ message: "HUD đã thay đổi. Hãy chọn lại KV để xem trước." });
      }
      if (current.equals(req.body)) return res.json({ unchanged: true, scoreboardOnly });

      fs.mkdirSync(backupDirectory, { recursive: true });
      if (!fs.existsSync(baseline)) fs.writeFileSync(baseline, current, { flag: "wx" });
      const backupName = `ScoreboardBackground.${new Date().toISOString().replace(/[:.]/g, "-")}.${randomUUID().slice(0, 8)}.png`;
      fs.writeFileSync(path.join(backupDirectory, backupName), current, { flag: "wx" });
      fs.writeFileSync(temporary, req.body, { flag: "wx" });
      fs.renameSync(temporary, target);
      return res.json({ backupName, revision: revision(req.body), scoreboardOnly });
    } catch {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {
        // A locked temporary file does not change the HUD being used.
      }
      return res.status(500).json({
        message: "Không thể ghi HUD_PIC. Kiểm tra quyền ghi hoặc đóng game rồi thử lại.",
      });
    }
  });

  return router;
}
