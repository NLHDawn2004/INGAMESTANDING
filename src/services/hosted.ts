import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { RequestHandler } from "express";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function createHostedAccess(password: string | undefined) {
  if (!password || password.length < 16) {
    throw new Error("Set SCOREBOARD_PASSWORD to a password of at least 16 characters.");
  }
  const expected = digest(`operator:${password}`);

  function authorized(req: IncomingMessage) {
    const header = req.headers.authorization;
    return Boolean(header?.startsWith("Basic ") && timingSafeEqual(
      digest(Buffer.from(header.slice(6), "base64").toString("utf8")),
      expected,
    ));
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
    if (!authorized(req)) {
      return res.set("WWW-Authenticate", 'Basic realm="INGAMESTANDING"')
        .status(401).json({ message: "Đăng nhập để mở bảng điều khiển." });
    }
    if (!reading && origin && origin !== `${req.protocol}://${req.get("host")}`) {
      return res.status(403).json({ message: "Hãy thao tác từ bảng điều khiển." });
    }
    next();
  };

  return { authorized, protect };
}
