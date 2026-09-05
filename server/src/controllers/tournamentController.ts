import type { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { audit } from "../services/audit.js";
import { emitTournament, Events } from "../websocket/index.js";
import { z } from "zod";

const tournamentSchema = z.object({
  title: z.string().min(1, "Введите название"),
  slug: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dateStart: z.string(),
  dateEnd: z.string(),
  timeStart: z.string().optional().nullable(),
  timeEnd: z.string().optional().nullable(),
  countryId: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  organizer: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  rules: z.string().optional().nullable(),
  regulations: z.string().optional().nullable(),
  registrationInfo: z.string().optional().nullable(),
  tatamiCount: z.coerce.number().int().min(1).optional(),
  registrationStart: z.string().optional().nullable(),
  registrationEnd: z.string().optional().nullable(),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || `t-${Date.now()}`;
}

export async function listTournaments(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q || "").trim();
    const countryId = String(req.query.countryId || "");
    const when = String(req.query.when || "upcoming");
    const now = new Date();
    const where = {
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      ...(countryId ? { countryId } : {}),
      ...(when === "past" ? { dateEnd: { lt: now } } : when === "upcoming" ? { dateEnd: { gte: now } } : {}),
    };
    const items = await prisma.tournament.findMany({
      where,
      include: { country: true, _count: { select: { participants: true, categories: true } } },
      orderBy: { dateStart: "asc" },
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function getTournament(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const item = await prisma.tournament.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        country: true,
        images: true,
        settings: true,
        tatamis: { orderBy: { number: "asc" } },
        _count: { select: { participants: true, categories: true, fights: true } },
      },
    });
    if (!item) throw new AppError("NOT_FOUND", "Турнир не найден", 404);
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function createTournament(req: Request, res: Response, next: NextFunction) {
  try {
    const data = tournamentSchema.parse(req.body);
    let slug = data.slug || slugify(data.title);
    const exists = await prisma.tournament.findUnique({ where: { slug } });
    if (exists) slug = `${slug}-${Date.now().toString(36)}`;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const item = await prisma.tournament.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        dateStart: new Date(data.dateStart),
        dateEnd: new Date(data.dateEnd),
        timeStart: data.timeStart,
        timeEnd: data.timeEnd,
        countryId: data.countryId || undefined,
        city: data.city,
        address: data.address,
        organizer: data.organizer,
        email: data.email,
        phone: data.phone,
        venue: data.venue,
        rules: data.rules,
        regulations: data.regulations,
        registrationInfo: data.registrationInfo,
        tatamiCount: data.tatamiCount ?? 1,
        registrationStart: data.registrationStart ? new Date(data.registrationStart) : undefined,
        registrationEnd: data.registrationEnd ? new Date(data.registrationEnd) : undefined,
        imageUrl,
        status: "DRAFT",
        settings: { create: {} },
      },
    });
    const count = data.tatamiCount ?? 1;
    await prisma.tatami.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        tournamentId: item.id,
        name: `Tatami ${i + 1}`,
        number: i + 1,
      })),
    });
    await audit({ userId: req.user?.userId, action: "TOURNAMENT_CREATED", entity: "Tournament", entityId: item.id });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
}

export async function updateTournament(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError("NOT_FOUND", "Турнир не найден", 404);
    const data = tournamentSchema.partial().parse(req.body);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const item = await prisma.tournament.update({
      where: { id: existing.id },
      data: {
        ...data,
        dateStart: data.dateStart ? new Date(data.dateStart) : undefined,
        dateEnd: data.dateEnd ? new Date(data.dateEnd) : undefined,
        registrationStart: data.registrationStart ? new Date(data.registrationStart) : undefined,
        registrationEnd: data.registrationEnd ? new Date(data.registrationEnd) : undefined,
        ...(imageUrl ? { imageUrl } : {}),
      },
    });
    await audit({ userId: req.user?.userId, action: "TOURNAMENT_EDITED", entity: "Tournament", entityId: item.id });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function deleteTournament(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.tournament.delete({ where: { id: req.params.id } });
    await audit({ userId: req.user?.userId, action: "TOURNAMENT_DELETED", entity: "Tournament", entityId: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function setStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = z.enum(["DRAFT", "REGISTRATION", "READY", "LIVE", "FINISHED", "ARCHIVED"]).parse(req.body.status);
    const item = await prisma.tournament.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function closeRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.tournament.update({
      where: { id: req.params.id },
      data: { status: "READY", registrationEnd: new Date() },
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function startTournament(req: Request, res: Response, next: NextFunction) {
  try {
    const t = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: { participants: true, categories: true, brackets: true },
    });
    if (!t) throw new AppError("NOT_FOUND", "Турнир не найден", 404);
    const errors: string[] = [];
    if (t.participants.length === 0) errors.push("Нет участников");
    if (t.categories.length === 0) errors.push("Нет категорий");
    const unassigned = t.participants.filter((p) => !p.categoryId);
    if (unassigned.length) errors.push("Не все участники имеют категорию");
    if (t.brackets.length === 0) errors.push("Сетки ещё не созданы");
    if (errors.length) throw new AppError("CANNOT_START", `Нельзя запустить турнир: ${errors.join("; ")}`);
    const item = await prisma.tournament.update({ where: { id: t.id }, data: { status: "LIVE" } });
    await audit({ userId: req.user?.userId, action: "TOURNAMENT_STARTED", entity: "Tournament", entityId: t.id });
    emitTournament(t.id, Events.TOURNAMENT_STARTED, item);
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function finishTournament(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.tournament.update({
      where: { id: req.params.id },
      data: { status: "FINISHED" },
    });
    await audit({ userId: req.user?.userId, action: "TOURNAMENT_FINISHED", entity: "Tournament", entityId: item.id });
    emitTournament(item.id, Events.TOURNAMENT_FINISHED, item);
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function dashboard(_req: Request, res: Response, next: NextFunction) {
  try {
    const [tournaments, live, finished, participants, categories, fights, finishedFights, upcomingFights] =
      await Promise.all([
        prisma.tournament.count(),
        prisma.tournament.count({ where: { status: "LIVE" } }),
        prisma.tournament.count({ where: { status: "FINISHED" } }),
        prisma.participant.count(),
        prisma.category.count(),
        prisma.fight.count(),
        prisma.fight.count({ where: { status: "FINISHED" } }),
        prisma.fight.count({ where: { status: { in: ["WAITING", "READY"] } } }),
      ]);
    res.json({
      tournaments,
      live,
      finished,
      participants,
      categories,
      fights,
      finishedFights,
      upcomingFights,
    });
  } catch (e) {
    next(e);
  }
}
