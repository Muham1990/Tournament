import type { DrawMode, Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import {
  generateDraw,
  validateDraw,
  type DrawParticipant,
} from "./drawEngine.js";
import { emitTournament, Events } from "../websocket/index.js";

const fightInclude = {
  participantA: { include: { country: true, club: true } },
  participantB: { include: { country: true, club: true } },
  winner: { include: { country: true, club: true } },
  loser: { include: { country: true, club: true } },
  tatami: true,
} satisfies Prisma.FightInclude;

export async function generateDrawForCategory(params: {
  tournamentId: string;
  categoryId: string;
  mode: DrawMode;
  force?: boolean;
}) {
  const category = await prisma.category.findFirst({
    where: { id: params.categoryId, tournamentId: params.tournamentId },
    include: { participants: true, brackets: true, tournament: { include: { settings: true } } },
  });
  if (!category) throw new AppError("NOT_FOUND", "Категория не найдена", 404);

  const existing = category.brackets[0];
  if (existing) {
    const finishedCount = await prisma.fight.count({
      where: { bracketId: existing.id, status: { in: ["FINISHED", "LIVE"] } },
    });
    if (finishedCount > 0 && !params.force) {
      throw new AppError(
        "DRAW_HAS_RESULTS",
        "В сетке уже есть результаты. Изменение сетки может повлиять на проведённые бои.",
      );
    }
    await prisma.fight.deleteMany({ where: { bracketId: existing.id } });
    await prisma.bracketNode.deleteMany({ where: { bracketId: existing.id } });
    await prisma.result.deleteMany({ where: { bracketId: existing.id } });
    await prisma.bracket.delete({ where: { id: existing.id } });
  }

  const participants: DrawParticipant[] = category.participants.map((p) => ({
    id: p.id,
    clubId: p.clubId,
    countryId: p.countryId,
    seed: p.seed,
  }));

  if (participants.length < 2) {
    throw new AppError("NEED_MORE_PARTICIPANTS", "Недостаточно участников");
  }

  const bronzeMode = category.bronzeMode;
  const thirdPlace = category.thirdPlace && bronzeMode === "ONE";
  const generated = generateDraw(participants, {
    mode: params.mode,
    thirdPlace,
    bronzeMode,
  });

  const check = validateDraw(generated.fights, participants.map((p) => p.id));
  if (!check.ok) {
    throw new AppError("INVALID_DRAW", check.errors.join("; "));
  }

  const bracket = await prisma.bracket.create({
    data: {
      tournamentId: params.tournamentId,
      categoryId: params.categoryId,
      size: generated.size,
      mode: params.mode,
      status: "ACTIVE",
      thirdPlace,
      bronzeMode,
    },
  });

  const created = [];
  for (const f of generated.fights) {
    const row = await prisma.fight.create({
      data: {
        tournamentId: params.tournamentId,
        categoryId: params.categoryId,
        bracketId: bracket.id,
        round: f.round,
        roundName: f.roundName,
        fightNumber: f.fightNumber,
        isThirdPlace: f.isThirdPlace,
        participantAId: f.participantAId,
        participantBId: f.participantBId,
        slotABye: f.slotABye,
        slotBBye: f.slotBBye,
        status: f.status === "BYE" ? "BYE" : "WAITING",
        winnerId: f.winnerId,
        winMethod: f.status === "BYE" && f.winnerId ? "BYE" : undefined,
      },
    });
    created.push(row);
    await prisma.bracketNode.create({
      data: {
        bracketId: bracket.id,
        fightId: row.id,
        round: f.round,
        position: f.fightNumber,
        participantId: f.participantAId,
      },
    });
  }

  for (let i = 0; i < generated.fights.length; i++) {
    const gf = generated.fights[i];
    if (gf.nextFightIndex == null) continue;
    await prisma.fight.update({
      where: { id: created[i].id },
      data: {
        nextFightId: created[gf.nextFightIndex].id,
        nextSlot: gf.nextSlot,
      },
    });
  }

  for (const f of generated.fights) {
    if (f.status === "BYE" && f.winnerId && f.nextFightIndex != null) {
      const nextId = created[f.nextFightIndex].id;
      const slot = f.nextSlot;
      await prisma.fight.update({
        where: { id: nextId },
        data: slot === "A" ? { participantAId: f.winnerId } : { participantBId: f.winnerId },
      });
    }
  }

  emitTournament(params.tournamentId, Events.BRACKET_UPDATED, { bracketId: bracket.id, categoryId: params.categoryId });

  return getBracket(bracket.id);
}

export async function getBracket(bracketId: string) {
  return prisma.bracket.findUniqueOrThrow({
    where: { id: bracketId },
    include: {
      category: true,
      fights: { include: fightInclude, orderBy: { fightNumber: "asc" } },
    },
  });
}

export async function listDraws(tournamentId: string) {
  return prisma.bracket.findMany({
    where: { tournamentId },
    include: {
      category: true,
      fights: { include: fightInclude, orderBy: { fightNumber: "asc" } },
    },
    orderBy: { generatedAt: "desc" },
  });
}

export async function recalculateBracket(bracketId: string) {
  const bracket = await prisma.bracket.findUniqueOrThrow({
    where: { id: bracketId },
    include: { fights: true },
  });

  const byId = new Map(bracket.fights.map((f) => [f.id, f]));
  for (const fight of bracket.fights) {
    if (!fight.winnerId || !fight.nextFightId || !fight.nextSlot) continue;
    const next = byId.get(fight.nextFightId);
    if (!next) continue;
    if (next.status === "FINISHED" || next.status === "LIVE") continue;
    const field = fight.nextSlot === "A" ? "participantAId" : "participantBId";
    if (next[field] !== fight.winnerId) {
      await prisma.fight.update({
        where: { id: next.id },
        data: { [field]: fight.winnerId },
      });
    }
  }
}
