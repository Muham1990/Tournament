import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { API_ORIGIN } from "../lib/config";

let socket: Socket | null = null;

function getSocket() {
  if (!socket) {
    socket = io(API_ORIGIN || undefined, { transports: ["websocket", "polling"], withCredentials: true });
  }
  return socket;
}

export function useTournamentSocket(tournamentId: string | undefined, onEvent: (event: string, payload: unknown) => void) {
  useEffect(() => {
    if (!tournamentId) return;
    const s = getSocket();
    s.emit("join_tournament", tournamentId);
    const events = [
      "fight_started", "fight_finished", "winner_selected", "fight_updated",
      "bracket_updated", "participant_advanced", "result_updated",
      "tournament_started", "tournament_finished", "schedule_updated",
    ];
    const handler = (event: string) => (payload: unknown) => onEvent(event, payload);
    const bound = events.map((e) => {
      const h = handler(e);
      s.on(e, h);
      return [e, h] as const;
    });
    return () => {
      s.emit("leave_tournament", tournamentId);
      bound.forEach(([e, h]) => s.off(e, h));
    };
  }, [tournamentId, onEvent]);
}
