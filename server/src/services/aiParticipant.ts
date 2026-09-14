import { prisma, withDbRetry } from "../utils/prisma.js";
import { ageOnDate } from "../utils/age.js";
import { AppError } from "../utils/errors.js";
import { ensureAgeCategory, getParticipantCategory } from "./participantCategory.js";
import { genderFromAgeAndSex, parseSexHint, type Sex } from "./gender.js";

export type ParsedAthlete = {
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  weight: number | null;
  country: string | null;
  gender?: string | null;
};

export function ageToBirthDate(age: number) {
  const y = new Date().getFullYear() - Math.round(Number(age));
  return new Date(`${y}-01-01T00:00:00.000Z`);
}

export function missingFields(p: ParsedAthlete) {
  const missing: string[] = [];
  if (!p.firstName?.trim()) missing.push("firstName");
  if (!p.lastName?.trim()) missing.push("lastName");
  if (p.age == null || !Number.isFinite(p.age)) missing.push("age");
  if (p.weight == null || !Number.isFinite(p.weight)) missing.push("weight");
  if (!p.country?.trim()) missing.push("country");
  return missing;
}

export async function resolveCountry(name: string | null) {
  const q = name?.trim();
  if (!q) return null;
  const { ensureCountries, resolveCountryId } = await import("./countries.js");
  await ensureCountries().catch(() => undefined);
  const id = await resolveCountryId(q);
  if (id) return prisma.country.findUnique({ where: { id } });
  const items = await prisma.country.findMany();
  const low = q.toLowerCase();
  const exact = items.find((c) =>
    [c.name, c.nameRu, c.nameTg, c.code].some((v) => v.toLowerCase() === low),
  );
  if (exact) return exact;
  return items.find((c) =>
    [c.name, c.nameRu, c.nameTg].some((v) => v.toLowerCase().includes(low) || low.includes(v.toLowerCase())),
  ) || null;
}

export async function findDuplicate(opts: {
  tournamentId: string;
  firstName: string;
  lastName: string;
  age: number;
  countryId: string;
}) {
  const birthDate = ageToBirthDate(opts.age);
  return prisma.participant.findFirst({
    where: {
      tournamentId: opts.tournamentId,
      firstName: { equals: opts.firstName, mode: "insensitive" },
      lastName: { equals: opts.lastName, mode: "insensitive" },
      birthDate,
      countryId: opts.countryId,
    },
    include: { country: true, category: true },
  });
}

export async function createFromAi(opts: {
  tournamentId: string;
  firstName: string;
  lastName: string;
  age: number;
  weight: number;
  countryId: string;
  sex?: Sex;
  forceDuplicate?: boolean;
  photoUrl?: string;
}) {
  return withDbRetry(async () => {
  const tournament = await prisma.tournament.findUnique({ where: { id: opts.tournamentId } });
  if (!tournament) throw new AppError("NOT_FOUND", "Турнир не найден", 404);
  const birthDate = ageToBirthDate(opts.age);
  const dup = await findDuplicate(opts);
  const sex = opts.sex || parseSexHint(null, opts.firstName);
  const gender = genderFromAgeAndSex(opts.age, sex);
  const preview = getParticipantCategory(opts.age, opts.weight, gender);
  if (dup && !opts.forceDuplicate) {
    return { created: false as const, duplicate: dup, category: preview.name };
  }
  const { category, meta } = await ensureAgeCategory(opts.tournamentId, opts.age, opts.weight, gender);
  const item = await prisma.participant.create({
    data: {
      tournamentId: opts.tournamentId,
      firstName: opts.firstName.trim(),
      lastName: opts.lastName.trim(),
      birthDate,
      gender,
      countryId: opts.countryId,
      weight: opts.weight,
      categoryId: category.id,
      photoUrl: opts.photoUrl,
    },
    include: { country: true, category: true },
  });
  return {
    created: true as const,
    item: { ...item, age: ageOnDate(item.birthDate, tournament.dateStart) },
    category: meta.name,
  };
  });
}

export async function prepareAthlete(p: ParsedAthlete, tournamentId: string) {
  const missing = missingFields(p);
  const warnings: string[] = [];
  if (missing.includes("firstName")) warnings.push("Не удалось распознать имя.");
  if (missing.includes("lastName")) warnings.push("Не удалось уверенно распознать фамилию.");
  if (missing.includes("age")) warnings.push("Не удалось распознать возраст.");
  if (missing.includes("weight")) warnings.push("Не удалось распознать вес.");
  if (missing.includes("country")) warnings.push("Не удалось распознать страну.");

  let countryId: string | null = null;
  let countryName = p.country?.trim() || null;
  if (!countryName) {
    const c = await resolveCountry("TJ");
    if (c) {
      countryId = c.id;
      countryName = c.nameRu || c.name;
      const i = missing.indexOf("country");
      if (i >= 0) missing.splice(i, 1);
      const w = warnings.findIndex((x) => x.includes("страну"));
      if (w >= 0) warnings.splice(w, 1);
    }
  } else {
    const c = await resolveCountry(countryName);
    if (!c) {
      missing.push("country");
      warnings.push("В базе нет такой страны.");
      countryName = p.country;
    } else {
      countryId = c.id;
      countryName = c.nameRu || c.name;
    }
  }

  const sex = parseSexHint(p.gender, p.firstName);
  const gender = p.age != null && Number.isFinite(p.age) ? genderFromAgeAndSex(p.age, sex) : null;
  const category = p.age != null && Number.isFinite(p.age)
    ? getParticipantCategory(p.age, p.weight, gender || undefined).name
    : null;

  return {
    firstName: p.firstName?.trim() || null,
    lastName: p.lastName?.trim() || null,
    age: p.age,
    weight: p.weight,
    country: countryName,
    countryId,
    category,
    sex,
    gender,
    missing: [...new Set(missing)],
    warnings,
    ready: missing.length === 0 && Boolean(countryId),
    tournamentId,
  };
}
