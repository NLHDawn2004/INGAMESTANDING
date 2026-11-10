import express from 'express'
import path from 'path'
import fs from 'node:fs'
import os from 'node:os'
import { createHostedAccess } from './services/hosted';
import { LOG_PORT } from './constants/port';

import FreeFireMatchStats from './services/Stats';
import teamBranding from './services/teamBranding';
import { createHudKvRouter } from './services/hudKv';
import { createScoreboardVisibilityRouter } from './services/scoreboardVisibility';
import { Debugger } from './core/debugger';
import { v4 } from 'uuid';
import logger from './utils/logger';
import { configDotenv } from 'dotenv';

configDotenv();

const app = express();
const hosted = process.env.RENDER === "true" || process.env.SCOREBOARD_HOSTED === "true";
const hostedAccess = hosted ? createHostedAccess(process.env.SCOREBOARD_CONTROL_KEY || process.env.SCOREBOARD_PASSWORD) : null;
const port = Number(process.env.PORT || process.env.LOCAL_PORT || 3000);
const hostedLogDirectory = hosted ? fs.mkdtempSync(path.join(os.tmpdir(), "ff-scoreboard-")) : null;
const hostedLogPath = hostedLogDirectory && path.join(hostedLogDirectory, "debug.log");
if (hostedLogDirectory) {
  app.set("trust proxy", 1);
  app.use(hostedAccess!.protect);
  process.once("exit", () => fs.rmSync(hostedLogDirectory, { recursive: true, force: true }));
}

type GroupInput = {
  groupId: string;
  matchIds: string[];
  teamNames: string[];
  note: string;
};

type PlayerInput = {
  playerId: string;
  playerName: string;
  teamName: string;
};

let DebuggerObject: Debugger | null = null;
let currentListenerID: string | null = null;
let isListenerRunning = false;

// Accept Windows absolute/UNC paths and common relative paths, reject invalid filename chars.
const FILE_PATH_REGEX = /^(?!.*[<>|?*\r\n])(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/]?|\.{1,2}[\\/]|[^<>:"|?*\r\n]+[\\/])?[^<>:"|?*\r\n]+(?:[\\/][^<>:"|?*\r\n]+)*$/;

function normalizeFilePath(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^"+|"+$/g, '')
    .trim();
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateCreateListenerPayload(body: unknown): {
  ok: true;
  groups: GroupInput[];
  players: PlayerInput[];
  selectedGroupId: string;
  filePath: string;
} | {
  ok: false;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isObjectRecord(body)) {
    return { ok: false, errors: ['Body phải là object hợp lệ'] };
  }

  const filePath = normalizeFilePath(body.filePath);
  const selectedGroupIdRaw = body.selectedGroupId;

  const globalObject = isObjectRecord(body.global) ? body.global : undefined;
  const playersRaw = globalObject?.players ?? body.players;
  const groupsRaw = body.groups;
  const matchesRaw = body.matches;

  if (!Array.isArray(playersRaw)) {
    errors.push('global.players hoặc players phải là một mảng');
  }

  let normalizedGroups: GroupInput[] = [];

  if (Array.isArray(groupsRaw)) {
    normalizedGroups = groupsRaw.reduce<GroupInput[]>((acc, item, index) => {
      if (!isObjectRecord(item)) {
        errors.push(`groups[${index}] phải là object`);
        return acc;
      }

      const groupId = typeof item.groupId === 'string' ? item.groupId.trim() : '';
      const note = typeof item.note === 'string' ? item.note : '';
      const teamNames = Array.isArray(item.teamNames)
        ? item.teamNames.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [];
      const matchIdsSource = Array.isArray(item.matchIds)
        ? item.matchIds
        : (typeof item.matchId === 'string' && item.matchId.trim() ? [item.matchId] : []);

      if (!groupId) {
        errors.push(`groups[${index}].groupId phải là string không rỗng`);
        return acc;
      }

      const matchIds = matchIdsSource
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);

      acc.push({ groupId, note, matchIds, teamNames });
      return acc;
    }, []);
  } else if (Array.isArray(matchesRaw)) {
    normalizedGroups = matchesRaw.reduce<GroupInput[]>((acc, item, index) => {
      if (!isObjectRecord(item)) {
        errors.push(`matches[${index}] phải là object`);
        return acc;
      }

      const matchId = typeof item.matchId === 'string' ? item.matchId.trim() : '';
      const note = typeof item.note === 'string' ? item.note : '';

      if (!matchId) {
        errors.push(`matches[${index}].matchId phải là string không rỗng`);
        return acc;
      }

      acc.push({
        groupId: `group-${index + 1}`,
        matchIds: [matchId],
        teamNames: [],
        note,
      });
      return acc;
    }, []);
  } else {
    errors.push('groups phải là một mảng');
  }

  if (normalizedGroups.length === 0) {
    errors.push('Cần ít nhất 1 group');
  }

  if (Array.isArray(playersRaw)) {
    playersRaw.forEach((item, index) => {
      if (!isObjectRecord(item)) {
        errors.push(`global.players[${index}] phải là object`);
        return;
      }

      if (typeof item.playerId !== 'string' || !item.playerId.trim()) {
        errors.push(`global.players[${index}].playerId phải là string không rỗng`);
      }

      if (typeof item.playerName !== 'string' || !item.playerName.trim()) {
        errors.push(`global.players[${index}].playerName phải là string không rỗng`);
      }

      if (typeof item.teamName !== 'string' || !item.teamName.trim()) {
        errors.push(`global.players[${index}].teamName phải là string không rỗng`);
      }
    });
  }

  if (!filePath) {
    errors.push('filePath phải là string không rỗng');
  } else if (!FILE_PATH_REGEX.test(filePath)) {
    errors.push('filePath không hợp lệ');
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const selectedGroupId =
    typeof selectedGroupIdRaw === 'string' && selectedGroupIdRaw.trim()
      ? selectedGroupIdRaw.trim()
      : normalizedGroups[0].groupId;

  if (!normalizedGroups.some((group) => group.groupId === selectedGroupId)) {
    return {
      ok: false,
      errors: ['selectedGroupId không tồn tại trong danh sách groups']
    };
  }

  return {
    ok: true,
    groups: normalizedGroups,
    players: playersRaw as PlayerInput[],
    selectedGroupId,
    filePath
  };
}

// ============ Middleware ============
app.use('/api/team-branding', teamBranding);
const hostedHudDirectory = hosted ? path.resolve("hud-web") : undefined;
if (hostedHudDirectory) {
  fs.mkdirSync(hostedHudDirectory, { recursive: true });
  fs.copyFileSync("template/Scoreboard/assets/HudDefault.png", path.join(hostedHudDirectory, "ScoreboardBackground.png"));
  fs.copyFileSync("template/Scoreboard/assets/HudReference.png", path.join(hostedHudDirectory, "ScoreboardBackground.original.png"));
}
app.use('/api/hud-kv', createHudKvRouter(hostedHudDirectory, hostedHudDirectory));
app.use('/api/scoreboard-visibility', createScoreboardVisibilityRouter());
app.use(express.json());
// Serve static files from src/ui
const uiPath = path.resolve(process.cwd(), 'src/ui');
app.get('/api/runtime', (req, res) => res.json({
  hosted,
  canControl: !hostedAccess || hostedAccess.authorized(req),
}));
if (hostedAccess) {
  app.get('/control', (_req, res) => {
    res.set("Referrer-Policy", "no-referrer").sendFile(path.join(uiPath, "control.html"));
  });
  app.post('/control', hostedAccess.open);
}
app.use(express.static(uiPath, { index: false }));
app.use('/overlays', express.static(path.resolve(process.cwd(), 'template')));

// ============ CORS ============
app.use((req, res, next) => {
  if (hosted) return next();
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Vary', 'Origin, Access-Control-Request-Headers');
  res.header(
    'Access-Control-Allow-Headers',
    req.header('access-control-request-headers') || 'Content-Type, Cache-Control'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// ============ API Endpoints ============

/**
 * GET /api/match-stats?matchId=<id>
 * Lấy thông tin chi tiết trận đấu từ Free Fire API
 */
app.get('/api/match-stats', async (req, res) => {
  try {
    const matchId = req.query.matchId as string;
    if (!matchId) {
      return res.status(400).json({ status: "error", message: "MatchID là bắt buộc" });
    }
    const stats = await FreeFireMatchStats.getStats(matchId);
    res.json(stats);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ status: "error", message: "Lỗi server" });
  }
});

/**
 * GET /api/match-stats/batch?matchIds=<id1>,<id2>,...
 * Lấy thông tin chi tiết nhiều trận đấu (tối đa 8 trận)
 */
app.get('/api/match-stats/batch', async (req, res) => {
  try {
    const matchIdsStr = req.query.matchIds as string;
    if (!matchIdsStr) {
      return res.status(400).json({ status: "error", message: "matchIds là bắt buộc" });
    }
    const matchIds = matchIdsStr.split(',').map(id => id.trim());
    if (matchIds.length > 8) {
      return res.status(400).json({ status: "error", message: "Không được nhập quá 8 trận đấu!" });
    }
    const stats = await FreeFireMatchStats.getStats(matchIds);
    res.json(stats);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ status: "error", message: "Lỗi server" });
  }
});

/**
 * GET /api/health
 * Kiểm tra server có hoạt động không
 */
app.get('/api/health', (req, res) => {
  res.json({ status: "ok", message: "Server đang chạy", timestamp: new Date().toISOString() });
});

/**
 * GET /
 * Serve UI (index.html)
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(uiPath, "dashboard.html"));
});

app.post('/create-listener', (req, res) => {
  const validation = validateCreateListenerPayload(hosted && isObjectRecord(req.body)
    ? { ...req.body, filePath: "debug.log" } : req.body);

  if (!validation.ok) {
    return res.status(400).json({
      status: 'error',
      message: 'Dữ liệu không hợp lệ',
      errors: validation.errors
    });
  }

  if (!hosted && req.body.requireExistingFile === true) {
    if (!path.isAbsolute(validation.filePath) || !fs.statSync(validation.filePath, { throwIfNoEntry: false })?.isFile()) {
      return res.status(400).json({ status: 'error', message: 'Không tìm thấy file debug. Hãy dán đường dẫn đầy đủ.' });
    }
  }

  const playerDataMap = new Map(
    validation.players.map((item) => [
      item.playerId,
      {
        playerID: item.playerId,
        playerName: item.playerName,
        teamName: item.teamName
      }
    ])
  );

  const selectedGroup = validation.groups.find(
    (group) => group.groupId === validation.selectedGroupId
  );
  const selectedMatchIds = selectedGroup?.matchIds ?? [];
  const selectedTeamNames = selectedGroup?.teamNames ?? [];

  if(DebuggerObject) {
    DebuggerObject.stopTailing()
    DebuggerObject = null;

    logger("[Listener]", "Đã dừng listener cũ trước khi tạo mới", "info");
  }

  if (hostedLogPath) fs.writeFileSync(hostedLogPath, "");
  DebuggerObject = new Debugger({
    filePath: hostedLogPath || validation.filePath,
    shareHttpPort: hosted,
    readExistingLog: req.body.readExistingLog === true,
    matchIDs: selectedMatchIds,
    playerData: playerDataMap,
    teamNamesFallback: selectedTeamNames
  });

  currentListenerID = v4();
  isListenerRunning = false;

  return res.json({
    status: 'ok',
    message: 'Tạo listener thành công',
    listenerID: currentListenerID,
    groupId: validation.selectedGroupId,
    matchIdCount: selectedMatchIds.length,
    teamNameCount: selectedTeamNames.length
  });
});

if (hostedLogPath) {
  const maxLogBytes = 100 * 1024 * 1024;
  app.post("/live-log", express.raw({ type: "application/octet-stream", limit: "1mb" }), (req, res) => {
    if (!isListenerRunning || req.get("X-Listener-ID") !== currentListenerID) {
      return res.status(409).json({ message: "Phiên theo dõi này đã kết thúc." });
    }
    const offset = req.get("X-Log-Offset");
    if (!Buffer.isBuffer(req.body) || !req.body.length || !offset || !/^\d+$/.test(offset)) {
      return res.status(400).json({ message: "Phần dữ liệu debug không hợp lệ." });
    }
    const size = fs.statSync(hostedLogPath).size;
    if (Number(offset) !== size) return res.status(409).json({ message: "File debug không còn đồng bộ." });
    if (size + req.body.length > maxLogBytes) {
      return res.status(413).json({ message: "File debug vượt quá 100 MB. Hãy bắt đầu phiên với file mới." });
    }
    fs.appendFileSync(hostedLogPath, req.body);
    return res.sendStatus(204);
  });
}

app.post('/update-listener-matches', async (req, res) => {
  const { listenerID, matchIds, completedLiveMatchId } = req.body ?? {};
  const listener = DebuggerObject;
  if (!listener || !isListenerRunning || listenerID !== currentListenerID) {
    return res.status(409).json({ status: 'error', message: 'Phiên theo dõi này đã kết thúc.' });
  }
  if (!Array.isArray(matchIds) || !matchIds.every(id => typeof id === 'string' && /^\d+$/.test(id))
    || (completedLiveMatchId !== undefined && !matchIds.includes(completedLiveMatchId))) {
    return res.status(400).json({ status: 'error', message: 'Danh sách Match ID không hợp lệ.' });
  }

  try {
    await listener.updateCompletedMatches(matchIds, completedLiveMatchId);
    return res.json({ status: 'ok' });
  } catch (error) {
    return res.status(422).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Không thể cập nhật điểm cộng dồn.'
    });
  }
});

app.post('/stop-listener', (req, res) => {
  const listenerID = req.body.listenerID as string;
  if (!listenerID) {
    return res.status(400).json({
      status: 'error',
      message: 'listenerID là bắt buộc'
    });
  }

  if (!DebuggerObject || !currentListenerID) {
    return res.status(400).json({
      status: 'error',
      message: 'Chưa có listener nào để dừng'
    });
  }

  if (listenerID !== currentListenerID) {
    return res.status(400).json({
      status: 'error',
      message: 'listenerID không hợp lệ'
    });
  }

  if (isListenerRunning) {
    DebuggerObject.stopTailing();
    DebuggerObject = null;
    currentListenerID = null;
    isListenerRunning = false;
    if (hostedLogPath) fs.rmSync(hostedLogPath, { force: true });
    return res.json({
      status: 'ok',
      message: 'Đã dừng listener'
    });
  }

  return res.status(400).json({
    status: 'error',
    message: 'Listener hiện chưa chạy'
  });
});

app.post('/start-listener', (req, res) => {
  const listenerID = req.body.listenerID as string;
  if (!listenerID) {
    return res.status(400).json({
      status: 'error',
      message: 'listenerID là bắt buộc'
    });
  }

  if (!DebuggerObject || !currentListenerID) {
    return res.status(400).json({
      status: 'error',
      message: 'Chưa có listener nào đang chờ'
    });
  }

  if (listenerID !== currentListenerID) {
    return res.status(400).json({
      status: 'error',
      message: 'listenerID không hợp lệ'
    });
  }

  if (!isListenerRunning) {
    DebuggerObject.startTailing();
    isListenerRunning = true;
    return res.json({
      status: 'ok',
      message: 'Đã start listener'
    });
  }

  return res.status(400).json({
    status: 'error',
    message: 'Listener đã chạy trước đó'
  });
});

app.post('/kill-listener', (req, res) => {
  const listenerID = req.body.listenerID as string;
  if (!listenerID) {
    return res.status(400).json({
      status: 'error',
      message: 'listenerID là bắt buộc'
    });
  }

  if (!currentListenerID) {
    return res.status(400).json({
      status: 'error',
      message: 'Không có listener nào để hủy'
    });
  }

  if (listenerID !== currentListenerID) {
    return res.status(400).json({
      status: 'error',
      message: 'listenerID không hợp lệ'
    });
  }

  if (DebuggerObject) {
    DebuggerObject.stopTailing();
    DebuggerObject = null;
  }

  currentListenerID = null;
  isListenerRunning = false;
  if (hostedLogPath) fs.rmSync(hostedLogPath, { force: true });

  return res.json({
    status: 'ok',
    message: 'Đã hủy hoàn toàn listener'
  });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${port}`);
  console.log(`📱 Giao diện: http://localhost:${port}`);
  console.log(`📊 API Match Stats: http://localhost:${port}/api/match-stats?matchId=<id>`);
});

if (hostedAccess) {
  server.on("upgrade", (req, socket, head) => {
    const route = /^\/ws\/(\d+)$/.exec(req.url || "");
    if (!route || !DebuggerObject) return socket.destroy();
    const channel = Number(route[1]);
    if (channel === LOG_PORT && !hostedAccess.authorized(req)) return socket.destroy();
    DebuggerObject.upgradeSocket(channel, req, socket, head);
  });
}
