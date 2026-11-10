import type { HandleLogDataDeps } from "./types";

export function processTeamInit(line: string, deps: HandleLogDataDeps): boolean {
  if (
    !line.includes("OnTeamScoreInited") ||
    !line.match(deps.checkOnTeamScoreInit)
  ) {
    return false;
  }

  const [, threadId, teamName, teamID]: any = line.match(
    deps.checkOnTeamScoreInit,
  );
  deps.allTeamID.set(teamID, teamName);
  console.log(`[Da tim thay khoi tao diem]: ${line}`);
  const buf = deps.ensureThreadBuffer(threadId);

  if (!deps.winRateInputData.has(teamName)) {
    deps.winRateInputData.set(teamName, {
      alivePlayers: new Set(),
      points: 0,
    });
  }

  deps.teamAlive.add(teamName);
  buf.teamInit.push({
    teamName,
    elims: 0,
    rankPoint: 0,
    totalScore: 0,
    teamID,
    championRushActive: false,
  });
  deps.scheduleSendForThread(threadId);
  return true;
}
