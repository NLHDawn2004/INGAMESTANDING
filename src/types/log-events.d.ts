export interface ScoreChangeEvent {
  type: "score_change";
  data: {
    teamName: string;
    points: number;
    elims?: number;
  }[];
}

export interface TeamScoreInitedEvent {
  type: "team_data_inited";
  teamData: {
    teamName: string;
    elims: number;
    rankPoint: number;
    totalScore: number;
    teamID: string;
    championRushActive: boolean;
    isInTodayList?: boolean;
    isInTodayListButNotPlayed?: boolean;
  }[];
  todayTeamNames?: string[];
  todayTeamsNotPlayed?: string[];
}

export interface AlteredEvent {
  type: "altered_event";
  playerData: {
    id: string;
    originID: string;
    name: string;
    teamName: string;
  }[];
}

export interface KnockdownEvent {
  type: "knockdown_event";
  data: {
    downed: { id: string; originID?: string; name?: string; teamName: string };
    killer: { id: string; originID?: string; name?: string; teamName: string };
  }[];
}

export interface DeadEvent {
  type: "dead_event";
  data: {
    victim: { id: string; originID?: string; name?: string; teamName: string };
    killer: { id: string; originID?: string; name?: string; teamName: string };
  }[];
}

export interface RescueEvent {
  type: "rescue_event";
  data: {
    player: { id: string; originID?: string; name?: string; teamName: string };
  }[];
}

export interface RescuePendingEvent {
  type: "rescue_pending";
  data: RescueEvent["data"];
}

export interface RescueCancelEvent {
  type: "rescue_cancel";
  data: { playerID: string; originID?: string }[];
}

export interface ReviveEvent {
  type: "revive_event";
  data: {
    playerID: string;
    originID: string;
    teamName: string;
  }[];
}

export interface TeamEliminatedEvent {
  type: "team_eliminated";
  data: {
    playerID: string;
    originID?: string;
    teamName?: string;
    elims: number;
    rank: number;
    teamMateID: string[];
  }[];
}

export interface MatchEnter {
  type: "match_enter";
  timestamp: number;
  matchId: string;
}

export interface TeamResult {
  name: string;
  memberCount: number;
  points: number;
  winRate: number;
}

export interface WinRateEvent {
  type: "winrate_update";
  data: TeamResult[];
  isInit: boolean;
}

export interface PlayerData {
  teamName: string;
  playerID: string;
  playerName: string;
}

export interface TeamData {
  alivePlayers: Set<string>;
  points: number;
}
