import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
  { code: "RO", name: "Romania", nameRu: "Румыния", nameTg: "Руминия", flag: "🇷🇴" },
  { code: "BG", name: "Bulgaria", nameRu: "Болгария", nameTg: "Булғористон", flag: "🇧🇬" },
  { code: "GE", name: "Georgia", nameRu: "Грузия", nameTg: "Гурҷистон", flag: "🇬🇪" },
  { code: "AM", name: "Armenia", nameRu: "Армения", nameTg: "Арманистон", flag: "🇦🇲" },
  { code: "AZ", name: "Azerbaijan", nameRu: "Азербайджан", nameTg: "Озарбойҷон", flag: "🇦🇿" },
  { code: "BY", name: "Belarus", nameRu: "Беларусь", nameTg: "Беларус", flag: "🇧🇾" },
  { code: "MD", name: "Moldova", nameRu: "Молдова", nameTg: "Молдова", flag: "🇲🇩" },
  { code: "LT", name: "Lithuania", nameRu: "Литва", nameTg: "Литва", flag: "🇱🇹" },
  { code: "LV", name: "Latvia", nameRu: "Латвия", nameTg: "Латвия", flag: "🇱🇻" },
  { code: "EE", name: "Estonia", nameRu: "Эстония", nameTg: "Эстония", flag: "🇪🇪" },
  { code: "NL", name: "Netherlands", nameRu: "Нидерланды", nameTg: "Нидерланд", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", nameRu: "Бельгия", nameTg: "Белгия", flag: "🇧🇪" },
  { code: "AT", name: "Austria", nameRu: "Австрия", nameTg: "Австрия", flag: "🇦🇹" },
  { code: "CH", name: "Switzerland", nameRu: "Швейцария", nameTg: "Швейтсария", flag: "🇨🇭" },
  { code: "CZ", name: "Czechia", nameRu: "Чехия", nameTg: "Чехия", flag: "🇨🇿" },
  { code: "SK", name: "Slovakia", nameRu: "Словакия", nameTg: "Словакия", flag: "🇸🇰" },
  { code: "HU", name: "Hungary", nameRu: "Венгрия", nameTg: "Маҷористон", flag: "🇭🇺" },
  { code: "RS", name: "Serbia", nameRu: "Сербия", nameTg: "Сербия", flag: "🇷🇸" },
  { code: "HR", name: "Croatia", nameRu: "Хорватия", nameTg: "Хорватия", flag: "🇭🇷" },
  { code: "GR", name: "Greece", nameRu: "Греция", nameTg: "Юнон", flag: "🇬🇷" },
  { code: "PT", name: "Portugal", nameRu: "Португалия", nameTg: "Португалия", flag: "🇵🇹" },
  { code: "EG", name: "Egypt", nameRu: "Египет", nameTg: "Миср", flag: "🇪🇬" },
  { code: "MA", name: "Morocco", nameRu: "Марокко", nameTg: "Марокаш", flag: "🇲🇦" },
  { code: "TN", name: "Tunisia", nameRu: "Тунис", nameTg: "Тунис", flag: "🇹🇳" },
  { code: "IN", name: "India", nameRu: "Индия", nameTg: "Ҳиндустон", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", nameRu: "Пакистан", nameTg: "Покистон", flag: "🇵🇰" },
  { code: "BR", name: "Brazil", nameRu: "Бразилия", nameTg: "Бразилия", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", nameRu: "Аргентина", nameTg: "Аргентина", flag: "🇦🇷" },
  { code: "CA", name: "Canada", nameRu: "Канада", nameTg: "Канада", flag: "🇨🇦" },
  { code: "AU", name: "Australia", nameRu: "Австралия", nameTg: "Австралия", flag: "🇦🇺" },
];

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { password: hash, role: "ADMIN" },
    create: { email, password: hash, role: "ADMIN", name: "Administrator" },
  });

  for (const c of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name, nameRu: c.nameRu, nameTg: c.nameTg, flag: c.flag },
      create: c,
    });
  }

  await prisma.siteSettings.upsert({
    where: { id: "site" },
    update: {},
    create: {
      id: "site",
      siteName: "Kumite Arena",
      tagline: "TOURNAMENT SYSTEM",
      email: "contact@kumite-arena.local",
      phone: "+992 00 000 0000",
      location: "Dushanbe, Tajikistan",
    },
  });

  const plans = [
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

  for (const p of plans) {
    await prisma.pricingPlan.upsert({
      where: { id: p.id },
      update: {},
      create: p,
    });
  }

  console.log("Seed complete: admin, countries, settings, pricing. Tournaments remain empty.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
