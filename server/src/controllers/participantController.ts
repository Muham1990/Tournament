import type { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { ageOnDate, rankIndex } from "../utils/age.js";
import { audit } from "../services/audit.js";
import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : v);

const participantSchema = z.object({
  firstName: z.string().min(1, "Введите имя"),
  lastName: z.string().min(1, "Введите фамилию"),
  birthDate: z.string().min(1, "Укажите дату рождения"),
  gender: z.enum(["BOYS", "GIRLS", "MEN", "WOMEN", "MIXED"]),
  countryId: z.string().min(1, "Выберите страну"),
  city: z.preprocess(emptyToUndef, z.string().optional().nullable()),
  clubId: z.preprocess(emptyToUndef, z.string().optional().nullable()),
  school: z.preprocess(emptyToUndef, z.string().optional().nullable()),
  weight: z.preprocess(emptyToUndef, z.coerce.number().optional().nullable()),
  entryFee: z.preprocess(emptyToUndef, z.coerce.number().optional().nullable()),
  rank: z.preprocess(emptyToUndef, z.string().optional().nullable()),
  belt: z.preprocess(emptyToUndef, z.string().optional().nullable()),
  coach: z.preprocess(emptyToUndef, z.string().optional().nullable()),
  categoryId: z.preprocess(emptyToUndef, z.string().optional().nullable()),
  seed: z.preprocess(emptyToUndef, z.coerce.number().optional().nullable()),
  forceDuplicate: z.coerce.boolean().optional(),
  overrideOk: z.coerce.boolean().optional(),
});

function checkCategoryFit(
  p: { birthDate: Date; gender: string; weight: number | null; rank: string | null },
  cat: { minAge: number | null; maxAge: number | null; gender: string; minWeight: number | null; maxWeight: number | null; rankMin: string | null; rankMax: string | null },
  tournamentDate: Date,
) {
  const warnings: string[] = [];
  const age = ageOnDate(p.birthDate, tournamentDate);
  if (cat.minAge != null && age < cat.minAge) warnings.push("Участник не соответствует возрастной категории.");
  if (cat.maxAge != null && age > cat.maxAge) warnings.push("Участник не соответствует возрастной категории.");
  if (cat.gender !== "MIXED" && p.gender !== cat.gender && !(cat.gender === "MEN" && p.gender === "BOYS") && !(cat.gender === "WOMEN" && p.gender === "GIRLS")) {
    warnings.push("Участник не соответствует полу категории.");
  }
  if (p.weight != null) {
    if (cat.minWeight != null && p.weight < cat.minWeight) warnings.push("Участник не соответствует весовой категории.");
    if (cat.maxWeight != null && p.weight > cat.maxWeight) warnings.push("Участник не соответствует весовой категории.");
  }
  const ri = rankIndex(p.rank);
  const rmin = rankIndex(cat.rankMin);
  const rmax = rankIndex(cat.rankMax);
  if (ri != null && rmin != null && ri < rmin) warnings.push("Класс участника ниже допустимого.");
  if (ri != null && rmax != null && ri > rmax) warnings.push("Класс участника выше допустимого.");
  return { age, warnings };
}

export async function listParticipants(req: Request, res: Response, next: NextFunction) {
  try {
    const tournamentId = req.params.id;
    const q = String(req.query.q || "").trim();
    const categoryId = String(req.query.categoryId || "");
    const clubId = String(req.query.clubId || "");
    const countryId = String(req.query.countryId || "");
    const gender = String(req.query.gender || "");
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = [25, 50, 100].includes(Number(req.query.pageSize)) ? Number(req.query.pageSize) : 50;

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new AppError("NOT_FOUND", "Турнир не найден", 404);

    const where = {
      tournamentId,
      ...(categoryId ? { categoryId } : {}),
      ...(clubId ? { clubId } : {}),
      ...(countryId ? { countryId } : {}),
      ...(gender ? { gender: gender as never } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { id: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, items, clubs] = await Promise.all([
      prisma.participant.count({ where }),
      prisma.participant.findMany({
        where,
        include: { country: true, club: true, category: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.club.findMany({
        where: { participants: { some: { tournamentId } } },
        include: { _count: { select: { participants: { where: { tournamentId } } } } },
        orderBy: { name: "asc" },
      }),
    ]);

    const mapped = items.map((p) => ({
      ...p,
      age: ageOnDate(p.birthDate, tournament.dateStart),
    }));

    res.json({ items: mapped, total, page, pageSize, clubs });
  } catch (e) {
    next(e);
  }
}

export async function createParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const tournamentId = req.params.id;
    const data = participantSchema.parse(req.body);
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new AppError("NOT_FOUND", "Турнир не найден", 404);

    const birthDate = new Date(data.birthDate);
    const duplicate = await prisma.participant.findFirst({
      where: {
        tournamentId,
        firstName: { equals: data.firstName, mode: "insensitive" },
        lastName: { equals: data.lastName, mode: "insensitive" },
        birthDate,
        countryId: data.countryId,
      },
    });
    if (duplicate && !data.forceDuplicate) {
      throw new AppError("DUPLICATE", "Возможный дубликат участника.");
    }

    let warnings: string[] = [];
    if (data.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (cat) {
        const fit = checkCategoryFit(
          { birthDate, gender: data.gender, weight: data.weight ?? null, rank: data.rank ?? null },
          cat,
          tournament.dateStart,
        );
        warnings = fit.warnings;
        if (warnings.length && !data.overrideOk) {
          res.status(409).json({ code: "CATEGORY_MISMATCH", error: warnings[0], warnings });
          return;
        }
      }
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const item = await prisma.participant.create({
      data: {
        tournamentId,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate,
        gender: data.gender,
        countryId: data.countryId || undefined,
        city: data.city,
        clubId: data.clubId || undefined,
        school: data.school,
        weight: data.weight,
        entryFee: data.entryFee,
        rank: data.rank,
        belt: data.belt ?? data.rank,
        coach: data.coach,
        categoryId: data.categoryId || undefined,
        seed: data.seed,
        overrideOk: Boolean(data.overrideOk),
        photoUrl,
      },
      include: { country: true, club: true, category: true },
    });
    await audit({ userId: req.user?.userId, action: "PARTICIPANT_ADDED", entity: "Participant", entityId: item.id });
    res.status(201).json({
      item: { ...item, age: ageOnDate(item.birthDate, tournament.dateStart) },
      warnings,
    });
  } catch (e) {
    next(e);
  }
}

export async function updateParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { tournament: true },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Участник не найден", 404);
    const data = participantSchema.partial().parse(req.body);
    const { forceDuplicate: _fd, overrideOk: _ok, ...fields } = data;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const item = await prisma.participant.update({
      where: { id: existing.id },
      data: {
        ...fields,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        clubId: data.clubId || undefined,
        categoryId: data.categoryId || undefined,
        countryId: data.countryId || undefined,
        ...(photoUrl ? { photoUrl } : {}),
      },
      include: { country: true, club: true, category: true },
    });
    await audit({ userId: req.user?.userId, action: "PARTICIPANT_EDITED", entity: "Participant", entityId: item.id });
    res.json({ item: { ...item, age: ageOnDate(item.birthDate, existing.tournament.dateStart) } });
  } catch (e) {
    next(e);
  }
}

export async function deleteParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.participant.delete({ where: { id: req.params.id } });
    await audit({ userId: req.user?.userId, action: "PARTICIPANT_DELETED", entity: "Participant", entityId: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function getParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { country: true, club: true, category: true, tournament: true },
    });
    if (!item) throw new AppError("NOT_FOUND", "Участник не найден", 404);
    res.json({ item: { ...item, age: ageOnDate(item.birthDate, item.tournament.dateStart) } });
  } catch (e) {
    next(e);
  }
}
