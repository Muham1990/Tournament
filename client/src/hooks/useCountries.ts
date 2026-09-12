import { useEffect, useState } from "react";
import { CountryApi } from "../services/endpoints";
import type { Country } from "../types";

const FALLBACK_COUNTRIES: Country[] = [
  { id: "TJ", code: "TJ", name: "Tajikistan", nameRu: "Таджикистан", nameTg: "Тоҷикистон", flag: "🇹🇯" },
  { id: "RU", code: "RU", name: "Russia", nameRu: "Россия", nameTg: "Русия", flag: "🇷🇺" },
  { id: "KZ", code: "KZ", name: "Kazakhstan", nameRu: "Казахстан", nameTg: "Қазоқистон", flag: "🇰🇿" },
  { id: "UZ", code: "UZ", name: "Uzbekistan", nameRu: "Узбекистан", nameTg: "Ӯзбекистон", flag: "🇺🇿" },
  { id: "KG", code: "KG", name: "Kyrgyzstan", nameRu: "Кыргызстан", nameTg: "Қирғизистон", flag: "🇰🇬" },
  { id: "TM", code: "TM", name: "Turkmenistan", nameRu: "Туркменистан", nameTg: "Туркманистон", flag: "🇹🇲" },
  { id: "AF", code: "AF", name: "Afghanistan", nameRu: "Афганистан", nameTg: "Афғонистон", flag: "🇦🇫" },
  { id: "IR", code: "IR", name: "Iran", nameRu: "Иран", nameTg: "Эрон", flag: "🇮🇷" },
  { id: "TR", code: "TR", name: "Turkey", nameRu: "Турция", nameTg: "Туркия", flag: "🇹🇷" },
  { id: "CN", code: "CN", name: "China", nameRu: "Китай", nameTg: "Чин", flag: "🇨🇳" },
  { id: "MN", code: "MN", name: "Mongolia", nameRu: "Монголия", nameTg: "Муғулистон", flag: "🇲🇳" },
  { id: "JP", code: "JP", name: "Japan", nameRu: "Япония", nameTg: "Ҷопон", flag: "🇯🇵" },
  { id: "KR", code: "KR", name: "South Korea", nameRu: "Южная Корея", nameTg: "Кореяи Ҷанубӣ", flag: "🇰🇷" },
  { id: "TH", code: "TH", name: "Thailand", nameRu: "Таиланд", nameTg: "Таиланд", flag: "🇹🇭" },
  { id: "VN", code: "VN", name: "Vietnam", nameRu: "Вьетнам", nameTg: "Ветнам", flag: "🇻🇳" },
  { id: "ID", code: "ID", name: "Indonesia", nameRu: "Индонезия", nameTg: "Индонезия", flag: "🇮🇩" },
  { id: "IN", code: "IN", name: "India", nameRu: "Индия", nameTg: "Ҳиндустон", flag: "🇮🇳" },
  { id: "PK", code: "PK", name: "Pakistan", nameRu: "Пакистан", nameTg: "Покистон", flag: "🇵🇰" },
  { id: "SA", code: "SA", name: "Saudi Arabia", nameRu: "Саудовская Аравия", nameTg: "Арабистони Саудӣ", flag: "🇸🇦" },
  { id: "AE", code: "AE", name: "United Arab Emirates", nameRu: "ОАЭ", nameTg: "Аморати Муттаҳида", flag: "🇦🇪" },
  { id: "QA", code: "QA", name: "Qatar", nameRu: "Катар", nameTg: "Қатар", flag: "🇶🇦" },
  { id: "GE", code: "GE", name: "Georgia", nameRu: "Грузия", nameTg: "Гурҷистон", flag: "🇬🇪" },
  { id: "AM", code: "AM", name: "Armenia", nameRu: "Армения", nameTg: "Арманистон", flag: "🇦🇲" },
  { id: "AZ", code: "AZ", name: "Azerbaijan", nameRu: "Азербайджан", nameTg: "Озарбойҷон", flag: "🇦🇿" },
  { id: "UA", code: "UA", name: "Ukraine", nameRu: "Украина", nameTg: "Украина", flag: "🇺🇦" },
  { id: "BY", code: "BY", name: "Belarus", nameRu: "Беларусь", nameTg: "Беларус", flag: "🇧🇾" },
  { id: "PL", code: "PL", name: "Poland", nameRu: "Польша", nameTg: "Лаҳистон", flag: "🇵🇱" },
  { id: "DE", code: "DE", name: "Germany", nameRu: "Германия", nameTg: "Олмон", flag: "🇩🇪" },
  { id: "FR", code: "FR", name: "France", nameRu: "Франция", nameTg: "Фаронса", flag: "🇫🇷" },
  { id: "IT", code: "IT", name: "Italy", nameRu: "Италия", nameTg: "Италия", flag: "🇮🇹" },
  { id: "ES", code: "ES", name: "Spain", nameRu: "Испания", nameTg: "Испания", flag: "🇪🇸" },
  { id: "GB", code: "GB", name: "United Kingdom", nameRu: "Великобритания", nameTg: "Британияи Кабир", flag: "🇬🇧" },
  { id: "US", code: "US", name: "United States", nameRu: "США", nameTg: "ИМА", flag: "🇺🇸" },
  { id: "CA", code: "CA", name: "Canada", nameRu: "Канада", nameTg: "Канада", flag: "🇨🇦" },
  { id: "BR", code: "BR", name: "Brazil", nameRu: "Бразилия", nameTg: "Бразилия", flag: "🇧🇷" },
  { id: "AU", code: "AU", name: "Australia", nameRu: "Австралия", nameTg: "Австралия", flag: "🇦🇺" },
  { id: "EG", code: "EG", name: "Egypt", nameRu: "Египет", nameTg: "Миср", flag: "🇪🇬" },
  { id: "MA", code: "MA", name: "Morocco", nameRu: "Марокко", nameTg: "Марокаш", flag: "🇲🇦" },
  { id: "NL", code: "NL", name: "Netherlands", nameRu: "Нидерланды", nameTg: "Нидерланд", flag: "🇳🇱" },
  { id: "AT", code: "AT", name: "Austria", nameRu: "Австрия", nameTg: "Австрия", flag: "🇦🇹" },
  { id: "CH", code: "CH", name: "Switzerland", nameRu: "Швейцария", nameTg: "Швейтсария", flag: "🇨🇭" },
  { id: "CZ", code: "CZ", name: "Czechia", nameRu: "Чехия", nameTg: "Чехия", flag: "🇨🇿" },
  { id: "RS", code: "RS", name: "Serbia", nameRu: "Сербия", nameTg: "Сербия", flag: "🇷🇸" },
  { id: "GR", code: "GR", name: "Greece", nameRu: "Греция", nameTg: "Юнон", flag: "🇬🇷" },
  { id: "MX", code: "MX", name: "Mexico", nameRu: "Мексика", nameTg: "Мексика", flag: "🇲🇽" },
  { id: "AR", code: "AR", name: "Argentina", nameRu: "Аргентина", nameTg: "Аргентина", flag: "🇦🇷" },
  { id: "RO", code: "RO", name: "Romania", nameRu: "Румыния", nameTg: "Руминия", flag: "🇷🇴" },
  { id: "BG", code: "BG", name: "Bulgaria", nameRu: "Болгария", nameTg: "Булғористон", flag: "🇧🇬" },
  { id: "HU", code: "HU", name: "Hungary", nameRu: "Венгрия", nameTg: "Маҷористон", flag: "🇭🇺" },
  { id: "PT", code: "PT", name: "Portugal", nameRu: "Португалия", nameTg: "Португалия", flag: "🇵🇹" },
  { id: "SE", code: "SE", name: "Sweden", nameRu: "Швеция", nameTg: "Шветсия", flag: "🇸🇪" },
  { id: "FI", code: "FI", name: "Finland", nameRu: "Финляндия", nameTg: "Финляндия", flag: "🇫🇮" },
  { id: "NO", code: "NO", name: "Norway", nameRu: "Норвегия", nameTg: "Норвегия", flag: "🇳🇴" },
  { id: "DK", code: "DK", name: "Denmark", nameRu: "Дания", nameTg: "Дания", flag: "🇩🇰" },
  { id: "BE", code: "BE", name: "Belgium", nameRu: "Бельгия", nameTg: "Белгия", flag: "🇧🇪" },
  { id: "SK", code: "SK", name: "Slovakia", nameRu: "Словакия", nameTg: "Словакия", flag: "🇸🇰" },
  { id: "HR", code: "HR", name: "Croatia", nameRu: "Хорватия", nameTg: "Хорватия", flag: "🇭🇷" },
  { id: "MD", code: "MD", name: "Moldova", nameRu: "Молдова", nameTg: "Молдова", flag: "🇲🇩" },
  { id: "LT", code: "LT", name: "Lithuania", nameRu: "Литва", nameTg: "Литва", flag: "🇱🇹" },
  { id: "LV", code: "LV", name: "Latvia", nameRu: "Латвия", nameTg: "Латвия", flag: "🇱🇻" },
  { id: "EE", code: "EE", name: "Estonia", nameRu: "Эстония", nameTg: "Эстония", flag: "🇪🇪" },
  { id: "CU", code: "CU", name: "Cuba", nameRu: "Куба", nameTg: "Куба", flag: "🇨🇺" },
  { id: "NZ", code: "NZ", name: "New Zealand", nameRu: "Новая Зеландия", nameTg: "Зеландияи Нав", flag: "🇳🇿" },
  { id: "TN", code: "TN", name: "Tunisia", nameRu: "Тунис", nameTg: "Тунис", flag: "🇹🇳" },
  { id: "ZA", code: "ZA", name: "South Africa", nameRu: "ЮАР", nameTg: "Африқои Ҷанубӣ", flag: "🇿🇦" },
  { id: "MY", code: "MY", name: "Malaysia", nameRu: "Малайзия", nameTg: "Малайзия", flag: "🇲🇾" },
  { id: "PH", code: "PH", name: "Philippines", nameRu: "Филиппины", nameTg: "Филиппин", flag: "🇵🇭" },
  { id: "IQ", code: "IQ", name: "Iraq", nameRu: "Ирак", nameTg: "Ироқ", flag: "🇮🇶" },
];

function mergeCountries(items?: Country[] | null): Country[] {
  if (items?.length) {
    const have = new Set(items.map((c) => c.code.toUpperCase()));
    const extra = FALLBACK_COUNTRIES.filter((c) => !have.has(c.code.toUpperCase()));
    return [...items, ...extra].sort((a, b) => a.nameRu.localeCompare(b.nameRu, "ru"));
  }
  return [...FALLBACK_COUNTRIES].sort((a, b) => a.nameRu.localeCompare(b.nameRu, "ru"));
}

export function useCountries() {
  const [countries, setCountries] = useState<Country[]>(() => mergeCountries(null));

  useEffect(() => {
    CountryApi.list()
      .then((r) => setCountries(mergeCountries(r.data.items)))
      .catch(() => setCountries(mergeCountries(null)));
  }, []);

  const defaultId = countries.find((c) => c.code === "TJ")?.id || countries[0]?.id || "";
  return { countries, defaultId };
}
