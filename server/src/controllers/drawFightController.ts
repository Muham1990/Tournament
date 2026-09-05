import type { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../services/audit.js";
import { generateDrawForCategory, listDraws, getBracket } from "../services/drawService.js";
import { startFight, setFightResult, dqOrNoShow, confirmOfficialResults } from "../services/fightService.js";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1, "Введите название"),
  discipline: z.enum(["KUMITE", "KATA", "TEAM_KATA", "TEAM_KUMITE"]).optional(),
  gender: z.enum(["BOYS", "GIRLS", "MEN", "WOMEN", "MIXED"]).optional(),
  minAge: z.coerce.number().optional().nullable(),
  maxAge: z.coerce.number().optional().nullable(),
  minWeight: z.coerce.number().optional().nullable(),
  maxWeight: z.coerce.number().optional().nullable(),
  rankMin: z.string().optional().nullable(),
  rankMax: z.string().optional().nullable(),
  bronzeMode: z.enum(["ONE", "TWO"]).optional(),
  thirdPlace: z.coerce.boolean().optional(),
});

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.category.findMany({
      where: { tournamentId: req.params.id },
      include: { _count: { select: { participants: true, fights: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = categorySchema.parse(req.body);
    const item = await prisma.category.create({
      data: { ...data, tournamentId: req.params.id },
    });
    await audit({ userId: req.user?.userId, action: "CATEGORY_CREATED", entity: "Category", entityId: item.id });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = categorySchema.partial().parse(req.body);
    const item = await prisma.category.update({ where: { id: req.params.id }, data });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function generateDraw(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      categoryId: z.string(),
      mode: z.enum(["RANDOM", "SEEDED", "CLUB_SEPARATION", "COUNTRY_SEPARATION"]).default("RANDOM"),
      force: z.boolean().optional(),
    }).parse(req.body);
    const bracket = await generateDrawForCategory({
      tournamentId: req.params.id,
      categoryId: body.categoryId,
      mode: body.mode,
      force: body.force,
    });
    await audit({ userId: req.user?.userId, action: "DRAW_GENERATED", entity: "Bracket", entityId: bracket.id });
    res.status(201).json({ item: bracket });
  } catch (e) {
    next(e);
  }
}

export async function getDraws(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await listDraws(req.params.id);
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function getDraw(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await getBracket(req.params.drawId);
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function listFights(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.fight.findMany({
      where: {
        tournamentId: req.params.id,
        ...(req.query.categoryId ? { categoryId: String(req.query.categoryId) } : {}),
        ...(req.query.tatamiId ? { tatamiId: String(req.query.tatamiId) } : {}),
        ...(req.query.status ? { status: String(req.query.status) as never } : {}),
      },
      include: {
        participantA: { include: { country: true, club: true } },
        participantB: { include: { country: true, club: true } },
        winner: true,
        tatami: true,
        category: true,
      },
      orderBy: [{ scheduledAt: "asc" }, { fightNumber: "asc" }],
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function getFight(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.fight.findUnique({
      where: { id: req.params.id },
      include: {
        participantA: { include: { country: true, club: true } },
        participantB: { include: { country: true, club: true } },
        winner: true,
        loser: true,
        tatami: true,
        category: true,
      },
    });
    if (!item) throw new AppError("NOT_FOUND", "Бой не найден", 404);
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function startFightCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await startFight(req.params.id);
    await audit({ userId: req.user?.userId, action: "FIGHT_STARTED", entity: "Fight", entityId: item.id });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function fightResultCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      winnerId: z.string(),
      winMethod: z.enum(["DECISION", "IPPON", "WAZA_ARI", "KO", "DISQUALIFICATION", "WALKOVER", "NO_SHOW", "OTHER", "BYE"]).optional(),
      scoreA: z.number().optional(),
      scoreB: z.number().optional(),
      confirmChange: z.boolean().optional(),
    }).parse(req.body);
    const item = await setFightResult({ fightId: req.params.id, ...body });
    await audit({
      userId: req.user?.userId,
      action: body.confirmChange ? "RESULT_CHANGED" : "WINNER_SELECTED",
      entity: "Fight",
      entityId: item.id,
      details: { winnerId: body.winnerId },
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function fightSpecialCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      type: z.enum(["DISQUALIFICATION", "NO_SHOW"]),
      side: z.enum(["A", "B"]),
    }).parse(req.body);
    const item = await dqOrNoShow({ fightId: req.params.id, ...body });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function updateFight(req: Request, res: Response, next: NextFunction) {
  try {
    const body = z.object({
      tatamiId: z.string().optional().nullable(),
      scheduledAt: z.string().optional().nullable(),
      status: z.enum(["WAITING", "READY", "LIVE", "FINISHED", "BYE", "CANCELLED"]).optional(),
    }).parse(req.body);
    const item = await prisma.fight.update({
      where: { id: req.params.id },
      data: {
        tatamiId: body.tatamiId,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        status: body.status,
      },
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function listResults(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.result.findMany({
      where: { tournamentId: req.params.id },
      include: { participant: { include: { country: true, club: true } }, category: true },
      orderBy: [{ categoryId: "asc" }, { place: "asc" }],
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function confirmResults(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await confirmOfficialResults(req.params.categoryId);
    res.json({ items });
  } catch (e) {
    next(e);
  }
}
