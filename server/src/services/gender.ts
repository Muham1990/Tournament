const MALE_A = new Set([
  "никита", "илья", "саша", "женя", "миша", "коля", "ваня", "дима", "данила", "кузьма",
  "фома", "лука", "гоша", "леша", "лёша", "паша", "толя", "витя", "серега", "серёжа",
]);

const FEMALE = new Set([
  "мария", "маша", "анна", "аня", "алина", "амина", "азиза", "гулнора", "гульнора",
  "дилноза", "зарина", "зарина", "мадина", "нигина", "фатима", "сабина", "шахноза",
  "мохру", "нигора", "парвина", "мукаддас", "ольга", "елена", "екатерина", "наталья",
  "виктория", "полина", "софия", "софья", "дарья", "диана", "карина", "леila", "лейла",
  "малика", "самира", "яна", "ирина", "татьяна", "людмила", "светлана", "ксения",
]);

const MALE = new Set([
  "мухаммад", "муҳаммад", "абдулло", "али", "алишер", "рахим", "карим", "джамшед",
  "фирдавс", "иван", "александр", "сергей", "дмитрий", "андрей", "павел", "артём",
  "артем", "максим", "никита", "илья", "олег", "рома", "роман", "тимур", "рустам",
  "джамшед", "шахзод", "бехруз", "фарход", "абдуллоҳ",
]);

export type Sex = "male" | "female";

export function guessSexFromName(firstName: string | null | undefined): Sex {
  const n = (firstName || "").trim().toLowerCase().replace(/ё/g, "е");
  if (!n) return "male";
  if (FEMALE.has(n)) return "female";
  if (MALE.has(n) || MALE_A.has(n)) return "male";
  if (/(а|я|ия|ея|ша)$/.test(n) && !MALE_A.has(n)) return "female";
  return "male";
}

export function parseSexHint(raw: unknown, firstName?: string | null): Sex {
  const s = String(raw || "").toLowerCase();
  if (/girl|female|жен|дев|woman|women/.test(s)) return "female";
  if (/boy|male|муж|мальч|man|men/.test(s)) return "male";
  return guessSexFromName(firstName || "");
}

export function genderFromAgeAndSex(age: number, sex: Sex): "BOYS" | "GIRLS" | "MEN" | "WOMEN" {
  if (sex === "female") return age < 18 ? "GIRLS" : "WOMEN";
  return age < 18 ? "BOYS" : "MEN";
}

export function genderLabel(gender: "BOYS" | "GIRLS" | "MEN" | "WOMEN") {
  if (gender === "BOYS") return "Мальчики";
  if (gender === "GIRLS") return "Девочки";
  if (gender === "MEN") return "Мужчины";
  return "Женщины";
}
