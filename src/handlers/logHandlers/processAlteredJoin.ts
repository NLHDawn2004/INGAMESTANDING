import logger from "../../utils/logger";
import type { HandleLogDataDeps } from "./types";

export function processAlteredJoin(line: string, deps: HandleLogDataDeps): boolean {
  const match = line.match(deps.checkAlteredRegex);
  if(line.includes("Player Join") && !match) {
    logger(
      "[ID Bien doi]",
      `Khong the phan tich duoc log AlteredJoin: ${line}`,
      "warn",
    );
  }
  if (!match) return false;

  const [, threadId, userID, playerID, nickName]: any = match;
  const teamName = deps.playerData.get(userID)?.teamName ?? "";

  if(!deps.playerData.has(userID)) {
    logger(
      "[ID Bien doi]",
      `Không tìm thấy thông tin người chơi trong file CSV [${playerID}] - ${nickName}`,
      "warn",
    );
  }

  if (deps.alteredPlayerData.has(playerID)) {
    logger(
      "[ID Bien doi]",
      ` Da phat hien su trung lap id cua nguoi choi ${deps.alteredPlayerData.get(playerID)?.overwriteName}`,
      "warn",
    );
  }

  deps.alteredPlayerID.push(playerID);
  deps.alteredPlayerData.set(playerID, {
    originPlayerID: userID,
    overwriteName: nickName,
    teamName,
  });

  const team = deps.winRateInputData.get(teamName);
  const originId = userID;
  if (!team) {
    deps.winRateInputData.set(teamName, {
      alivePlayers: new Set([originId]),
      points: 0,
    });
  } else {
    team.alivePlayers.add(originId);
  }

  const teamData = deps.winRateInputData.get(teamName);
  if (teamData && teamData.alivePlayers.size > 4) {
    logger(
      "[WinRate] alivePlayers > 4 detected",
      `team=${teamName} ids=${[...teamData.alivePlayers].join(",")}`,
      "warn",
    );
  }

  const buf = deps.ensureThreadBuffer(threadId);
  buf.alteredData.push({
    id: playerID,
    originID: userID,
    name: nickName,
    teamName,
  });
  console.log(`[ID Bien doi]: ${line}`);
  deps.scheduleSendForThread(threadId);
  return true;
}
