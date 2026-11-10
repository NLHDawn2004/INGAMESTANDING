import logger from "../../utils/logger";
import type { HandleLogDataDeps } from "./types";

export function processTeamEliminated(
  line: string,
  deps: HandleLogDataDeps,
): boolean {
  if (
    !line.includes("isTeamLastKill") ||
    !line.match(deps.checkTeamEliminatedRegex)
  ) {
    return false;
  }

  const [, threadId, isTeamLastKill]: any = line.match(
    deps.checkTeamEliminatedRegex,
  );
  const killedPlayerID = deps.lastDeathByThread.get(threadId);
  // A repeated last-kill marker must not produce a second announcement.
  deps.lastDeathByThread.delete(threadId);
  if (isTeamLastKill !== "True" || !killedPlayerID) return true;

  const originPlayerKilled = deps.alteredPlayerData.get(killedPlayerID);
  const teamName =
    deps.playerData.get(originPlayerKilled?.originPlayerID ?? "")?.teamName ??
    "";
  if (!teamName) return true;
  const buf = deps.ensureThreadBuffer(threadId);
  const teamMateID = Array.from(deps.alteredPlayerData.entries())
    .filter(([, v]) => v.teamName === teamName)
    .map((k) => k[1].originPlayerID);

  if (teamMateID.length < 4) {
    const listOnCsv = Array.from(deps.playerData.values()).filter(
      (p) => p.teamName === teamName,
    );

    for (const p of listOnCsv) {
      if (teamMateID.length >= 4) break;
      if (!teamMateID.includes(p.playerID)) {
        teamMateID.push(p.playerID);
      }
    }
  }

  buf.teamEliminated.push({
    playerID: killedPlayerID,
    originID: originPlayerKilled?.originPlayerID ?? "",
    teamName,
    elims: deps.teamElims.get(teamName) ?? 0,
    rank: deps.teamAlive.size + 1,
    teamMateID,
  });

  deps.teamAlive.delete(teamName);
  logger(
    "[Team Eliminated]",
    ` player=${killedPlayerID} team=${teamName} | ${line}`,
    "warn",
  );
  deps.scheduleSendForThread(threadId);

  return true;
}
