import { prisma } from "../utils/prisma.js";
import { ageOnDate } from "../utils/age.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getParticipantStats(tournamentId?: string) {
  const where = tournamentId ? { tournamentId } : {};
  const [total, today, missingWeight, missingCountry, missingCategory] = await Promise.all([
    prisma.participant.count({ where }),
    prisma.participant.count({ where: { ...where, createdAt: { gte: startOfToday() } } }),
    prisma.participant.count({ where: { ...where, OR: [{ weight: null }] } }),
    prisma.participant.count({ where: { ...where, countryId: null } }),
    prisma.participant.count({ where: { ...where, categoryId: null } }),
  ]);
  return { total, addedToday: today, missingWeight, missingCountry, missingCategory, tournamentId: tournamentId || null };
}

export async function searchParticipants(args: {
  tournamentId?: string;
  query?: string;
  maxWeight?: number;
  minWeight?: number;
  age?: number;
  country?: string;
  category?: string;
  missingWeight?: boolean;
}) {
  const where: Record<string, unknown> = {};
  if (args.tournamentId) where.tournamentId = args.tournamentId;
  if (args.maxWeight != null) where.weight = { ...(where.weight as object || {}), lte: args.maxWeight };
  if (args.minWeight != null) where.weight = { ...(where.weight as object || {}), gte: args.minWeight };
  if (args.missingWeight) where.weight = null;
  if (args.query?.trim()) {
    const q = args.query.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ];
  }
  if (args.category?.trim()) {
    const cat = args.category.trim();
    where.category = {
      OR: [
        { name: { contains: cat, mode: "insensitive" } },
      ],
    };
  }
  if (args.country?.trim()) {
    const c = args.country.trim();
    where.country = {
      OR: [
        { name: { contains: c, mode: "insensitive" } },
        { nameRu: { contains: c, mode: "insensitive" } },
        { nameTg: { contains: c, mode: "insensitive" } },
        { code: { equals: c, mode: "insensitive" } },
      ],
    };
  }

  const items = await prisma.participant.findMany({
    where,
    take: 25,
    orderBy: { createdAt: "desc" },
    include: { country: true, category: true, tournament: { select: { dateStart: true, title: true } } },
  });

  const rows = items
    .map((p) => {
      const age = ageOnDate(p.birthDate, p.tournament.dateStart);
      return {
        firstName: p.firstName,
        lastName: p.lastName,
        age,
        weight: p.weight,
        entryFee: p.entryFee,
        country: p.country?.nameRu || p.country?.name || null,
        category: p.category?.name || null,
        tournament: p.tournament.title,
      };
    })
    .filter((p) => (args.age == null ? true : p.age === args.age));

  return { count: rows.length, items: rows };
}

export async function getMissingData(tournamentId?: string) {
  const where = tournamentId ? { tournamentId } : {};
  const [noWeight, noCountry, noCategory] = await Promise.all([
    prisma.participant.findMany({
      where: { ...where, weight: null },
      take: 20,
      select: { firstName: true, lastName: true },
    }),
    prisma.participant.findMany({
      where: { ...where, countryId: null },
      take: 20,
      select: { firstName: true, lastName: true },
    }),
    prisma.participant.findMany({
      where: { ...where, categoryId: null },
      take: 20,
      select: { firstName: true, lastName: true },
    }),
  ]);
  return {
    noWeight: noWeight.map((p) => `${p.firstName} ${p.lastName}`),
    noCountry: noCountry.map((p) => `${p.firstName} ${p.lastName}`),
    noCategory: noCategory.map((p) => `${p.firstName} ${p.lastName}`),
  };
}

export async function getRegistrationStats(tournamentId?: string) {
  const where = tournamentId ? { tournamentId } : {};
  const [withFee, agg] = await Promise.all([
    prisma.participant.count({ where: { ...where, entryFee: { not: null } } }),
    prisma.participant.aggregate({ where: { ...where, entryFee: { not: null } }, _sum: { entryFee: true } }),
  ]);
  return {
    participantsWithFee: withFee,
    totalCollected: agg._sum.entryFee ?? 0,
    currency: "TJS",
    note: withFee === 0 ? "В базе нет сохранённых цен регистрации участников." : null,
  };
}

export async function getTournamentStats() {
  const items = await prisma.tournament.findMany({
    orderBy: { dateStart: "desc" },
    take: 20,
    select: {
      title: true,
      status: true,
      dateStart: true,
      _count: { select: { participants: true } },
    },
  });
  return {
    count: items.length,
    items: items.map((t) => ({
      title: t.title,
      status: t.status,
      dateStart: t.dateStart.toISOString().slice(0, 10),
      participants: t._count.participants,
    })),
  };
}

export async function getResults(args: {
  tournamentId?: string;
  category?: string;
  place?: number;
}) {
  const where: Record<string, unknown> = {};
  if (args.tournamentId) where.tournamentId = args.tournamentId;
  if (args.place != null) where.place = args.place;
  if (args.category?.trim()) {
    where.category = { name: { contains: args.category.trim(), mode: "insensitive" } };
  }
  const rows = await prisma.result.findMany({
    where,
    take: 40,
    orderBy: [{ place: "asc" }],
    include: { participant: { include: { country: true } }, category: true },
  });
  if (rows.length) {
    return {
      count: rows.length,
      items: rows.map((r) => ({
        place: r.place,
        medal: r.medal,
        firstName: r.participant.firstName,
        lastName: r.participant.lastName,
        category: r.category.name,
        country: r.participant.country?.nameRu || r.participant.country?.name || null,
      })),
    };
  }

  const fightWhere: Record<string, unknown> = {
    nextFightId: null,
    isThirdPlace: false,
    winnerId: { not: null },
  };
  if (args.tournamentId) fightWhere.tournamentId = args.tournamentId;
  if (args.category?.trim()) {
    fightWhere.category = { name: { contains: args.category.trim(), mode: "insensitive" } };
  }
  const finals = await prisma.fight.findMany({
    where: fightWhere,
    take: 20,
    include: { winner: { include: { country: true } }, category: true },
  });
  if (!finals.length) {
    return {
      count: 0,
      items: [],
      note: args.category
        ? `В базе нет результатов для категории «${args.category}».`
        : "В базе нет результатов первых мест.",
    };
  }
  return {
    count: finals.length,
    items: finals.map((f) => ({
      place: 1,
      medal: "GOLD",
      firstName: f.winner?.firstName,
      lastName: f.winner?.lastName,
      category: f.category?.name,
      country: f.winner?.country?.nameRu || f.winner?.country?.name || null,
    })),
  };
}

export const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "getParticipantStats",
        description: "Счётчики участников: всего, добавлено сегодня, без веса/страны/категории. Не возвращает полный список.",
        parameters: {
          type: "OBJECT",
          properties: { tournamentId: { type: "STRING", description: "Опциональный id турнира" } },
        },
      },
      {
        name: "searchParticipants",
        description: "Поиск участников по имени, весу, возрасту, стране. Максимум 25 строк.",
        parameters: {
          type: "OBJECT",
          properties: {
            tournamentId: { type: "STRING" },
            query: { type: "STRING", description: "Имя или фамилия" },
            maxWeight: { type: "NUMBER" },
            minWeight: { type: "NUMBER" },
            age: { type: "NUMBER" },
            country: { type: "STRING" },
            category: { type: "STRING", description: "Название категории, например 14-15 лет или до 55" },
            missingWeight: { type: "BOOLEAN" },
          },
        },
      },
      {
        name: "getMissingData",
        description: "Участники с незаполненным весом, страной или категорией.",
        parameters: {
          type: "OBJECT",
          properties: { tournamentId: { type: "STRING" } },
        },
      },
      {
        name: "getRegistrationStats",
        description: "Сумма цен регистрации (entryFee) участников.",
        parameters: {
          type: "OBJECT",
          properties: { tournamentId: { type: "STRING" } },
        },
      },
      {
        name: "getTournamentStats",
        description: "Список турниров и число участников в каждом. НЕ для вопросов про места и победителей.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "getResults",
        description: "Кто занял 1/2/3 место, победители, результаты категории. Для вопросов «кто занял первое место».",
        parameters: {
          type: "OBJECT",
          properties: {
            tournamentId: { type: "STRING" },
            category: { type: "STRING", description: "Фрагмент категории: 14-15, мальчики, 55 кг" },
            place: { type: "NUMBER", description: "1 для первого места" },
          },
        },
      },
    ],
  },
];

export async function runAiTool(name: string, args: Record<string, unknown>, fallbackTournamentId?: string) {
  const tid = (typeof args.tournamentId === "string" && args.tournamentId) || fallbackTournamentId;
  switch (name) {
    case "getParticipantStats":
      return getParticipantStats(tid);
    case "searchParticipants":
      return searchParticipants({
        tournamentId: tid,
        query: typeof args.query === "string" ? args.query : undefined,
        maxWeight: typeof args.maxWeight === "number" ? args.maxWeight : undefined,
        minWeight: typeof args.minWeight === "number" ? args.minWeight : undefined,
        age: typeof args.age === "number" ? args.age : undefined,
        country: typeof args.country === "string" ? args.country : undefined,
        category: typeof args.category === "string" ? args.category : undefined,
        missingWeight: Boolean(args.missingWeight),
      });
    case "getMissingData":
      return getMissingData(tid);
    case "getRegistrationStats":
      return getRegistrationStats(tid);
    case "getTournamentStats":
      return getTournamentStats();
    case "getResults":
      return getResults({
        tournamentId: tid,
        category: typeof args.category === "string" ? args.category : undefined,
        place: typeof args.place === "number" ? args.place : 1,
      });
    default:
      return { error: `Неизвестная функция ${name}` };
  }
}
