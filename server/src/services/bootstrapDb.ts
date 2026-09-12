import { prisma } from "../utils/prisma.js";
import { ensureAdmin } from "./ensureAdmin.js";
import { ensureCountries } from "./countries.js";

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: "0",
    description: "Для небольших клубных турниров",
    features: JSON.stringify(["1 турнир в месяц", "До 50 участников", "Сетки до 32", "Базовые результаты"]),
    highlighted: false,
    sortOrder: 1,
  },
  {
    id: "pro",
    name: "Professional",
    price: "49",
    description: "Для региональных соревнований",
    features: JSON.stringify(["Неограниченные турниры", "До 500 участников", "Сетки до 128", "Live-обновления", "Экспорт PDF/Excel"]),
    highlighted: true,
    sortOrder: 2,
  },
  {
    id: "ent",
    name: "Enterprise",
    price: "149",
    description: "Для федераций и крупных чемпионатов",
    features: JSON.stringify(["Всё из Professional", "Сетки до 256", "Несколько татами", "Аудит и статистика", "Приоритетная поддержка"]),
    highlighted: false,
    sortOrder: 3,
  },
];

export const DEFAULT_SITE_SETTINGS = {
  id: "site",
  siteName: "Kumite Arena",
  tagline: "TOURNAMENT SYSTEM",
  logoUrl: null as string | null,
  email: "contact@kumite-arena.local",
  phone: "+992 00 000 0000",
  location: "Dushanbe, Tajikistan",
  heroTitle: null as string | null,
  heroSub: null as string | null,
};

/** Fills admin / countries / settings / pricing. Does not create tournaments. */
export async function bootstrapDb() {
  const admin = await ensureAdmin();
  await prisma.siteSettings.upsert({
    where: { id: "site" },
    update: {},
    create: {
      id: "site",
      siteName: DEFAULT_SITE_SETTINGS.siteName,
      tagline: DEFAULT_SITE_SETTINGS.tagline,
      email: DEFAULT_SITE_SETTINGS.email,
      phone: DEFAULT_SITE_SETTINGS.phone,
      location: DEFAULT_SITE_SETTINGS.location,
    },
  });
  const [countryCount, planCount] = await Promise.all([
    ensureCountries().catch(() => 0),
    prisma.pricingPlan.count(),
  ]);
  if (planCount === 0) {
    for (const p of PLANS) {
      await prisma.pricingPlan.upsert({ where: { id: p.id }, update: {}, create: p });
    }
  }
  console.log(`DB bootstrap: admin ${admin?.email || "skipped"}, countries ${countryCount}, pricing ${planCount}`);
  return admin;
}
