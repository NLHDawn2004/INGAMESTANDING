import { processAlteredJoin } from "./logHandlers/processAlteredJoin";
import { processDeadEvent } from "./logHandlers/processDeadEvent";
import { processRevive } from "./logHandlers/processRevive";
import { processTeamEliminated } from "./logHandlers/processTeamEliminated";
import { processTeamInit } from "./logHandlers/processTeamInit";
import { processTeamScoreChanged } from "./logHandlers/processTeamScoreChanged";
import type { HandleLogDataDeps } from "./logHandlers/types";

export async function handleLogData(
  lines: string[],
  deps: HandleLogDataDeps,
) {
  for (const line of lines) {

    if (processAlteredJoin(line, deps)) continue;
    if (processDeadEvent(line, deps)) continue;
    if (processTeamInit(line, deps)) continue;
    if (processTeamScoreChanged(line, deps)) continue;
    if (processRevive(line, deps)) continue;
    if (processTeamEliminated(line, deps)) continue;
  }
}
