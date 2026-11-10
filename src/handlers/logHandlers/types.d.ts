import type { TeamData } from "../../types/log-events";

export interface PlayerDataEntry {
  teamName: string;
  playerID: string;
  playerName: string;
}

export interface TeamDataEntry extends TeamData {}

export interface ThreadBuffer {
  alteredData: any[];
  teamInit: any[];
  teamScoreChange: any[];
  knockdowns: any[];
  deaths: any[];
  rescues: any[];
  revives: any[];
  teamEliminated: any[];
  winRates: any[];
}

export interface HandleLogDataDeps {
  checkAlteredRegex: RegExp;
  checkDeadRegex: RegExp;
  checkOnTeamScoreInit: RegExp;
  checkTeamScoreChanged: RegExp;
  checkReviveRegex: RegExp;
  checkTeamEliminatedRegex: RegExp;
  alteredPlayerID: string[];
  alteredPlayerData: Map<
    string,
    {
      originPlayerID: string;
      overwriteName: string;
      teamName: string;
    }
  >;
  playerData: Map<string, PlayerDataEntry>;
  winRateInputData: Map<string, TeamDataEntry>;
  playerQueue: string[];
  allTeamID: Map<string, string>;
  teamElims: Map<string, number>;
  teamAlive: Set<string>;
  lastDeathByThread: Map<string, string>;
  markWinRateDirty: (threadId: string) => void;
  ensureThreadBuffer: (threadId: string) => ThreadBuffer;
  scheduleSendForThread: (threadId: string) => void;
  getPayload: () => any
}
