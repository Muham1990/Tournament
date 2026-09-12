import type { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { ageOnDate } from "../utils/age.js";
import { z } from "zod";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export async function listClubs(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.club.findMany({
      include: { country: true, _count: { select: { participants: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function createClub(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      name: z.string().min(1),
      countryId: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      coach: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
    }).parse(req.body);
    const logoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const item = await prisma.club.create({ data: { ...data, logoUrl } });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
}

export async function updateClub(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      name: z.string().min(1).optional(),
      countryId: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      coach: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
    }).parse(req.body);
    const logoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const item = await prisma.club.update({
      where: { id: req.params.id },
      data: { ...data, ...(logoUrl ? { logoUrl } : {}) },
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function deleteClub(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.club.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function listCountries(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.country.findMany({ orderBy: { nameRu: "asc" } });
    res.json({ items });
  } catch (e) {
    console.warn("listCountries", e instanceof Error ? e.message : e);
    res.json({ items: [] });
  }
}

export async function createCountry(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      name: z.string().min(1),
      nameRu: z.string().min(1),
      nameTg: z.string().min(1),
      code: z.string().min(2).max(2),
      flag: z.string().min(1),
    }).parse(req.body);
    const item = await prisma.country.create({ data: { ...data, code: data.code.toUpperCase() } });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
}

export async function updateCountry(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      name: z.string().optional(),
      nameRu: z.string().optional(),
      nameTg: z.string().optional(),
      code: z.string().optional(),
      flag: z.string().optional(),
    }).parse(req.body);
    const item = await prisma.country.update({ where: { id: req.params.id }, data });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function listTatami(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.tatami.findMany({
      where: { tournamentId: req.params.id },
      orderBy: { number: "asc" },
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function createTatami(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      name: z.string().min(1),
      number: z.coerce.number().int(),
      responsible: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
    }).parse(req.body);
    const item = await prisma.tatami.create({ data: { ...data, tournamentId: req.params.id } });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
}

export async function updateTatami(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.tatami.update({ where: { id: req.params.id }, data: req.body });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function deleteTatami(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.tatami.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function liveBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const tatamis = await prisma.tatami.findMany({
      where: { tournamentId: req.params.id },
      orderBy: { number: "asc" },
    });
    const fights = await prisma.fight.findMany({
      where: { tournamentId: req.params.id },
      include: {
        participantA: { include: { country: true } },
        participantB: { include: { country: true } },
        category: true,
      },
      orderBy: [{ scheduledAt: "asc" }, { fightNumber: "asc" }],
    });
    const boards = tatamis.map((t) => {
      const tf = fights.filter((f) => f.tatamiId === t.id);
      const current = tf.find((f) => f.status === "LIVE") || null;
      const next = tf.find((f) => f.status === "READY" || (f.status === "WAITING" && f.participantAId && f.participantBId)) || null;
      return { tatami: t, current, next, upcoming: tf.filter((f) => f.status === "WAITING" || f.status === "READY").slice(0, 8) };
    });
    res.json({ boards });
  } catch (e) {
    next(e);
  }
}

export async function listOfficials(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.official.findMany({
      where: { tournamentId: req.params.id },
      include: { country: true },
      orderBy: { lastName: "asc" },
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function createOfficial(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      countryId: z.string().optional().nullable(),
      role: z.enum(["REFEREE", "JUDGE", "ORGANIZER", "OFFICIAL", "DOCTOR", "OTHER"]),
    }).parse(req.body);
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const item = await prisma.official.create({
      data: { ...data, tournamentId: req.params.id, photoUrl },
    });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
}

export async function deleteOfficial(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.official.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function listVideos(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.video.findMany({
      where: { tournamentId: req.params.id },
      include: { tatami: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function createVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      title: z.string().min(1),
      description: z.string().optional().nullable(),
      youtubeUrl: z.string().url(),
      tatamiId: z.string().optional().nullable(),
      recordedAt: z.string().optional().nullable(),
    }).parse(req.body);
    const item = await prisma.video.create({
      data: {
        ...data,
        tournamentId: req.params.id,
        recordedAt: data.recordedAt ? new Date(data.recordedAt) : undefined,
      },
    });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
}

export async function deleteVideo(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.video.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function listSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.scheduleItem.findMany({
      where: { tournamentId: req.params.id },
      include: { tatami: true, category: true, fight: true },
      orderBy: { startsAt: "asc" },
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function createSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      tatamiId: z.string().optional().nullable(),
      categoryId: z.string().optional().nullable(),
      fightId: z.string().optional().nullable(),
      startsAt: z.string(),
      title: z.string().optional().nullable(),
    }).parse(req.body);
    const item = await prisma.scheduleItem.create({
      data: { ...data, tournamentId: req.params.id, startsAt: new Date(data.startsAt) },
    });
    if (data.fightId && data.tatamiId) {
      await prisma.fight.update({
        where: { id: data.fightId },
        data: { tatamiId: data.tatamiId, scheduledAt: new Date(data.startsAt) },
      });
    }
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
}

export async function autoSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const t = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: { tatamis: true, settings: true, fights: { orderBy: { fightNumber: "asc" } } },
    });
    if (!t) throw new AppError("NOT_FOUND", "Турнир не найден", 404);
    await prisma.scheduleItem.deleteMany({ where: { tournamentId: t.id } });
    const duration = (t.settings?.fightDurationMin ?? 3) + (t.settings?.breakBetweenMin ?? 2);
    const start = new Date(t.dateStart);
    if (t.timeStart) {
      const [h, m] = t.timeStart.split(":").map(Number);
      start.setHours(h || 9, m || 0, 0, 0);
    } else {
      start.setHours(9, 0, 0, 0);
    }
    const tatamis = t.tatamis.length ? t.tatamis : [];
    const created = [];
    let i = 0;
    for (const fight of t.fights.filter((f) => f.status !== "BYE")) {
      const tatami = tatamis[i % Math.max(tatamis.length, 1)];
      const startsAt = new Date(start.getTime() + Math.floor(i / Math.max(tatamis.length, 1)) * duration * 60000);
      const item = await prisma.scheduleItem.create({
        data: {
          tournamentId: t.id,
          tatamiId: tatami?.id,
          categoryId: fight.categoryId,
          fightId: fight.id,
          startsAt,
          title: `Fight #${fight.fightNumber}`,
          sortOrder: i,
        },
      });
      await prisma.fight.update({
        where: { id: fight.id },
        data: { tatamiId: tatami?.id, scheduledAt: startsAt },
      });
      created.push(item);
      i++;
    }
    res.json({ items: created });
  } catch (e) {
    next(e);
  }
}

export async function createMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      firstName: z.string().min(1, "Введите имя"),
      lastName: z.string().min(1, "Введите фамилию"),
      email: z.string().email(),
      phone: z.string().optional().nullable(),
      body: z.string().min(1, "Введите сообщение"),
    }).parse(req.body);
    const item = await prisma.message.create({ data });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
}

export async function listMessages(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.message.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function markMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.message.update({ where: { id: req.params.id }, data: { read: true } });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.siteSettings.upsert({
      where: { id: "site" },
      update: {},
      create: { id: "site" },
    });
    res.json({ item });
  } catch (e) {
    console.warn("getSettings", e instanceof Error ? e.message : e);
    res.json({
      item: {
        id: "site",
        siteName: "Kumite Arena",
        tagline: "TOURNAMENT SYSTEM",
        logoUrl: null,
        email: "",
        phone: "",
        location: "",
        heroTitle: null,
        heroSub: null,
      },
    });
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const logoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const item = await prisma.siteSettings.upsert({
      where: { id: "site" },
      update: { ...req.body, ...(logoUrl ? { logoUrl } : {}) },
      create: { id: "site", ...req.body, ...(logoUrl ? { logoUrl } : {}) },
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function listPricing(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.pricingPlan.findMany({ orderBy: { sortOrder: "asc" } });
    res.json({ items: items.map((p) => ({ ...p, features: JSON.parse(p.features) as string[] })) });
  } catch (e) {
    console.warn("listPricing", e instanceof Error ? e.message : e);
    res.json({ items: [] });
  }
}

export async function updatePricing(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({
      name: z.string().optional(),
      price: z.string().optional(),
      description: z.string().optional().nullable(),
      features: z.array(z.string()).optional(),
      highlighted: z.boolean().optional(),
    }).parse(req.body);
    const item = await prisma.pricingPlan.update({
      where: { id: req.params.id },
      data: {
        ...data,
        features: data.features ? JSON.stringify(data.features) : undefined,
      },
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
}

export async function listAudit(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 50;
    const [total, items] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ items, total, page, pageSize });
  } catch (e) {
    next(e);
  }
}

export async function statistics(req: Request, res: Response, next: NextFunction) {
  try {
    const tournamentId = req.params.id;
    const t = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: { include: { country: true, club: true } },
        categories: true,
        fights: true,
        results: true,
      },
    });
    if (!t) throw new AppError("NOT_FOUND", "Турнир не найден", 404);
    const children = t.participants.filter((p) => ageOnDate(p.birthDate, t.dateStart) < 18).length;
    const byCountry: Record<string, number> = {};
    const byClub: Record<string, number> = {};
    for (const p of t.participants) {
      const ck = p.country?.nameRu || "—";
      byCountry[ck] = (byCountry[ck] || 0) + 1;
      const cl = p.club?.name || "—";
      byClub[cl] = (byClub[cl] || 0) + 1;
    }
    res.json({
      participants: t.participants.length,
      men: t.participants.filter((p) => p.gender === "MEN" || p.gender === "BOYS").length,
      women: t.participants.filter((p) => p.gender === "WOMEN" || p.gender === "GIRLS").length,
      children,
      adults: t.participants.length - children,
      countries: new Set(t.participants.map((p) => p.countryId).filter(Boolean)).size,
      clubs: new Set(t.participants.map((p) => p.clubId).filter(Boolean)).size,
      categories: t.categories.length,
      fights: t.fights.length,
      finishedFights: t.fights.filter((f) => f.status === "FINISHED").length,
      remainingFights: t.fights.filter((f) => f.status !== "FINISHED" && f.status !== "BYE" && f.status !== "CANCELLED").length,
      gold: t.results.filter((r) => r.medal === "GOLD").length,
      silver: t.results.filter((r) => r.medal === "SILVER").length,
      bronze: t.results.filter((r) => r.medal === "BRONZE").length,
      byCountry,
      byClub,
    });
  } catch (e) {
    next(e);
  }
}

export async function exportParticipants(req: Request, res: Response, next: NextFunction) {
  try {
    const format = String(req.query.format || "csv");
    const t = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: { participants: { include: { country: true, club: true, category: true } } },
    });
    if (!t) throw new AppError("NOT_FOUND", "Турнир не найден", 404);
    const rows = t.participants.map((p, i) => ({
      n: i + 1,
      firstName: p.firstName,
      lastName: p.lastName,
      age: ageOnDate(p.birthDate, t.dateStart),
      gender: p.gender,
      country: p.country?.nameRu || "",
      club: p.club?.name || "",
      category: p.category?.name || "",
      weight: p.weight ?? "",
      rank: p.rank || "",
    }));
    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Participants");
      ws.addRow(Object.keys(rows[0] || { n: 1 }));
      rows.forEach((r) => ws.addRow(Object.values(r)));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=participants.xlsx");
      await wb.xlsx.write(res);
      res.end();
      return;
    }
    const header = "n,firstName,lastName,age,gender,country,club,category,weight,rank";
    const csv = [header, ...rows.map((r) => Object.values(r).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=participants.csv");
    res.send(csv);
  } catch (e) {
    next(e);
  }
}

export async function exportResults(req: Request, res: Response, next: NextFunction) {
  try {
    const format = String(req.query.format || "csv");
    const items = await prisma.result.findMany({
      where: { tournamentId: req.params.id },
      include: { participant: true, category: true },
      orderBy: [{ categoryId: "asc" }, { place: "asc" }],
    });
    const rows = items.map((r) => ({
      category: r.category.name,
      place: r.place,
      medal: r.medal || "",
      name: `${r.participant.firstName} ${r.participant.lastName}`,
    }));
    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Results");
      ws.addRow(["category", "place", "medal", "name"]);
      rows.forEach((r) => ws.addRow(Object.values(r)));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=results.xlsx");
      await wb.xlsx.write(res);
      res.end();
      return;
    }
    const csv = ["category,place,medal,name", ...rows.map((r) => Object.values(r).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=results.csv");
    res.send(csv);
  } catch (e) {
    next(e);
  }
}

export async function exportPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const kind = String(req.query.kind || "results");
    const t = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        participants: { include: { country: true, club: true, category: true } },
        results: { include: { participant: true, category: true } },
        fights: { include: { participantA: true, participantB: true, category: true }, orderBy: { fightNumber: "asc" } },
        schedule: { include: { tatami: true, fight: true }, orderBy: { startsAt: "asc" } },
      },
    });
    if (!t) throw new AppError("NOT_FOUND", "Турнир не найден", 404);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${kind}.pdf`);
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(16).text(t.title);
    doc.moveDown();
    if (kind === "participants") {
      t.participants.forEach((p, i) => {
        doc.fontSize(11).text(`${i + 1}. ${p.lastName} ${p.firstName} — ${p.category?.name || ""}`);
      });
    } else if (kind === "schedule") {
      t.schedule.forEach((s) => {
        doc.fontSize(11).text(`${s.startsAt.toISOString().slice(11, 16)}  ${s.tatami?.name || ""}  ${s.title || ""}`);
      });
    } else if (kind === "draw") {
      t.fights.forEach((f) => {
        const a = f.participantA ? `${f.participantA.lastName}` : f.slotABye ? "BYE" : "TBD";
        const b = f.participantB ? `${f.participantB.lastName}` : f.slotBBye ? "BYE" : "TBD";
        doc.fontSize(10).text(`#${f.fightNumber} ${f.roundName}: ${a} vs ${b}`);
      });
    } else {
      t.results.forEach((r) => {
        doc.fontSize(11).text(`${r.category.name} — ${r.place}. ${r.participant.lastName} ${r.participant.firstName} (${r.medal || ""})`);
      });
    }
    doc.end();
  } catch (e) {
    next(e);
  }
}
