import logger from "../../utils/logger";
import type { HandleLogDataDeps } from "./types";

export function processRevive(line: string, deps: HandleLogDataDeps): boolean {
  const match = line.match(deps.checkReviveRegex);
  if (!match) return false;

  const [, threadId, playerID]: any = match;
  const buf = deps.ensureThreadBuffer(threadId);
  const originPlayerData = deps.alteredPlayerData.get(playerID);
  const playerInf = deps.playerData.get(originPlayerData?.originPlayerID ?? "");
  if (playerInf) {
    const team = deps.winRateInputData.get(playerInf.teamName);
    const originId = originPlayerData?.originPlayerID ?? playerID;
    if (team) {
      team.alivePlayers.add(originId);
    }
  }

  buf.revives.push({
    playerID,
    teamName: playerInf?.teamName ?? "",
    originID: originPlayerData?.originPlayerID ?? "",
  });

  const p = deps.playerData.get(originPlayerData?.originPlayerID ?? "");
  if (p) {
    const team = deps.winRateInputData.get(p.teamName);
    if (team) {
      team.alivePlayers.add(p.playerID);
    }
  }

  logger("[Revive Log]", `${playerInf?.teamName} revive ${playerID}`, "warn");
  deps.markWinRateDirty(threadId);
  deps.scheduleSendForThread(threadId);
  return true;
}
