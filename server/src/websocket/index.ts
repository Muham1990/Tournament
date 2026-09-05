import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { allowedOrigins } from "../utils/origins.js";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins(),
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join_tournament", (tournamentId: string) => {
      if (typeof tournamentId === "string") socket.join(`t:${tournamentId}`);
    });
    socket.on("leave_tournament", (tournamentId: string) => {
      if (typeof tournamentId === "string") socket.leave(`t:${tournamentId}`);
    });
  });

  return io;
}

export function emitTournament(tournamentId: string, event: string, payload: unknown) {
  io?.to(`t:${tournamentId}`).emit(event, payload);
}

export const Events = {
  FIGHT_STARTED: "fight_started",
  FIGHT_FINISHED: "fight_finished",
  WINNER_SELECTED: "winner_selected",
  FIGHT_UPDATED: "fight_updated",
  BRACKET_UPDATED: "bracket_updated",
  PARTICIPANT_ADVANCED: "participant_advanced",
  RESULT_UPDATED: "result_updated",
  TOURNAMENT_STARTED: "tournament_started",
  TOURNAMENT_FINISHED: "tournament_finished",
  SCHEDULE_UPDATED: "schedule_updated",
} as const;
