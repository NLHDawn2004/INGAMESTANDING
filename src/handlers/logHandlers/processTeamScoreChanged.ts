import type { HandleLogDataDeps } from "./types";

export function processTeamScoreChanged(
  line: string,
  deps: HandleLogDataDeps,
): boolean {
  const match = line.match(deps.checkTeamScoreChanged);
  if (!match) return false;

  const [, threadId, teamID, teamScore]: any = match;
  const buf = deps.ensureThreadBuffer(threadId);
  const teamName = deps.allTeamID.get(teamID);

  if (deps.playerQueue.length > 0) {
    for (const playerID of deps.playerQueue) {
      const player = deps.playerData.get(playerID);
      if (player && deps.winRateInputData.has(player.teamName)) {
        const cur = deps.winRateInputData.get(player.teamName);
        if (cur) cur.alivePlayers.add(playerID);

        const index = deps.playerQueue.indexOf(playerID);
        if (index !== -1) {
          deps.playerQueue.splice(index, 1);
        }
      }
    }
  }

  if (deps.winRateInputData.has(teamName ?? "")) {
    const cur = deps.winRateInputData.get(teamName ?? "");
    if (cur) {
      cur.points = Number(teamScore);
    }
  }

  buf.teamScoreChange.push({
    teamName: teamName ?? "",
    points: Number(teamScore),
    elims: Number(teamScore),
  });
  deps.teamElims.set(teamName ?? "", Number(teamScore));
  deps.scheduleSendForThread(threadId);

  return true;
}
