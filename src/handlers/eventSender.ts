type EventTarget = { send(message: string): void };
import type {
  AlteredEvent,
  DeadEvent,
  KnockdownEvent,
  RescueEvent,
  ReviveEvent,
  ScoreChangeEvent,
  TeamEliminatedEvent,
  TeamScoreInitedEvent,
  WinRateEvent,
} from "../types/log-events";

export function sendTeamInitEvent(
  socket: EventTarget | undefined,
  teamData: TeamScoreInitedEvent["teamData"],
  meta?: {
    todayTeamNames: string[];
    todayTeamsNotPlayed: string[];
  },
) {
  socket?.send(
    JSON.stringify({
      type: "team_data_inited",
      teamData,
      ...(meta
        ? {
          todayTeamNames: meta.todayTeamNames,
          todayTeamsNotPlayed: meta.todayTeamsNotPlayed,
        }
        : {}),
    } as TeamScoreInitedEvent),
  );
}

export function sendAlteredEvent(
  socket: EventTarget | undefined,
  playerData: AlteredEvent["playerData"],
) {
  socket?.send(
    JSON.stringify({
      type: "altered_event",
      playerData,
    } as AlteredEvent),
  );
}

export function sendScoreChangeEvent(
  socket: EventTarget | undefined,
  data: ScoreChangeEvent["data"],
) {
  socket?.send(
    JSON.stringify({
      type: "score_change",
      data,
    } as ScoreChangeEvent),
  );
}

export function sendKnockdownEvent(
  socket: EventTarget | undefined,
  data: KnockdownEvent["data"],
) {
  socket?.send(
    JSON.stringify({
      type: "knockdown_event",
      data,
    } as KnockdownEvent),
  );
}

export function sendDeadEvent(
  socket: EventTarget | undefined,
  data: DeadEvent["data"],
) {
  socket?.send(
    JSON.stringify({
      type: "dead_event",
      data,
    } as DeadEvent),
  );
}

export function sendRescueEvent(
  socket: EventTarget | undefined,
  data: RescueEvent["data"],
) {
  socket?.send(
    JSON.stringify({
      type: "rescue_event",
      data,
    } as RescueEvent),
  );
}

export function sendReviveEvent(
  socket: EventTarget | undefined,
  data: ReviveEvent["data"],
) {
  socket?.send(
    JSON.stringify({
      type: "revive_event",
      data,
    } as ReviveEvent),
  );
}

export function sendTeamEliminatedEvent(
  socket: EventTarget | undefined,
  data: TeamEliminatedEvent["data"],
) {
  socket?.send(
    JSON.stringify({
      type: "team_eliminated",
      data: [
        ...new Map(
          data
            .filter((item) => item.teamName)
            .map((item) => [item.teamName, item]),
        ).values(),
      ],
    } as TeamEliminatedEvent),
  );
}

export function sendWinRateEvent(
  socket: EventTarget | undefined,
  data: WinRateEvent["data"],
  isInit: boolean,
) {
  socket?.send(
    JSON.stringify({
      type: "winrate_update",
      data,
      isInit,
    } as WinRateEvent),
  );
}
