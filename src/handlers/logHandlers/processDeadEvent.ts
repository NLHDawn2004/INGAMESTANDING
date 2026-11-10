import logger from "../../utils/logger";
import type { HandleLogDataDeps } from "./types";

export function processDeadEvent(line: string, deps: HandleLogDataDeps): boolean {
  const match = line.match(deps.checkDeadRegex);
  if (!match) return false;

  const [, threadId, killedPlayerID, killerID]: any = match;
  deps.lastDeathByThread.set(threadId, killedPlayerID);
  const originPlayerKilled = deps.alteredPlayerData.get(killedPlayerID);
  const originPlayerKiller = deps.alteredPlayerData.get(killerID);

  const p = deps.playerData.get(originPlayerKilled?.originPlayerID ?? "");
  if (p) {
    const team = deps.winRateInputData.get(p.teamName);
    if (team) {
      const originId = originPlayerKilled?.originPlayerID ?? killedPlayerID;
      team.alivePlayers.delete(originId);
      if (team.alivePlayers.size > 4) {
        logger(
          "[WinRate] alivePlayers > 4 after detect",
          `team=${p.teamName} ids=${[...team.alivePlayers].join(",")}`,
          "warn",
        );
      }
    }
  }

  const buf = deps.ensureThreadBuffer(threadId);
  buf.deaths.push({
    victim: {
      id: killedPlayerID,
      originID: originPlayerKilled?.originPlayerID,
      name: originPlayerKilled?.overwriteName,
      teamName:
        deps.playerData.get(originPlayerKilled?.originPlayerID ?? "")?.teamName ??
        "",
    },
    killer: {
      id: killerID,
      originID: originPlayerKiller?.originPlayerID,
      name: originPlayerKiller?.overwriteName,
      teamName:
        deps.playerData.get(originPlayerKiller?.originPlayerID ?? "")?.teamName ??
        "",
    },
  });

  logger(
    "[Dead Event] ",
    `Người chơi ${originPlayerKilled?.overwriteName}(${killedPlayerID}) đã bị giết hoàn toàn bởi ${originPlayerKiller?.overwriteName}(${killerID})`,
    "warn",
  );
  deps.markWinRateDirty(threadId);
  deps.scheduleSendForThread(threadId);
  return true;
}
