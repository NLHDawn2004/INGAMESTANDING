import fs, { StatWatcher } from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import matchStats, { type TeamStats } from '../services/Stats';
import Utils from '../utils';
import logger from '../utils/logger';
import { handleLogData } from '../handlers/handleLogData';
import { LOG_REGEX } from '../constants/regex';
import {
  sendAlteredEvent,
  sendDeadEvent,
  sendKnockdownEvent,
  sendRescueEvent,
  sendReviveEvent,
  sendScoreChangeEvent,
  sendTeamEliminatedEvent,
  sendTeamInitEvent,
  sendWinRateEvent,
} from '../handlers/eventSender';
import type { HandleLogDataDeps } from '../handlers/logHandlers/types';
import type {
  AlteredEvent,
  DeadEvent,
  KnockdownEvent,
  MatchEnter,
  PlayerData,
  RescueCancelEvent,
  RescueEvent,
  RescuePendingEvent,
  ReviveEvent,
  ScoreChangeEvent,
  TeamData,
  TeamEliminatedEvent,
  TeamResult,
  TeamScoreInitedEvent,
  WinRateEvent,
} from '../types/log-events';
import { ELIMINATED_PORT, LOG_PORT, STANDING_PORT, WIN_RATE_PORT } from '../constants/port';
export type { PlayerData } from '../types/log-events';

function calcWinRate(teamsMap: Map<string, TeamData>): TeamResult[] {
  const activeTeams: {
    name: string;
    power: number;
    memberCount: number;
    points: number;
    rawWinRate: number;
    hundredthsRaw: number;
    hundredthsFloor: number;
    remainder: number;
  }[] = [];
  const eliminatedTeams: TeamResult[] = [];

  let totalPower = 0;

  teamsMap.forEach((data, name) => {
    const memberCount = data.alivePlayers.size;
    if (memberCount <= 0) {
      eliminatedTeams.push({
        name,
        memberCount: 0,
        points: data.points,
        winRate: 0,
      });
    } else {
      const power = Math.pow(memberCount, 2) * (1 + data.points / 10);
      totalPower += power;
      activeTeams.push({
        name,
        memberCount,
        points: data.points,
        power,
        rawWinRate: 0,
        hundredthsRaw: 0,
        hundredthsFloor: 0,
        remainder: 0,
      });
    }
  });

  if (totalPower === 0) {
    return [
      ...activeTeams.map((t) => ({
        name: t.name,
        memberCount: t.memberCount,
        points: t.points,
        winRate: 0,
      })),
      ...eliminatedTeams,
    ];
  }

  let currentHundredthsSum = 0;
  for (const team of activeTeams) {
    team.rawWinRate = (team.power / totalPower) * 100;
    team.hundredthsRaw = team.rawWinRate * 100;
    team.hundredthsFloor = Math.floor(team.hundredthsRaw + Number.EPSILON);
    team.remainder = team.hundredthsRaw - team.hundredthsFloor;
    currentHundredthsSum += team.hundredthsFloor;
  }

  let difference = 10000 - currentHundredthsSum;
  const sortedByRemainder = [...activeTeams].sort(
    (a, b) => b.remainder - a.remainder,
  );

  for (let i = 0; i < difference; i++) {
    const idx = i % sortedByRemainder.length;
    sortedByRemainder[idx].hundredthsFloor += 1;
  }

  const activeResults = activeTeams.map((t) => ({
    name: t.name,
    memberCount: t.memberCount,
    points: t.points,
    winRate: parseFloat((t.hundredthsFloor / 100).toFixed(2)),
  }));

  let totalActive = parseFloat(
    activeResults.reduce((s, r) => s + r.winRate, 0).toFixed(2),
  );
  if (totalActive > 100) {
    const excessHundredths = Math.round((totalActive - 100) * 100);
    const maxIdx = activeResults.reduce(
      (bestIdx, r, i, arr) => (r.winRate > arr[bestIdx].winRate ? i : bestIdx),
      0,
    );
    activeResults[maxIdx].winRate = parseFloat(
      (activeResults[maxIdx].winRate - excessHundredths / 100).toFixed(2),
    );
  }

  return [...activeResults, ...eliminatedTeams].sort(
    (a, b) => b.winRate - a.winRate,
  );
}

interface DebuggerOptions {
  filePath: string;
  readExistingLog?: boolean;
  matchIDs: string[];
  playerData: Map<string, PlayerData>;
  championRushActivePoint?: number;
  teamNamesFallback?: string[];
  payload?: any;
}

export class Debugger {
  private filePath: string;
  private readExistingLog: boolean;
  private stopped = false;
  private activeRead: fs.ReadStream | null = null;
  private queuedReadSize = 0;
  private standingHistory: string[] = [];
  private lastPosition: number = 0;
  private watcher: StatWatcher | null = null;
  private alteredPlayerID: string[] = []; // id bị biến đổi
  private alteredPlayerData: Map<
    string,
    {
      originPlayerID: string;
      overwriteName: string;
      teamName: string;
    }
  > = new Map();
  private threadBuffers: Map<
    string,
    {
      alteredData: AlteredEvent["playerData"];
      teamInit: TeamScoreInitedEvent["teamData"];
      teamScoreChange: ScoreChangeEvent["data"];
      knockdowns: KnockdownEvent["data"];
      deaths: DeadEvent["data"];
      rescues: RescueEvent["data"];
      revives: ReviveEvent["data"];
      teamEliminated: TeamEliminatedEvent["data"];
      winRates: TeamResult[];
      timer?: NodeJS.Timeout;
    }
  > = new Map();
  private winRateInputData: Map<string, TeamData> = new Map();
  private playerQueue: string[] = [];
  private matchIDs: string[] = [];
  private completedTeams: TeamStats[] = [];
  private matchUpdateVersion = 0;
  private appliedMatchUpdateVersion = 0;
  private completedLiveMatchId: string | null = null;
  private liveTeams = new Map<string, TeamScoreInitedEvent["teamData"][number]>();
  private liveScores = new Map<string, ScoreChangeEvent["data"][number]>();
  private debounceMs = 120;
  private teamElims: Map<string, number> = new Map();
  private pendingRescueConfirm: Map<string, NodeJS.Timeout> = new Map();
  private pendingAliveGuarantee: Map<string, NodeJS.Timeout> = new Map();
  private teamAlive: Set<string> = new Set();
  private lastDeathByThread = new Map<string, string>();
  private wss: WebSocketServer | undefined = undefined;
  private eliminatedServer: WebSocketServer | undefined = undefined;
  private winRateServer: WebSocketServer | undefined = undefined;
  private logSocketServer: WebSocketServer | undefined = undefined;
  private allTeamID: Map<string, string> = new Map();
  private playerData: Map<string, PlayerData> = new Map();
  private winRateDirtyThreads: Set<string> = new Set();
  private isInitWinRate = true;
  private teamNamesFallback: string[] = [];
  private payload: any;
  private checkAlteredRegex = LOG_REGEX.altered;
  private checkDeadRegex = LOG_REGEX.dead;
  private checkOnTeamScoreInit = LOG_REGEX.teamScoreInit;
  private checkTeamScoreChanged = LOG_REGEX.teamScoreChanged;
  private checkReviveRegex = LOG_REGEX.revive;
  private checkTeamEliminatedRegex = LOG_REGEX.teamEliminated;
  private championRushActivePoint: number | null = null;

  /**
   * @param filePath Đường dẫn đến file log cần theo dõi.
   * @param playerData Data người chơi
   */
  constructor({ filePath, readExistingLog = false, matchIDs, playerData, championRushActivePoint, teamNamesFallback, payload }: DebuggerOptions) {
    this.filePath = filePath;
    this.readExistingLog = readExistingLog;
    // Server 1
    this.wss = new WebSocketServer({ port: STANDING_PORT, host: "0.0.0.0" });
    this.wss.on("connection", socket => {
      for (const message of this.standingHistory) socket.send(message);
    });

    // Server 2
    this.eliminatedServer = new WebSocketServer({
      port: ELIMINATED_PORT,
      host: "0.0.0.0",
    });

    // Server 3
    this.winRateServer = new WebSocketServer({ port: WIN_RATE_PORT, host: "0.0.0.0" });

    this.logSocketServer = new WebSocketServer({ port: LOG_PORT, host: "0.0.0.0" });

    this.matchIDs = matchIDs;
    this.playerData = playerData;
    this.championRushActivePoint = championRushActivePoint || 0;
    this.teamNamesFallback = teamNamesFallback ?? [];
    this.payload = payload;
  }

  public startTailing(): void {
    const startMsg = `[Tailer] Bắt đầu theo dõi file: ${this.filePath}`;
    console.log(startMsg);
    this.sendLog(startMsg);
    if (this.matchIDs.length > 0) {
      void this.updateCompletedMatches(this.matchIDs).catch(error => {
        if (!this.stopped) this.sendLog(error.message, "standings", "warn");
      });
    }
    this.initializePosition()
      .then((existingSize) => {
        if (this.stopped) return;
        const watchMsg = `[Tailer] Đã bắt đầu watch file với interval 100ms`;
        console.log(watchMsg);
        this.sendLog(watchMsg);
        this.watcher = fs.watchFile(
          this.filePath,
          { interval: 100 },
          (curr, prev) => {
            this.handleFileChange(curr, prev);
          },
        );
        if (this.readExistingLog && existingSize > 0) {
          this.readNewData(existingSize, true);
        }
      })
      .catch((err) => {
        const errMsg = `[Tailer] Lỗi khởi tạo: ${err.message}`;
        console.error(errMsg);
        this.sendLog(errMsg);
      });
  }

  public stopTailing(): void {
    this.stopped = true;
    this.activeRead?.destroy();
    this.activeRead = null;
    if (this.watcher) {
      fs.unwatchFile(this.filePath);
      this.watcher = null;
      console.log(`[Tailer] Đã dừng theo dõi file: ${this.filePath}`);
    }

    for (const [threadId, buf] of this.threadBuffers.entries()) {
      if (buf.timer) {
        clearTimeout(buf.timer);
        buf.timer = undefined;
      }

      this.resolveWinRateForThread(threadId, buf);

      if (
        buf.teamInit.length > 0 ||
        buf.alteredData.length > 0 ||
        buf.teamScoreChange.length > 0 ||
        buf.knockdowns.length > 0 ||
        buf.deaths.length > 0 ||
        buf.rescues.length > 0
      ) {
        if (buf.teamInit.length > 0) {
          sendTeamInitEvent(
            this.standingEvents,
            Utils.removeDuplicatesObjects(buf.teamInit),
          );
        }
        if (buf.alteredData.length > 0) {
          sendAlteredEvent(this.standingEvents, buf.alteredData);
        }
        if (buf.teamScoreChange.length > 0) {
          this.publishLiveScores(buf.teamScoreChange);
        }
        if (buf.knockdowns.length > 0) {
          sendKnockdownEvent(this.standingEvents, buf.knockdowns);
        }
        if (buf.deaths.length > 0) {
          sendDeadEvent(this.standingEvents, buf.deaths);
        }
        if (buf.rescues.length > 0) {
          sendRescueEvent(this.standingEvents, buf.rescues);
        }

        if (buf.winRates.length > 0) {
          sendWinRateEvent(this.winRateEvents, buf.winRates, this.isInitWinRate);
        }
      }
    }
    this.threadBuffers.clear();

    // Clear any pending rescue confirm timers
    for (const [pid, t] of this.pendingRescueConfirm.entries()) {
      clearTimeout(t);
    }
    this.pendingRescueConfirm.clear();
    // Clear any pending alive guarantee timers
    for (const [pid, t] of this.pendingAliveGuarantee.entries()) {
      clearTimeout(t);
    }
    this.pendingAliveGuarantee.clear();

    for (const server of [this.wss, this.eliminatedServer, this.winRateServer, this.logSocketServer]) {
      server?.clients.forEach(client => client.terminate());
    }

    // Đóng các Server để giải phóng Port
    this.wss?.close(() => console.log("Port 11019 closed"));
    this.eliminatedServer?.close(() => console.log("Port 11020 closed"));
    this.winRateServer?.close(() => console.log("Port 11021 closed"));
    this.logSocketServer?.close(() => console.log("Port 11022 closed"));

  }

  /**
   * Lấy kích thước file hiện tại để thiết lập lastPosition.
   */
  private initializePosition(): Promise<number> {
    return new Promise((resolve) => {
      fs.stat(this.filePath, (err, stats) => {
        if (err) {
          console.warn(
            `[Tailer] Không tìm thấy file ban đầu. Bắt đầu với vị trí 0.`,
          );
          this.lastPosition = 0; // Bắt đầu từ 0 nếu file chưa tồn tại
          return resolve(0);
        }
        this.lastPosition = this.readExistingLog ? 0 : stats.size;
        console.log(`[Tailer] Thiết lập vị trí ban đầu: ${this.lastPosition}`);
        resolve(stats.size);
      });
    });
  }

  /**
   * Xử lý khi kích thước file thay đổi.
   */
  private handleFileChange(curr: fs.Stats, prev: fs.Stats): void {
    const newSize = curr.size;

    if (newSize < prev.size) {
      // Trường hợp Log Rotation/Truncate
      const msg = "[Tailer] File log bị cắt ngắn. Đọc lại từ đầu.";
      console.log(msg);
      this.sendLog(msg);
      this.activeRead?.destroy();
      this.activeRead = null;
      this.queuedReadSize = 0;
      this.lastDeathByThread.clear();
      this.lastPosition = 0;
      // Tiếp tục ngay lập tức để đọc dữ liệu mới từ 0
    }

    if (newSize > this.lastPosition) {
      const bytesMsg = `[Tailer] Phát hiện ${newSize - this.lastPosition} bytes mới. Đang đọc...`;
      this.readNewData(newSize);
    }
  }

  private broadcast(server: WebSocketServer | undefined, message: string): void {
    server?.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });
  }

  private standingEvents = {
    send: (message: string) => {
      const { type } = JSON.parse(message);
      // Keep events needed to reconstruct the scoreboard for a late connection.
      if (["team_data_inited", "altered_event", "score_change", "dead_event", "revive_event"].includes(type)) {
        this.standingHistory.push(message);
      }
      this.broadcast(this.wss, message);
    },
  };
  private winRateEvents = { send: (message: string) => this.broadcast(this.winRateServer, message) };

  private sendLog(
    message: string,
    source: string = "debugger",
    level: "info" | "warn" | "error" | "success" | "debug" = "info",
  ): void {
    try {
      const timestamp = new Date().toLocaleString("vi-VN", { hour12: false });
      const logEvent = {
        type: "log",
        timestamp,
        source,
        level,
        message,
        timestamp_ms: Date.now(),
      };
      this.broadcast(this.logSocketServer, JSON.stringify(logEvent));
    } catch (error) {
      console.error("[Debugger] Error sending log to websocket:", error);
    }
  }

  private sendRawLogLines(lines: string[]): void {
    if (!Array.isArray(lines) || lines.length === 0) {
      return;
    }

    for (const line of lines) {
      const logLine = String(line || "").trimEnd();
      if (!logLine.trim()) {
        continue;
      }
      this.sendLog(logLine, "raw", "debug");
    }
  }

  private createHandleLogDataDeps(): HandleLogDataDeps {
    return {
      checkAlteredRegex: this.checkAlteredRegex,
      checkDeadRegex: this.checkDeadRegex,
      checkOnTeamScoreInit: this.checkOnTeamScoreInit,
      checkTeamScoreChanged: this.checkTeamScoreChanged,
      checkReviveRegex: this.checkReviveRegex,
      checkTeamEliminatedRegex: this.checkTeamEliminatedRegex,
      alteredPlayerID: this.alteredPlayerID,
      alteredPlayerData: this.alteredPlayerData,
      playerData: this.playerData,
      winRateInputData: this.winRateInputData,
      playerQueue: this.playerQueue,
      allTeamID: this.allTeamID,
      teamElims: this.teamElims,
      teamAlive: this.teamAlive,
      lastDeathByThread: this.lastDeathByThread,
      markWinRateDirty: (threadId: string) => {
        this.winRateDirtyThreads.add(threadId);
      },
      ensureThreadBuffer: (threadId: string) => this.ensureThreadBuffer(threadId),
      scheduleSendForThread: (threadId: string) =>
        this.scheduleSendForThread(threadId),
      getPayload: () => this.payload
    };
  }

  private resolveWinRateForThread(
    threadId: string,
    buf: { winRates: TeamResult[] },
  ) {
    if (!this.winRateDirtyThreads.has(threadId)) {
      return;
    }

    buf.winRates = calcWinRate(this.winRateInputData);
    this.winRateDirtyThreads.delete(threadId);
  }

  private async handleData(lines: string[], historical: boolean) {
    await handleLogData(lines, this.createHandleLogDataDeps());
    if (historical) {
      for (const buffer of this.threadBuffers.values()) buffer.teamEliminated.length = 0;
    }
  }

  private ensureThreadBuffer(threadId: string) {
    if (!this.threadBuffers.has(threadId)) {
      this.threadBuffers.set(threadId, {
        alteredData: [],
        teamInit: [],
        teamScoreChange: [],
        knockdowns: [],
        deaths: [],
        rescues: [],
        revives: [],
        teamEliminated: [],
        winRates: [],
      });
    }
    // Non-null assertion because we just set it if missing
    return this.threadBuffers.get(threadId)!;
  }

  private scheduleSendForThread(threadId: string) {
    const buf = this.ensureThreadBuffer(threadId);
    if (buf.timer) clearTimeout(buf.timer);
    buf.timer = setTimeout(
      async () => await this.flushThreadBuffer(threadId),
      this.debounceMs,
    );
  }

  public async updateCompletedMatches(ids: string[], completedLiveMatchId?: string): Promise<void> {
    const matchIds = [...new Set(ids)];
    const version = ++this.matchUpdateVersion;
    const batches: string[][] = [];
    for (let index = 0; index < matchIds.length; index += 8) {
      batches.push(matchIds.slice(index, index + 8));
    }

    const matches = await Promise.all(batches.map(async batch => {
      const result = await matchStats.getStats(batch).catch(() => {
        throw new Error("Không kết nối được FF Esports. Hãy thử lại.");
      });
      const byId = new Map((result.data?.data?.team_stats ?? []).map(match => [String(match.match_id), match.team_stats]));
      return batch.map(id => {
        const teams = byId.get(id);
        if (result.status !== "success" || !Array.isArray(teams) || !teams.length) {
          throw new Error(`FF Esports chưa có điểm cho Match ID ${id}. Kiểm tra ID hoặc thử lại sau.`);
        }
        return teams;
      });
    }));

    if (this.stopped || version < this.appliedMatchUpdateVersion) {
      throw new Error("Phiên theo dõi đã thay đổi. Hãy thử lại.");
    }
    this.appliedMatchUpdateVersion = version;
    this.completedTeams = matches.flat(2);
    this.matchIDs = matchIds;
    const liveId = completedLiveMatchId ?? this.completedLiveMatchId;
    this.completedLiveMatchId = liveId && matchIds.includes(liveId) ? liveId : null;
    if (this.liveTeams.size) this.publishStandings();
  }

  private publishLiveScores(scores: ScoreChangeEvent["data"]) {
    for (const score of scores) this.liveScores.set(score.teamName, score);
    if (!this.completedLiveMatchId) sendScoreChangeEvent(this.standingEvents, scores);
  }

  private publishStandings() {
    const todayTeamSet = new Set(
      this.teamNamesFallback
        .map((name) => String(name || "").trim())
        .filter(Boolean),
    );

    const teamMap = new Map<string, TeamScoreInitedEvent["teamData"][number]>();
    // Chỉ đánh dấu "đã thi đấu" theo trận hiện tại đang chạy (dựa trên log init realtime).
    const playedTeamSet = new Set<string>();

    const upsertTeam = (
      teamNameRaw: unknown,
      teamIDRaw: unknown = "-1",
    ): TeamScoreInitedEvent["teamData"][number] | null => {
      const teamName = String(teamNameRaw || "").trim();
      if (!teamName) return null;

      const teamID = String(teamIDRaw || "-1");
      const existing = teamMap.get(teamName);
      if (existing) {
        if (existing.teamID === "-1" && teamID !== "-1") {
          existing.teamID = teamID;
        }
        return existing;
      }

      const created: TeamScoreInitedEvent["teamData"][number] = {
        teamName,
        totalScore: 0,
        elims: 0,
        rankPoint: 0,
        teamID,
        championRushActive: false,
      };
      teamMap.set(teamName, created);
      return created;
    };

    for (const team of this.liveTeams.values()) {
      const item = upsertTeam(team.teamName, team.teamID);
      if (!item) continue;
      // Team xuất hiện trong luồng teamInit của trận hiện tại được xem là đã thi đấu.
      playedTeamSet.add(item.teamName);
      item.totalScore += Number(team.totalScore || 0);
      item.elims += Number(team.elims || 0);
      item.rankPoint += Number(team.rankPoint || 0);
      item.championRushActive =
        item.championRushActive || Boolean(team.championRushActive);
    }

    for (const teamStats of this.completedTeams) {
      const team = upsertTeam(teamStats.team_name);
      if (!team) continue;
      team.totalScore += Number(teamStats.total_score || 0);
      team.elims += Number(teamStats.kills || 0);
      team.rankPoint += Number(teamStats.survival_score || 0);
      if (this.championRushActivePoint !== null && team.totalScore >= this.championRushActivePoint) {
        team.championRushActive = true;
      }
    }

    for (const todayTeam of todayTeamSet) {
      upsertTeam(todayTeam);
    }

    for (const player of this.playerData.values()) {
      upsertTeam(player.teamName);
    }

    const teamDataToSend = Array.from(teamMap.values()).sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.elims !== a.elims) return b.elims - a.elims;
      return b.rankPoint - a.rankPoint;
    });

    const todayTeamNames: string[] = [];
    const todayTeamsNotPlayed: string[] = [];
    for (const team of teamDataToSend) {
      const isInTodayList = todayTeamSet.size
        ? todayTeamSet.has(team.teamName)
        : playedTeamSet.has(team.teamName);
      const isInTodayListButNotPlayed =
        isInTodayList && !playedTeamSet.has(team.teamName);

      team.isInTodayList = isInTodayList;
      team.isInTodayListButNotPlayed = isInTodayListButNotPlayed;

      if (isInTodayList) {
        todayTeamNames.push(team.teamName);
      }
      if (isInTodayListButNotPlayed) {
        todayTeamsNotPlayed.push(team.teamName);
      }
    }

    sendTeamInitEvent(this.standingEvents, teamDataToSend, {
      todayTeamNames,
      todayTeamsNotPlayed,
    });

    if (!this.completedLiveMatchId && this.liveScores.size) {
      sendScoreChangeEvent(this.standingEvents, [...this.liveScores.values()]);
    }
  }

  private async flushThreadBuffer(threadId: string) {
    const buf = this.threadBuffers.get(threadId);
    if (!buf) return;

    this.resolveWinRateForThread(threadId, buf);

    if (buf.teamInit.length > 0) {
      for (const team of buf.teamInit) this.liveTeams.set(team.teamID, team);
      buf.teamInit = [];
      this.publishStandings();
    }

    if (buf.alteredData.length > 0) {
      sendAlteredEvent(this.standingEvents, buf.alteredData);
      buf.alteredData = [];
    }

    if (buf.teamScoreChange.length > 0) {
      this.publishLiveScores(buf.teamScoreChange);
      buf.teamScoreChange = [];
    }

    if (buf.knockdowns.length > 0) {
      sendKnockdownEvent(this.standingEvents, buf.knockdowns);
      buf.knockdowns = [];
    }

    if (buf.deaths.length > 0) {
      sendDeadEvent(this.standingEvents, buf.deaths);
      buf.deaths = [];
    }

    if (buf.rescues.length > 0) {
      sendRescueEvent(this.standingEvents, buf.rescues);
      buf.rescues = [];
    }

    if (buf.revives.length > 0) {
      sendReviveEvent(this.standingEvents, buf.revives);
      buf.revives = [];
    }

    if (buf.teamEliminated && buf.teamEliminated.length > 0) {
      const eliminatedClients = this.eliminatedServer?.clients
        ? Array.from(this.eliminatedServer.clients).filter(
          (client) => client.readyState === WebSocket.OPEN,
        )
        : [];

      if (eliminatedClients.length === 0) {
        logger("[ELIMINATED]", "Khong co client nao dang ket noi de gui team_eliminated", "warn");
      } else {
        logger("[ELIMINATED]", `Gui team_eliminated den ${eliminatedClients.length} client`, "info");
        eliminatedClients.forEach((client) => {
          sendTeamEliminatedEvent(client, buf.teamEliminated);
        });
      }
      buf.teamEliminated = [];
    }

    if (buf.winRates.length > 0) {
      sendWinRateEvent(this.winRateEvents, buf.winRates, this.isInitWinRate);
      logger("[WINRATE]", "Winrate đã được gửi", "success");
      buf.winRates = [];
      this.isInitWinRate = false;
    }

    if (buf.timer) {
      clearTimeout(buf.timer);
      buf.timer = undefined;
    }
    if (
      buf.teamInit.length === 0 &&
      buf.alteredData.length === 0 &&
      buf.teamScoreChange.length === 0
    ) {
      this.threadBuffers.delete(threadId);
    }
  }

  /**
   * Đọc dữ liệu mới từ vị trí lastPosition đến newSize.
   */
  private readNewData(newSize: number, historical = false): void {
    if (this.stopped || newSize <= this.lastPosition) return;
    if (this.activeRead) {
      this.queuedReadSize = Math.max(this.queuedReadSize, newSize);
      return;
    }
    const stream = fs.createReadStream(this.filePath, {
      start: this.lastPosition,
      end: newSize - 1,
      encoding: "utf8",
    });
    this.activeRead = stream;

    // Xử lý buffer dòng: Dữ liệu có thể bị cắt nửa dòng
    let bufferedData = "";

    stream.on("data", (chunk: string | Buffer) => {
      const data = chunk.toString();

      bufferedData += data;

      const lines = bufferedData.split(/\r?\n/);

      // Giữ lại phần tử cuối cùng (có thể là một dòng bị cắt)
      bufferedData = lines.pop() || "";

      if (lines.length > 0) {
        this.handleData(lines, historical);
      }
    });

    stream.on("end", () => {
      // Sau khi đọc xong, nếu buffer còn dữ liệu, đó là dòng log cuối cùng
      // KHÔNG KẾT THÚC BẰNG \n
      const remainingLines = bufferedData
        .toString()
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);

      if (remainingLines.length > 0) {
        this.handleData(remainingLines, historical);
      }
      // Cập nhật vị trí sau khi Stream kết thúc thành công
      this.lastPosition = newSize;
      this.activeRead = null;
      const queuedSize = this.queuedReadSize;
      this.queuedReadSize = 0;
      this.readNewData(queuedSize);
      if (historical) {
        fs.stat(this.filePath, (error, stats) => {
          if (!error) this.readNewData(stats.size);
        });
      }
    });

    stream.on("error", (e) => {
      if (this.activeRead === stream) this.activeRead = null;
      const errMsg = `[Tailer] Lỗi khi đọc Stream: ${e.message}`;
      console.error(errMsg);
      this.sendLog(errMsg);
    });
  }
}
