import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import express from "express";

type LogoUpload = { mime: string; version: string } & ({ data: string } | { fileName: string });

type TeamBrand = {
  displayName: string;
  logoName: string;
  upload?: LogoUpload;
};

const router = express.Router();
const filePath = path.resolve("team-branding.json");
const logoDirectory = path.resolve("team-logos");
const assetPath = path.resolve("template/Scoreboard/assets/teamAvatars");
const logoPattern = /\.(?:png|jpe?g|webp|gif)$/i;

function listLogos() {
  return fs.readdirSync(assetPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && logoPattern.test(entry.name))
    .map(entry => entry.name)
    .sort();
}

let savedTeams: Map<string, TeamBrand> | undefined;

function readTeams(): Map<string, TeamBrand> {
  if (savedTeams) return savedTeams;
  try {
    savedTeams = new Map(Object.entries(JSON.parse(fs.readFileSync(filePath, "utf8"))));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    savedTeams = new Map();
  }
  return savedTeams;
}

function publicBrand(team: string, brand: TeamBrand) {
  const { displayName, logoName, upload } = brand;
  return {
    displayName, logoName,
    uploadedLogo: upload ? `/api/team-branding/logo/${encodeURIComponent(team)}?v=${upload.version}` : "",
  };
}

function parseLogo(value: string) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return;
  const [, mime, data] = match;
  const image = Buffer.from(data, "base64");
  if (image.toString("base64") !== data) return;

  const valid = mime === "image/png" ? image.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
    : mime === "image/jpeg" ? image.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
    : mime === "image/gif" ? /^GIF8[79]a$/.test(image.toString("ascii", 0, 6))
    : image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP";
  if (!valid) return;
  const extension = mime === "image/jpeg" ? "jpg" : mime.slice("image/".length);
  return { mime, image, extension, version: createHash("sha256").update(image).digest("hex").slice(0, 16) };
}

router.get("/", (_req, res) => {
  const teams = Object.fromEntries(Array.from(readTeams(), ([team, brand]) => [team, publicBrand(team, brand)]));
  res.set("Cache-Control", "no-cache").json({ teams, logos: listLogos() });
});

router.get("/logo/:team", (req, res) => {
  const upload = readTeams().get(req.params.team)?.upload;
  if (!upload) return res.sendStatus(404);
  let data: Buffer;
  if ("fileName" in upload) {
    if (path.basename(upload.fileName) !== upload.fileName) return res.sendStatus(404);
    try {
      data = fs.readFileSync(path.join(logoDirectory, upload.fileName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return res.sendStatus(404);
      throw error;
    }
  } else {
    data = Buffer.from(upload.data, "base64");
  }
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "no-cache");
  return res.type(upload.mime).send(data);
});

router.put("/", express.json({ limit: "64mb" }), (req, res) => {
  const origin = req.get("origin");
  if (origin && origin !== `${req.protocol}://${req.get("host")}`) {
    return res.status(403).json({ message: "Hãy lưu tên và logo từ bảng điều khiển." });
  }
  const { team, logoData, logoOnly, displayNameOnly } = req.body ?? {};
  const key = typeof team === "string" ? team.trim().normalize("NFC").toUpperCase() : "";
  const existing = readTeams().get(key);
  const displayName = logoOnly === true ? existing?.displayName ?? "" : req.body?.displayName;
  const logoName = logoOnly === true || displayNameOnly === true ? existing?.logoName ?? "" : req.body?.logoName;
  if (!key || key.length > 80 || /[\x00-\x1F\x7F/\\]/.test(key)
    || typeof displayName !== "string" || displayName.trim().length > 60
    || typeof logoName !== "string" || (logoOnly !== true && displayNameOnly !== true && logoName && !listLogos().includes(logoName))
    || (logoOnly === true && typeof logoData !== "string")
    || (displayNameOnly === true && (logoOnly === true || logoData !== undefined))
    || (logoData !== undefined && logoData !== null && typeof logoData !== "string")) {
    return res.status(400).json({ message: "Kiểm tra mã đội, tên hiển thị và logo đã chọn." });
  }

  let upload = logoData === null ? undefined : existing?.upload;
  if (typeof logoData === "string") {
    const parsed = parseLogo(logoData);
    if (!parsed) {
      return res.status(400).json({ message: "Chọn ảnh PNG, JPG, WebP hoặc GIF hợp lệ." });
    }
    if (/[<>:"|?*]|\.$/.test(key) || /^(?:CON|PRN|AUX|NUL|COM[0-9¹²³]|LPT[0-9¹²³])(?:\.|$)/.test(key)) {
      return res.status(400).json({ message: "Mã đội không dùng được làm tên file logo." });
    }
    const fileName = `${key}.${parsed.extension}`;
    const logoPath = path.join(logoDirectory, fileName);
    fs.mkdirSync(logoDirectory, { recursive: true });
    fs.writeFileSync(`${logoPath}.tmp`, parsed.image);
    fs.renameSync(`${logoPath}.tmp`, logoPath);
    upload = { mime: parsed.mime, version: parsed.version, fileName };
  }
  const teams = new Map(readTeams());
  const brand = { displayName: displayName.trim(), logoName, upload };
  if (brand.displayName || brand.logoName || brand.upload) teams.set(key, brand);
  else teams.delete(key);

  fs.writeFileSync(`${filePath}.tmp`, JSON.stringify(Object.fromEntries(teams)));
  fs.renameSync(`${filePath}.tmp`, filePath);
  savedTeams = teams;
  return res.json(publicBrand(key, brand));
});

export default router;
