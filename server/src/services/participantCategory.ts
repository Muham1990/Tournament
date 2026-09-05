export type AgeBand = {
  label: string;
  minAge: number;
  maxAge: number | null;
};

const BANDS: AgeBand[] = [
  { minAge: 4, maxAge: 5, label: "4-5 лет" },
  { minAge: 6, maxAge: 7, label: "6-7 лет" },
  { minAge: 8, maxAge: 9, label: "8-9 лет" },
  { minAge: 10, maxAge: 11, label: "10-11 лет" },
  { minAge: 12, maxAge: 13, label: "12-13 лет" },
  { minAge: 14, maxAge: 15, label: "14-15 лет" },
  { minAge: 16, maxAge: 17, label: "16-17 лет" },
  { minAge: 18, maxAge: null, label: "18+" },
];

export function getParticipantCategory(
  age: number,
  weight?: number | null,
  gender?: "BOYS" | "GIRLS" | "MEN" | "WOMEN",
): AgeBand & { name: string } {
  const n = Math.round(Number(age));
  const band = (!Number.isFinite(n) || n < 4)
    ? BANDS[0]
    : (BANDS.find((b) => n >= b.minAge && (b.maxAge == null || n <= b.maxAge)) || BANDS[BANDS.length - 1]);
  const word = gender === "GIRLS" ? "Девочки" : gender === "WOMEN" ? "Женщины" : gender === "MEN" ? "Мужчины" : gender === "BOYS" ? "Мальчики" : "";
  const kg = weight != null && Number.isFinite(weight) ? ` ${Math.round(Number(weight))} кг` : "";
  return { ...band, name: `${word ? `${word} ` : ""}${band.label}${kg}`.trim() };
}

export async function ensureAgeCategory(
  tournamentId: string,
  age: number,
  weight?: number | null,
  gender: "BOYS" | "GIRLS" | "MEN" | "WOMEN" = "BOYS",
) {
  const { prisma } = await import("../utils/prisma.js");
  const meta = getParticipantCategory(age, weight, gender);
  const existing = await prisma.category.findFirst({
    where: { tournamentId, name: meta.name },
  });
  if (existing) return { category: existing, meta };
  const category = await prisma.category.create({
    data: {
      tournamentId,
      name: meta.name,
      discipline: "KUMITE",
      gender,
      minAge: meta.minAge,
      maxAge: meta.maxAge,
      maxWeight: weight != null ? Number(weight) : undefined,
    },
  });
  return { category, meta };
}
