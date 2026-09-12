import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { COUNTRY_CATALOG as COUNTRIES } from "../server/src/services/countries.js";

const prisma = new PrismaClient();

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
