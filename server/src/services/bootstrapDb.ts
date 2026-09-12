import { prisma } from "../utils/prisma.js";
import { ensureAdmin } from "./ensureAdmin.js";

const COUNTRIES: Array<{ code: string; name: string; nameRu: string; nameTg: string; flag: string }> = [
  { code: "TJ", name: "Tajikistan", nameRu: "Таджикистан", nameTg: "Тоҷикистон", flag: "🇹🇯" },
  { code: "RU", name: "Russia", nameRu: "Россия", nameTg: "Русия", flag: "🇷🇺" },
  { code: "KZ", name: "Kazakhstan", nameRu: "Казахстан", nameTg: "Қазоқистон", flag: "🇰🇿" },
  { code: "UZ", name: "Uzbekistan", nameRu: "Узбекистан", nameTg: "Ӯзбекистон", flag: "🇺🇿" },
  { code: "KG", name: "Kyrgyzstan", nameRu: "Кыргызстан", nameTg: "Қирғизистон", flag: "🇰🇬" },
  { code: "TM", name: "Turkmenistan", nameRu: "Туркменистан", nameTg: "Туркманистон", flag: "🇹🇲" },
  { code: "TR", name: "Turkey", nameRu: "Турция", nameTg: "Туркия", flag: "🇹🇷" },
  { code: "IR", name: "Iran", nameRu: "Иран", nameTg: "Эрон", flag: "🇮🇷" },
  { code: "AF", name: "Afghanistan", nameRu: "Афганистан", nameTg: "Афғонистон", flag: "🇦🇫" },
  { code: "CN", name: "China", nameRu: "Китай", nameTg: "Чин", flag: "🇨🇳" },
  { code: "JP", name: "Japan", nameRu: "Япония", nameTg: "Ҷопон", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", nameRu: "Южная Корея", nameTg: "Кореяи Ҷанубӣ", flag: "🇰🇷" },
  { code: "DE", name: "Germany", nameRu: "Германия", nameTg: "Олмон", flag: "🇩🇪" },
  { code: "FR", name: "France", nameRu: "Франция", nameTg: "Фаронса", flag: "🇫🇷" },
  { code: "IT", name: "Italy", nameRu: "Италия", nameTg: "Италия", flag: "🇮🇹" },
  { code: "ES", name: "Spain", nameRu: "Испания", nameTg: "Испания", flag: "🇪🇸" },
  { code: "GB", name: "United Kingdom", nameRu: "Великобритания", nameTg: "Британияи Кабир", flag: "🇬🇧" },
  { code: "US", name: "United States", nameRu: "США", nameTg: "ИМА", flag: "🇺🇸" },
  { code: "UA", name: "Ukraine", nameRu: "Украина", nameTg: "Украина", flag: "🇺🇦" },
  { code: "PL", name: "Poland", nameRu: "Польша", nameTg: "Лаҳистон", flag: "🇵🇱" },
  { code: "GE", name: "Georgia", nameRu: "Грузия", nameTg: "Гурҷистон", flag: "🇬🇪" },
  { code: "AM", name: "Armenia", nameRu: "Армения", nameTg: "Арманистон", flag: "🇦🇲" },
  { code: "AZ", name: "Azerbaijan", nameRu: "Азербайджан", nameTg: "Озарбойҷон", flag: "🇦🇿" },
  { code: "BY", name: "Belarus", nameRu: "Беларусь", nameTg: "Беларус", flag: "🇧🇾" },
  { code: "IN", name: "India", nameRu: "Индия", nameTg: "Ҳиндустон", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", nameRu: "Пакистан", nameTg: "Покистон", flag: "🇵🇰" },
  { code: "BR", name: "Brazil", nameRu: "Бразилия", nameTg: "Бразилия", flag: "🇧🇷" },
  { code: "CA", name: "Canada", nameRu: "Канада", nameTg: "Канада", flag: "🇨🇦" },
  { code: "AU", name: "Australia", nameRu: "Австралия", nameTg: "Австралия", flag: "🇦🇺" },
  { code: "EG", name: "Egypt", nameRu: "Египет", nameTg: "Миср", flag: "🇪🇬" },
  { code: "NL", name: "Netherlands", nameRu: "Нидерланды", nameTg: "Нидерланд", flag: "🇳🇱" },
  { code: "AT", name: "Austria", nameRu: "Австрия", nameTg: "Австрия", flag: "🇦🇹" },
  { code: "CH", name: "Switzerland", nameRu: "Швейцария", nameTg: "Швейтсария", flag: "🇨🇭" },
  { code: "CZ", name: "Czechia", nameRu: "Чехия", nameTg: "Чехия", flag: "🇨🇿" },
  { code: "RS", name: "Serbia", nameRu: "Сербия", nameTg: "Сербия", flag: "🇷🇸" },
  { code: "GR", name: "Greece", nameRu: "Греция", nameTg: "Юнон", flag: "🇬🇷" },
];

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
    prisma.country.count(),
    prisma.pricingPlan.count(),
  ]);
  if (countryCount === 0) {
    await prisma.country.createMany({ data: COUNTRIES, skipDuplicates: true });
  }
  if (planCount === 0) {
    for (const p of PLANS) {
      await prisma.pricingPlan.upsert({ where: { id: p.id }, update: {}, create: p });
    }
  }
  console.log(`DB bootstrap: admin ${admin?.email || "skipped"}, countries ${countryCount}, pricing ${planCount}`);
  return admin;
}
