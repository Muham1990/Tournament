import { prisma } from "../utils/prisma.js";

export type CountrySeed = {
  code: string;
  name: string;
  nameRu: string;
  nameTg: string;
  flag: string;
};

/** Catalog for tournament venue / athlete nationality. Codes are ISO 3166-1 alpha-2. */
export const COUNTRY_CATALOG: CountrySeed[] = [
  { code: "TJ", name: "Tajikistan", nameRu: "Таджикистан", nameTg: "Тоҷикистон", flag: "🇹🇯" },
  { code: "RU", name: "Russia", nameRu: "Россия", nameTg: "Русия", flag: "🇷🇺" },
  { code: "KZ", name: "Kazakhstan", nameRu: "Казахстан", nameTg: "Қазоқистон", flag: "🇰🇿" },
  { code: "UZ", name: "Uzbekistan", nameRu: "Узбекистан", nameTg: "Ӯзбекистон", flag: "🇺🇿" },
  { code: "KG", name: "Kyrgyzstan", nameRu: "Кыргызстан", nameTg: "Қирғизистон", flag: "🇰🇬" },
  { code: "TM", name: "Turkmenistan", nameRu: "Туркменистан", nameTg: "Туркманистон", flag: "🇹🇲" },
  { code: "AF", name: "Afghanistan", nameRu: "Афганистан", nameTg: "Афғонистон", flag: "🇦🇫" },
  { code: "IR", name: "Iran", nameRu: "Иран", nameTg: "Эрон", flag: "🇮🇷" },
  { code: "TR", name: "Turkey", nameRu: "Турция", nameTg: "Туркия", flag: "🇹🇷" },
  { code: "CN", name: "China", nameRu: "Китай", nameTg: "Чин", flag: "🇨🇳" },
  { code: "MN", name: "Mongolia", nameRu: "Монголия", nameTg: "Муғулистон", flag: "🇲🇳" },
  { code: "JP", name: "Japan", nameRu: "Япония", nameTg: "Ҷопон", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", nameRu: "Южная Корея", nameTg: "Кореяи Ҷанубӣ", flag: "🇰🇷" },
  { code: "TH", name: "Thailand", nameRu: "Таиланд", nameTg: "Таиланд", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", nameRu: "Вьетнам", nameTg: "Ветнам", flag: "🇻🇳" },
  { code: "ID", name: "Indonesia", nameRu: "Индонезия", nameTg: "Индонезия", flag: "🇮🇩" },
  { code: "MY", name: "Malaysia", nameRu: "Малайзия", nameTg: "Малайзия", flag: "🇲🇾" },
  { code: "PH", name: "Philippines", nameRu: "Филиппины", nameTg: "Филиппин", flag: "🇵🇭" },
  { code: "SG", name: "Singapore", nameRu: "Сингапур", nameTg: "Сингапур", flag: "🇸🇬" },
  { code: "IN", name: "India", nameRu: "Индия", nameTg: "Ҳиндустон", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", nameRu: "Пакистан", nameTg: "Покистон", flag: "🇵🇰" },
  { code: "SA", name: "Saudi Arabia", nameRu: "Саудовская Аравия", nameTg: "Арабистони Саудӣ", flag: "🇸🇦" },
  { code: "AE", name: "United Arab Emirates", nameRu: "ОАЭ", nameTg: "Аморати Муттаҳида", flag: "🇦🇪" },
  { code: "QA", name: "Qatar", nameRu: "Катар", nameTg: "Қатар", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", nameRu: "Кувейт", nameTg: "Қувайт", flag: "🇰🇼" },
  { code: "IQ", name: "Iraq", nameRu: "Ирак", nameTg: "Ироқ", flag: "🇮🇶" },
  { code: "JO", name: "Jordan", nameRu: "Иордания", nameTg: "Урдун", flag: "🇯🇴" },
  { code: "IL", name: "Israel", nameRu: "Израиль", nameTg: "Исроил", flag: "🇮🇱" },
  { code: "GE", name: "Georgia", nameRu: "Грузия", nameTg: "Гурҷистон", flag: "🇬🇪" },
  { code: "AM", name: "Armenia", nameRu: "Армения", nameTg: "Арманистон", flag: "🇦🇲" },
  { code: "AZ", name: "Azerbaijan", nameRu: "Азербайджан", nameTg: "Озарбойҷон", flag: "🇦🇿" },
  { code: "UA", name: "Ukraine", nameRu: "Украина", nameTg: "Украина", flag: "🇺🇦" },
  { code: "BY", name: "Belarus", nameRu: "Беларусь", nameTg: "Беларус", flag: "🇧🇾" },
  { code: "MD", name: "Moldova", nameRu: "Молдова", nameTg: "Молдова", flag: "🇲🇩" },
  { code: "LT", name: "Lithuania", nameRu: "Литва", nameTg: "Литва", flag: "🇱🇹" },
  { code: "LV", name: "Latvia", nameRu: "Латвия", nameTg: "Латвия", flag: "🇱🇻" },
  { code: "EE", name: "Estonia", nameRu: "Эстония", nameTg: "Эстония", flag: "🇪🇪" },
  { code: "PL", name: "Poland", nameRu: "Польша", nameTg: "Лаҳистон", flag: "🇵🇱" },
  { code: "DE", name: "Germany", nameRu: "Германия", nameTg: "Олмон", flag: "🇩🇪" },
  { code: "FR", name: "France", nameRu: "Франция", nameTg: "Фаронса", flag: "🇫🇷" },
  { code: "IT", name: "Italy", nameRu: "Италия", nameTg: "Италия", flag: "🇮🇹" },
  { code: "ES", name: "Spain", nameRu: "Испания", nameTg: "Испания", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", nameRu: "Португалия", nameTg: "Португалия", flag: "🇵🇹" },
  { code: "GB", name: "United Kingdom", nameRu: "Великобритания", nameTg: "Британияи Кабир", flag: "🇬🇧" },
  { code: "IE", name: "Ireland", nameRu: "Ирландия", nameTg: "Ирландия", flag: "🇮🇪" },
  { code: "NL", name: "Netherlands", nameRu: "Нидерланды", nameTg: "Нидерланд", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", nameRu: "Бельгия", nameTg: "Белгия", flag: "🇧🇪" },
  { code: "AT", name: "Austria", nameRu: "Австрия", nameTg: "Австрия", flag: "🇦🇹" },
  { code: "CH", name: "Switzerland", nameRu: "Швейцария", nameTg: "Швейтсария", flag: "🇨🇭" },
  { code: "CZ", name: "Czechia", nameRu: "Чехия", nameTg: "Чехия", flag: "🇨🇿" },
  { code: "SK", name: "Slovakia", nameRu: "Словакия", nameTg: "Словакия", flag: "🇸🇰" },
  { code: "HU", name: "Hungary", nameRu: "Венгрия", nameTg: "Маҷористон", flag: "🇭🇺" },
  { code: "RO", name: "Romania", nameRu: "Румыния", nameTg: "Руминия", flag: "🇷🇴" },
  { code: "BG", name: "Bulgaria", nameRu: "Болгария", nameTg: "Булғористон", flag: "🇧🇬" },
  { code: "GR", name: "Greece", nameRu: "Греция", nameTg: "Юнон", flag: "🇬🇷" },
  { code: "RS", name: "Serbia", nameRu: "Сербия", nameTg: "Сербия", flag: "🇷🇸" },
  { code: "HR", name: "Croatia", nameRu: "Хорватия", nameTg: "Хорватия", flag: "🇭🇷" },
  { code: "BA", name: "Bosnia and Herzegovina", nameRu: "Босния и Герцеговина", nameTg: "Босния", flag: "🇧🇦" },
  { code: "SI", name: "Slovenia", nameRu: "Словения", nameTg: "Словения", flag: "🇸🇮" },
  { code: "AL", name: "Albania", nameRu: "Албания", nameTg: "Албания", flag: "🇦🇱" },
  { code: "FI", name: "Finland", nameRu: "Финляндия", nameTg: "Финляндия", flag: "🇫🇮" },
  { code: "SE", name: "Sweden", nameRu: "Швеция", nameTg: "Шветсия", flag: "🇸🇪" },
  { code: "NO", name: "Norway", nameRu: "Норвегия", nameTg: "Норвегия", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", nameRu: "Дания", nameTg: "Дания", flag: "🇩🇰" },
  { code: "US", name: "United States", nameRu: "США", nameTg: "ИМА", flag: "🇺🇸" },
  { code: "CA", name: "Canada", nameRu: "Канада", nameTg: "Канада", flag: "🇨🇦" },
  { code: "MX", name: "Mexico", nameRu: "Мексика", nameTg: "Мексика", flag: "🇲🇽" },
  { code: "BR", name: "Brazil", nameRu: "Бразилия", nameTg: "Бразилия", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", nameRu: "Аргентина", nameTg: "Аргентина", flag: "🇦🇷" },
  { code: "CL", name: "Chile", nameRu: "Чили", nameTg: "Чили", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", nameRu: "Колумбия", nameTg: "Колумбия", flag: "🇨🇴" },
  { code: "CU", name: "Cuba", nameRu: "Куба", nameTg: "Куба", flag: "🇨🇺" },
  { code: "AU", name: "Australia", nameRu: "Австралия", nameTg: "Австралия", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", nameRu: "Новая Зеландия", nameTg: "Зеландияи Нав", flag: "🇳🇿" },
  { code: "EG", name: "Egypt", nameRu: "Египет", nameTg: "Миср", flag: "🇪🇬" },
  { code: "MA", name: "Morocco", nameRu: "Марокко", nameTg: "Марокаш", flag: "🇲🇦" },
  { code: "TN", name: "Tunisia", nameRu: "Тунис", nameTg: "Тунис", flag: "🇹🇳" },
  { code: "DZ", name: "Algeria", nameRu: "Алжир", nameTg: "Алҷазоир", flag: "🇩🇿" },
  { code: "ZA", name: "South Africa", nameRu: "ЮАР", nameTg: "Африқои Ҷанубӣ", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", nameRu: "Нигерия", nameTg: "Нигерия", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", nameRu: "Кения", nameTg: "Кения", flag: "🇰🇪" },
];

export function fallbackCountryItems() {
  return COUNTRY_CATALOG.map((c) => ({ id: c.code, ...c }));
}

export async function ensureCountries() {
  const n = await prisma.country.count();
  if (n >= COUNTRY_CATALOG.length) return n;
  await prisma.country.createMany({ data: COUNTRY_CATALOG, skipDuplicates: true });
  return prisma.country.count();
}

function matchSeed(q: string): CountrySeed | undefined {
  const low = q.trim().toLowerCase();
  const code = q.replace(/^code:/i, "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) {
    return COUNTRY_CATALOG.find((c) => c.code === code);
  }
  return COUNTRY_CATALOG.find((c) =>
    [c.name, c.nameRu, c.nameTg, c.code].some((v) => v.toLowerCase() === low || v.toLowerCase().includes(low) || low.includes(v.toLowerCase())),
  );
}

/** Accepts DB id, ISO code, or country name. Creates the row if only the catalog knows it. */
export async function resolveCountryId(raw?: string | null): Promise<string | undefined> {
  const v = raw?.trim();
  if (!v) return undefined;
  const byId = await prisma.country.findUnique({ where: { id: v } }).catch(() => null);
  if (byId) return byId.id;

  const seed = matchSeed(v);
  const code = seed?.code || (v.replace(/^code:/i, "").trim().toUpperCase().match(/^[A-Z]{2}$/)?.[0]);
  if (!code) return undefined;

  const row = await prisma.country.upsert({
    where: { code },
    update: seed ? { name: seed.name, nameRu: seed.nameRu, nameTg: seed.nameTg, flag: seed.flag } : {},
    create: seed || { code, name: code, nameRu: code, nameTg: code, flag: "🏳️" },
  });
  return row.id;
}
