import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { RequestHandler } from "express";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function createHostedAccess(key: string | undefined) {
  if (!key || key.length < 16) {
    throw new Error("Set SCOREBOARD_CONTROL_KEY to a random value of at least 16 characters.");
  }
  const expectedKey = digest(key);
  const session = digest(`scoreboard-session:${key}`).toString("hex");
  const expectedSession = digest(session);
  const cookieName = "__Host-scoreboard-control";

  function authorized(req: IncomingMessage) {
    const cookie = req.headers.cookie?.split(";").map(value => value.trim())
      .find(value => value.startsWith(`${cookieName}=`));
    return Boolean(cookie && timingSafeEqual(digest(cookie.slice(cookieName.length + 1)), expectedSession));
  }

  const protect: RequestHandler = (req, res, next) => {
    const origin = req.get("origin");
    const reading = req.method === "GET" || req.method === "HEAD";
    const publicPath = req.path === "/api/health" || req.path.startsWith("/overlays/")
      || /^\/api\/team-branding(?:\/logo\/[^/]+)?$/.test(req.path)
      || /^\/api\/hud-kv\/(active|cpr-background)$/.test(req.path)
      || /^\/api\/scoreboard-visibility\/(events|cpr)$/.test(req.path);
    res.set("X-Content-Type-Options", "nosniff");
    if (reading && publicPath) return next();

    res.set("Cache-Control", "no-store");
    if (!reading && origin && origin !== `${req.protocol}://${req.get("host")}`) {
      return res.status(403).json({ message: "Hãy thao tác từ bảng điều khiển." });
    }
    if (reading && (req.path === "/" || req.path === "/control" || req.path === "/control.js")) return next();
    if (req.method === "POST" && req.path === "/control") return next();
    if (!authorized(req)) {
      return res.status(403).json({ message: "Hãy mở link điều khiển riêng." });
    }
    next();
  };

  const open: RequestHandler = (req, res) => {
    const key = req.body?.key;
    if (typeof key !== "string" || !timingSafeEqual(digest(key), expectedKey)) {
      return res.status(403).json({ message: "Link điều khiển không hợp lệ." });
    }
    return res.cookie(cookieName, session, {
      httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 7 * 24 * 60 * 60 * 1000,
    }).sendStatus(204);
  };

  return { authorized, protect, open };
}
