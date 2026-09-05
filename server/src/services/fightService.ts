import type { Prisma, WinMethod } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { resolveWinnerLoser } from "./fightEngine.js";
import { emitTournament, Events } from "../websocket/index.js";

const fightInclude = {
  participantA: { include: { country: true, club: true } },
  participantB: { include: { country: true, club: true } },
  winner: { include: { country: true, club: true } },
  loser: { include: { country: true, club: true } },
  tatami: true,
  category: true,
} satisfies Prisma.FightInclude;

async function loadFight(id: string) {
  const fight = await prisma.fight.findUnique({ where: { id }, include: fightInclude });
  if (!fight) throw new AppError("NOT_FOUND", "Бой не найден", 404);
  return fight;
}

export async function startFight(id: string) {
  const fight = await loadFight(id);
  if (fight.status === "FINISHED") {
    throw new AppError("FIGHT_FINISHED", "Бой уже завершён");
  }
  if (!fight.participantAId || !fight.participantBId) {
    throw new AppError("INCOMPLETE", "В бое не хватает участника");
  }
  const updated = await prisma.fight.update({
    where: { id },
    data: { status: "LIVE", startedAt: new Date() },
    include: fightInclude,
  });
  emitTournament(updated.tournamentId, Events.FIGHT_STARTED, updated);
  emitTournament(updated.tournamentId, Events.FIGHT_UPDATED, updated);
  return updated;
}

async function placeWinnerInNext(fight: {
  winnerId: string | null;
  nextFightId: string | null;
  nextSlot: "A" | "B" | null;
  tournamentId: string;
}) {
  if (!fight.winnerId || !fight.nextFightId || !fight.nextSlot) return;
  const next = await prisma.fight.findUnique({ where: { id: fight.nextFightId } });
  if (!next) return;
  if (next.status === "FINISHED" || next.status === "LIVE") return;
  const data = fight.nextSlot === "A" ? { participantAId: fight.winnerId } : { participantBId: fight.winnerId };
  let updated = await prisma.fight.update({ where: { id: next.id }, data, include: fightInclude });
  const a = updated.participantAId;
  const b = updated.participantBId;
  if (!updated.winnerId && ((updated.slotABye && b) || (updated.slotBBye && a))) {
    const winnerId = updated.slotABye ? b : a;
    updated = await prisma.fight.update({
      where: { id: next.id },
      data: { status: "BYE", winnerId, winMethod: "BYE" },
      include: fightInclude,
    });
    await placeWinnerInNext(updated);
  }
  emitTournament(fight.tournamentId, Events.PARTICIPANT_ADVANCED, {
    fightId: next.id,
    participantId: fight.winnerId,
    slot: fight.nextSlot,
  });
  emitTournament(fight.tournamentId, Events.FIGHT_UPDATED, updated);
}

async function placeLoserInThirdPlace(fight: {
  id: string;
  loserId: string | null;
  isThirdPlace: boolean;
  roundName: string;
  bracketId: string | null;
  tournamentId: string;
}) {
  if (!fight.loserId || fight.isThirdPlace || fight.roundName !== "SEMIFINAL" || !fight.bracketId) return;
  const third = await prisma.fight.findFirst({
    where: { bracketId: fight.bracketId, isThirdPlace: true },
  });
  if (!third) return;
  const data = !third.participantAId
    ? { participantAId: fight.loserId }
    : !third.participantBId
      ? { participantBId: fight.loserId }
      : null;
  if (!data) return;
  const updated = await prisma.fight.update({ where: { id: third.id }, data, include: fightInclude });
  emitTournament(fight.tournamentId, Events.FIGHT_UPDATED, updated);
}

async function refreshResults(categoryId: string, tournamentId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      brackets: { include: { fights: true } },
    },
  });
  if (!category) return;
  const bracket = category.brackets[0];
  if (!bracket) return;

  const final = bracket.fights.find((f) => f.roundName === "FINAL" && !f.isThirdPlace);
  const third = bracket.fights.find((f) => f.isThirdPlace);
  if (!final?.winnerId) return;

  await prisma.result.deleteMany({ where: { categoryId, official: false } });

  const rows: Array<{ participantId: string; place: number; medal: "GOLD" | "SILVER" | "BRONZE" }> = [
    { participantId: final.winnerId, place: 1, medal: "GOLD" },
  ];
  if (final.loserId) {
    rows.push({ participantId: final.loserId, place: 2, medal: "SILVER" });
  }

  if (category.bronzeMode === "ONE" && third?.winnerId) {
    rows.push({ participantId: third.winnerId, place: 3, medal: "BRONZE" });
  } else if (category.bronzeMode === "TWO") {
    const semis = bracket.fights.filter((f) => f.roundName === "SEMIFINAL" && f.loserId);
    for (const s of semis) {
      if (s.loserId) rows.push({ participantId: s.loserId, place: 3, medal: "BRONZE" });
    }
  }

  for (const r of rows) {
    await prisma.result.upsert({
      where: { categoryId_participantId: { categoryId, participantId: r.participantId } },
      update: { place: r.place, medal: r.medal, bracketId: bracket.id },
      create: {
        tournamentId,
        categoryId,
        bracketId: bracket.id,
        participantId: r.participantId,
        place: r.place,
        medal: r.medal,
        official: false,
      },
    });
  }

  if (final.status === "FINISHED") {
    await prisma.category.update({ where: { id: categoryId }, data: { status: "FINISHED" } });
    await prisma.bracket.update({ where: { id: bracket.id }, data: { status: "FINISHED" } });
  }

  emitTournament(tournamentId, Events.RESULT_UPDATED, { categoryId });
}

export async function setFightResult(params: {
  fightId: string;
  winnerId: string;
  winMethod?: WinMethod;
  scoreA?: number;
  scoreB?: number;
  confirmChange?: boolean;
}) {
  const fight = await loadFight(params.fightId);

  if (fight.status === "FINISHED" && !params.confirmChange) {
    throw new AppError(
      "NEED_CONFIRM_CHANGE",
      "Нельзя изменить завершённый бой без подтверждения. Изменение результата повлияет на следующие бои.",
    );
  }

  if (fight.status === "BYE" && fight.winnerId) {
    throw new AppError("BYE_LOCKED", "BYE уже обработан автоматически");
  }

  const { winnerId, loserId } = resolveWinnerLoser(fight, params.winnerId);

  if (fight.status === "FINISHED" && fight.winnerId && fight.winnerId !== winnerId) {
    await undoAdvancement(fight);
  }

  const updated = await prisma.fight.update({
    where: { id: fight.id },
    data: {
      winnerId,
      loserId,
      status: "FINISHED",
      finishedAt: new Date(),
      winMethod: params.winMethod ?? "DECISION",
      scoreA: params.scoreA ?? undefined,
      scoreB: params.scoreB ?? undefined,
    },
    include: fightInclude,
  });

  await placeWinnerInNext(updated);
  await placeLoserInThirdPlace(updated);
  await refreshResults(updated.categoryId, updated.tournamentId);

  emitTournament(updated.tournamentId, Events.WINNER_SELECTED, updated);
  emitTournament(updated.tournamentId, Events.FIGHT_FINISHED, updated);
  emitTournament(updated.tournamentId, Events.BRACKET_UPDATED, { bracketId: updated.bracketId, categoryId: updated.categoryId });

  return updated;
}

async function undoAdvancement(fight: {
  id: string;
  winnerId: string | null;
  nextFightId: string | null;
  nextSlot: "A" | "B" | null;
  loserId: string | null;
  roundName: string;
  isThirdPlace: boolean;
  bracketId: string | null;
}) {
  if (fight.nextFightId && fight.nextSlot && fight.winnerId) {
    const next = await prisma.fight.findUnique({ where: { id: fight.nextFightId } });
    if (next && (next.status === "LIVE" || (next.status === "FINISHED" && next.winnerId))) {
      throw new AppError(
        "DOWNSTREAM_LOCKED",
        "Изменение результата повлияет на следующие бои. Сначала сбросьте последующие бои.",
      );
    }
    if (next) {
      const field = fight.nextSlot === "A" ? "participantAId" : "participantBId";
      if (next[field] === fight.winnerId) {
        await prisma.fight.update({
          where: { id: next.id },
          data: { [field]: null, winnerId: null, loserId: null, status: "WAITING" },
        });
      }
    }
  }

  if (fight.roundName === "SEMIFINAL" && fight.loserId && fight.bracketId) {
    const third = await prisma.fight.findFirst({
      where: { bracketId: fight.bracketId, isThirdPlace: true },
    });
    if (third && third.status !== "FINISHED") {
      const data: { participantAId?: null; participantBId?: null } = {};
      if (third.participantAId === fight.loserId) data.participantAId = null;
      if (third.participantBId === fight.loserId) data.participantBId = null;
      if (Object.keys(data).length) {
        await prisma.fight.update({ where: { id: third.id }, data });
      }
    }
  }
}

export async function dqOrNoShow(params: {
  fightId: string;
  type: "DISQUALIFICATION" | "NO_SHOW";
  side: "A" | "B";
}) {
  const fight = await loadFight(params.fightId);
  const winnerId = params.side === "A" ? fight.participantBId : fight.participantAId;
  if (!winnerId) throw new AppError("INCOMPLETE", "Нельзя определить победителя");
  return setFightResult({
    fightId: params.fightId,
    winnerId,
    winMethod: params.type === "DISQUALIFICATION" ? "DISQUALIFICATION" : "NO_SHOW",
  });
}

export async function confirmOfficialResults(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { results: true, tournament: true },
  });
  if (!category) throw new AppError("NOT_FOUND", "Категория не найдена", 404);
  if (category.status !== "FINISHED") {
    throw new AppError("NOT_READY", "Категория ещё не завершена");
  }
  await prisma.result.updateMany({ where: { categoryId }, data: { official: true } });
  emitTournament(category.tournamentId, Events.RESULT_UPDATED, { categoryId, official: true });
  return prisma.result.findMany({
    where: { categoryId },
    include: { participant: { include: { country: true, club: true } }, category: true },
    orderBy: { place: "asc" },
  });
}
