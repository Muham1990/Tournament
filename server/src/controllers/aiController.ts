import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import { audit } from "../services/audit.js";
import { runAiTool } from "../services/aiTools.js";
import {
  aiJson,
  configuredProviders,
  parseFallback,
  parseProvider,
  transcribeAudio,
} from "../services/aiProviders.js";
import { createFromAi, prepareAthlete, type ParsedAthlete } from "../services/aiParticipant.js";
import { resolveCountryId } from "../services/countries.js";
import { uploadRoot } from "../middleware/upload.js";
import fs from "fs";
import path from "path";

function logAi(req: Request, action: string, status: string, extra?: unknown) {
  void audit({
    userId: req.user?.userId,
    action,
    entity: "AI",
    details: { status, ...(extra && typeof extra === "object" ? extra : {}) },
    ip: req.ip,
  });
}

function opts(req: Request) {
  return {
    provider: parseProvider(req.body?.provider),
    fallback: parseFallback(req.body?.fallback),
  };
}

const SCAN_SYSTEM = `Ты извлекаешь данные спортсменов с фото (один человек, список или таблица).
Верни ТОЛЬКО JSON:
{"participants":[{"firstName":string|null,"lastName":string|null,"age":number|null,"weight":number|null,"country":string|null,"gender":"male"|"female"|null,"warnings":string[]}]}
Правила:
- Не угадывай. Если не уверен — null и warning на русском.
- Нужны только: имя, фамилия, возраст (число лет), вес в кг (число), страна, пол.
- gender: female если имя женское (Мария, Амина, Зарина, имена на -а/-я), male если мужское (Мухаммад, Али, Иван). Если неясно — null.
- НЕ извлекай цену, тренера, клуб, школу. Категорию НЕ определяй.
- Имя и фамилию разделяй. Если одно слово — firstName, lastName=null.
- Не добавляй людей, которых нет на фото.
- Пустой результат: {"participants":[]}`;

const VOICE_SYSTEM = `Ты разбираешь фразу администратора турнира про одного участника.
Верни ТОЛЬКО JSON:
{"firstName":string|null,"lastName":string|null,"age":number|null,"weight":number|null,"country":string|null,"gender":"male"|"female"|null,"transcript":string,"missing":string[],"warnings":string[]}
Правила:
- Не угадывай. Если поле не сказано — null и ключ в missing: firstName|lastName|age|weight|country.
- Числительные словами переведи в числа. weight — кг числом.
- gender: female для женских имён (Мария, Амина, Зарина, -а/-я) или если сказали девочка/женщина; male для мужских (Мухаммад, Али) или мальчик/мужчина.
- Нужны только имя, фамилия, возраст, вес, страна, пол.
- НЕ спрашивай и НЕ извлекай цену, тренера, клуб, школу. Категорию НЕ определяй.
- transcript — краткое резюме сказанного.`;

const TOURNAMENT_VOICE_SYSTEM = `Ты разбираешь фразу администратора про создание турнира.
Верни ТОЛЬКО JSON:
{"title":string|null,"slug":string|null,"dateStart":string|null,"dateEnd":string|null,"timeStart":string|null,"timeEnd":string|null,"city":string|null,"address":string|null,"organizer":string|null,"email":string|null,"phone":string|null,"venue":string|null,"tatamiCount":string|null,"description":string|null,"country":string|null,"transcript":string}
Правила:
- Не угадывай. Если поле не сказано — null.
- dateStart и dateEnd в формате YYYY-MM-DD. timeStart и timeEnd в HH:MM.
- slug — латиницей через дефис из названия, если название есть.
- tatamiCount — число строкой, если сказали сколько татами.
- country — название страны как сказано.
- transcript — краткое резюме.`;

function askPrompt(field: string) {
  if (field === "weight") return "Назовите вес участника.";
  if (field === "country") return "Назовите страну.";
  if (field === "age") return "Назовите возраст участника.";
  if (field === "lastName") return "Назовите фамилию.";
  if (field === "firstName") return "Назовите имя.";
  return "Повторите недостающие данные.";
}

function num(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function saveScanPhoto(file: Express.Multer.File) {
  const ext = file.mimetype === "image/png" ? ".png" : file.mimetype === "image/webp" ? ".webp" : ".jpg";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });
  fs.writeFileSync(path.join(uploadRoot, name), file.buffer);
  return `/uploads/${name}`;
}

async function commitReady(req: Request, prepared: Awaited<ReturnType<typeof prepareAthlete>>, force = false, photoUrl?: string) {
  if (!prepared.ready || !prepared.countryId || prepared.age == null || prepared.weight == null || !prepared.firstName || !prepared.lastName) {
    return { created: false, ...prepared, askField: prepared.missing[0] || null, ask: prepared.missing[0] ? askPrompt(prepared.missing[0]) : null };
  }
  const result = await createFromAi({
    tournamentId: prepared.tournamentId,
    firstName: prepared.firstName,
    lastName: prepared.lastName,
    age: prepared.age,
    weight: prepared.weight,
    countryId: prepared.countryId,
    sex: prepared.sex,
    forceDuplicate: force,
    photoUrl,
  });
  if (!result.created) {
    logAi(req, "AI_CREATE", "DUPLICATE");
    return {
      ...prepared,
      created: false,
      duplicate: true,
      category: result.category,
      existing: result.duplicate ? `${result.duplicate.firstName} ${result.duplicate.lastName}` : null,
    };
  }
  logAi(req, "AI_CREATE", "SUCCESS", { id: result.item.id });
  return {
    ...prepared,
    created: true,
    category: result.category,
    participant: result.item,
  };
}

export function listAiProviders(_req: Request, res: Response) {
  res.json({ providers: configuredProviders() });
}

export async function scanParticipants(req: Request, res: Response, next: NextFunction) {
  try {
    const { provider, fallback } = opts(req);
    const tournamentId = String(req.body?.tournamentId || req.query.tournamentId || "");
    if (!tournamentId) throw new AppError("NO_TOURNAMENT", "Укажите турнир.", 400);
    const file = req.file;
    if (!file?.buffer?.length) throw new AppError("NO_FILE", "Загрузите фотографию.", 400);

    const { data, used } = await aiJson<{ participants?: Array<ParsedAthlete & { warnings?: string[] }> }>({
      provider,
      fallback,
      system: SCAN_SYSTEM,
      text: "Извлеки всех участников с этого фото. Только имя, фамилия, возраст, вес, страна.",
      image: { mimeType: file.mimetype || "image/jpeg", data: file.buffer.toString("base64") },
      parseError: "Не удалось распознать данные. Попробуйте сделать фотографию более чёткой.",
    });

    const raw = data.participants || [];
    if (!raw.length) {
      logAi(req, "PHOTO_SCAN", "EMPTY", { used });
      throw new AppError("AI_PARSE", "Не удалось распознать данные. Попробуйте сделать фотографию более чёткой.", 422);
    }

    const force = parseFallback(req.body?.forceDuplicate);
    const photoUrl = raw.length === 1 ? saveScanPhoto(file) : undefined;
    const results = [];
    for (const row of raw) {
      const prepared = await prepareAthlete({
        firstName: row.firstName,
        lastName: row.lastName,
        age: num(row.age),
        weight: num(row.weight),
        country: row.country,
        gender: row.gender,
      }, tournamentId);
      const extraWarn = Array.isArray(row.warnings) ? row.warnings : [];
      const committed = await commitReady(req, { ...prepared, warnings: [...prepared.warnings, ...extraWarn] }, force, photoUrl);
      results.push(committed);
    }

    logAi(req, "PHOTO_SCAN", "SUCCESS", { count: results.length, used, created: results.filter((r) => r.created).length });
    res.json({ found: results.length, used, results });
  } catch (e) {
    if ((e as { code?: string }).code !== "AI_UNAVAILABLE") logAi(req, "PHOTO_SCAN", "API_ERROR");
    next(e);
  }
}

export async function parseVoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { provider, fallback } = opts(req);
    const tournamentId = String(req.body?.tournamentId || "");
    if (!tournamentId) throw new AppError("NO_TOURNAMENT", "Укажите турнир.", 400);
    const retryField = typeof req.body?.retryField === "string" ? req.body.retryField : "";
    let text = String(req.body?.text || "").trim();
    const file = req.file;
    let used = provider;

    if (!text && file?.buffer?.length) {
      const heard = await transcribeAudio({
        provider,
        fallback,
        buffer: file.buffer,
        mimeType: file.mimetype || "audio/webm",
      });
      text = heard.text;
      used = heard.used;
    }
    if (!text) throw new AppError("NO_TEXT", "Пустая речь.", 400);

    const hint = retryField
      ? `Администратор повторяет только поле "${retryField}". Заполни его, остальные поля оставь null, если они не сказаны.`
      : "Разбери всю фразу. Только имя, фамилия, возраст, вес, страна. Без цены, тренера и клуба.";

    const parsed = await aiJson<{
      firstName: string | null;
      lastName: string | null;
      age: number | null;
      weight: number | null;
      country: string | null;
      gender: string | null;
      transcript: string;
      missing: string[];
      warnings: string[];
    }>({
      provider,
      fallback,
      system: VOICE_SYSTEM,
      text: `${hint}\nФраза: ${text}`,
    });
    used = parsed.used;

    let prev: Partial<ParsedAthlete> = {};
    try {
      if (req.body?.prev) prev = JSON.parse(String(req.body.prev));
    } catch { /* ignore */ }
    const prepared = await prepareAthlete({
      firstName: parsed.data.firstName || prev.firstName || null,
      lastName: parsed.data.lastName || prev.lastName || null,
      age: num(parsed.data.age) ?? (typeof prev.age === "number" ? prev.age : null),
      weight: num(parsed.data.weight) ?? (typeof prev.weight === "number" ? prev.weight : null),
      country: parsed.data.country || prev.country || null,
      gender: parsed.data.gender || prev.gender || null,
    }, tournamentId);

    const force = parseFallback(req.body?.forceDuplicate);
    const result = await commitReady(req, prepared, force);
    logAi(req, "VOICE_INPUT", result.created ? "SUCCESS" : prepared.ready ? "DUPLICATE" : "PARTIAL", { used });
    res.json({
      ...result,
      transcript: parsed.data.transcript || text,
      used,
    });
  } catch (e) {
    if ((e as { code?: string }).code !== "AI_UNAVAILABLE") logAi(req, "VOICE_INPUT", "API_ERROR");
    next(e);
  }
}

export async function commitAiParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const tournamentId = String(req.body?.tournamentId || "");
    if (!tournamentId) throw new AppError("NO_TOURNAMENT", "Укажите турнир.", 400);
    const prepared = await prepareAthlete({
      firstName: String(req.body?.firstName || "") || null,
      lastName: String(req.body?.lastName || "") || null,
      age: num(Number(req.body?.age)),
      weight: num(Number(req.body?.weight)),
      country: String(req.body?.country || "") || null,
      gender: typeof req.body?.gender === "string" ? req.body.gender : null,
    }, tournamentId);
    const countryId = await resolveCountryId(String(req.body?.country || req.body?.countryId || ""));
    if (countryId) {
      prepared.countryId = countryId;
      prepared.missing = prepared.missing.filter((m) => m !== "country");
      prepared.ready = prepared.missing.length === 0 && Boolean(prepared.countryId);
    }
    const result = await commitReady(req, prepared, parseFallback(req.body?.forceDuplicate));
    res.json(result);
  } catch (e) {
    next(e);
  }
}

function isResultsQuestion(message: string) {
  const m = message.toLowerCase();
  return /перв(ое|ый|ое\s+место)|занял|побед|чемпион|золот|серебр|бронз|результат|приз[её]р|кто\s+1/.test(m) || /\bместо\b/.test(m);
}

function localPlan(message: string): { tool: string; args: Record<string, unknown> } | null {
  const m = message.toLowerCase();
  if (isResultsQuestion(message)) {
    const bits: string[] = [];
    if (/мальчик/.test(m)) bits.push("мальчик");
    if (/девочк/.test(m)) bits.push("девочк");
    if (/мужчин/.test(m)) bits.push("мужчин");
    if (/женщин/.test(m)) bits.push("женщин");
    const ages = m.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
    if (ages) bits.push(`${ages[1]}-${ages[2]}`);
    return { tool: "getResults", args: { category: bits.join(" ") || undefined, place: 1 } };
  }
  if (/деньг|собрал|цен[аыу]|сомони|tjs|оплат/.test(m)) return { tool: "getRegistrationStats", args: {} };
  if (/без веса|не указан вес|нет веса|веса нет/.test(m)) return { tool: "getMissingData", args: {} };
  if (/сколько/.test(m) && /турнир/.test(m)) return { tool: "getTournamentStats", args: {} };
  if (/сколько/.test(m) && /участник|человек|зарегистр/.test(m) && !/\d+\s*лет/.test(m) && !/категор/.test(m)) {
    return { tool: "getParticipantStats", args: {} };
  }
  const cat = m.match(/категор\w*\s*(?:до\s*)?(\d{1,2}\s*[-–]\s*\d{1,2}|\d{1,2}\+|до\s*\d+)/);
  if (cat) return { tool: "searchParticipants", args: { category: cat[1].replace(/\s+/g, "") } };
  const from = message.match(/(?:из|из страны)\s+([A-Za-zА-Яа-яЁёҶҷӢӣӮӯҲҳҚқҒғ\s-]+)/i);
  if (from?.[1] && /участник/.test(m)) return { tool: "searchParticipants", args: { country: from[1].trim() } };
  const w = m.match(/до\s+(\d+(?:[.,]\d+)?)\s*кг/);
  if (w) return { tool: "searchParticipants", args: { maxWeight: Number(w[1].replace(",", ".")) } };
  const age = m.match(/(\d+)\s*лет/);
  if (age && /участник/.test(m)) return { tool: "searchParticipants", args: { age: Number(age[1]) } };
  const found = message.match(/найд[иь]\s+(.+?)[\s.?!]*$/i);
  if (found?.[1]) return { tool: "searchParticipants", args: { query: found[1].trim() } };
  if (/участник/.test(m) && /сегодня/.test(m)) return { tool: "getParticipantStats", args: {} };
  return null;
}

function formatToolReply(tool: string, data: unknown, message: string) {
  if (tool === "getParticipantStats" && data && typeof data === "object") {
    const d = data as { total?: number; addedToday?: number };
    if (/сегодня/.test(message.toLowerCase())) return `Сегодня добавлено участников: ${d.addedToday ?? 0}.`;
    return `Сейчас зарегистрировано ${d.total ?? 0} участников.`;
  }
  if (tool === "getRegistrationStats" && data && typeof data === "object") {
    const d = data as { totalCollected?: number; currency?: string; note?: string | null };
    if (d.note) return d.note;
    return `Собрано за регистрацию: ${d.totalCollected ?? 0} ${d.currency || "TJS"}.`;
  }
  if (tool === "searchParticipants" && data && typeof data === "object") {
    const d = data as { count?: number; items?: Array<{ firstName?: string; lastName?: string; weight?: number | null; age?: number | null; country?: string | null; category?: string | null }> };
    if (!d.count) return "В базе нет таких участников.";
    const lines = (d.items || []).slice(0, 10).map((p) =>
      `${p.firstName} ${p.lastName}${p.age != null ? `, ${p.age} лет` : ""}${p.weight != null ? `, ${p.weight} кг` : ""}${p.country ? `, ${p.country}` : ""}${p.category ? `, ${p.category}` : ""}`);
    return `Найдено: ${d.count}.\n${lines.join("\n")}`;
  }
  if (tool === "getMissingData" && data && typeof data === "object") {
    const d = data as { noWeight?: string[] };
    if (!d.noWeight?.length) return "У всех участников вес указан.";
    return `Без веса: ${d.noWeight.join(", ")}.`;
  }
  if (tool === "getResults" && data && typeof data === "object") {
    const d = data as { count?: number; note?: string; items?: Array<{ place?: number; firstName?: string; lastName?: string; category?: string; country?: string | null }> };
    if (!d.count) return d.note || "В базе нет результатов по этому запросу.";
    return d.items!.map((r) =>
      `${r.place === 1 ? "1 место" : `${r.place} место`}: ${r.firstName} ${r.lastName}${r.category ? `, ${r.category}` : ""}${r.country ? `, ${r.country}` : ""}`).join("\n");
  }
  if (tool === "getTournamentStats" && data && typeof data === "object") {
    const d = data as { items?: Array<{ title?: string; participants?: number }> };
    if (!d.items?.length) return "В базе нет турниров.";
    return d.items.map((t) => `${t.title}: ${t.participants} участников`).join("\n");
  }
  return "";
}

const PLAN_SYSTEM = `Ты выбираешь ОДНУ backend-функцию для вопроса администратора Kumite Arena.
Верни ТОЛЬКО JSON:
{"tool":"getParticipantStats"|"searchParticipants"|"getMissingData"|"getRegistrationStats"|"getTournamentStats"|"getResults"|"none","args":{},"reply":string|null}
Правила:
- Кто занял место / победитель / первое место / результаты → getResults (args.category например «мальчики 14-15», args.place=1)
- Сколько участников всего → getParticipantStats
- Найти по имени, весу, возрасту, стране → searchParticipants
- Пустой вес → getMissingData
- Деньги / цена / собрано → getRegistrationStats
- Список турниров (не места!) → getTournamentStats
- Приветствие → tool none, reply без цифр из базы
- Не выдумывай данные. Если нужен факт из базы — tool обязателен, reply=null.`;

const ANSWER_SYSTEM = `Сформулируй короткий ответ администратору только по JSON из базы.
Не добавляй факты, которых нет в JSON. Если список пустой — скажи, что таких данных нет.
Язык ответа — как у вопроса.`;

export async function assistantChat(req: Request, res: Response, next: NextFunction) {
  try {
    const { provider, fallback } = opts(req);
    const tournamentId = typeof req.body?.tournamentId === "string" ? req.body.tournamentId : undefined;
    let message = String(req.body?.message || "").trim();
    const file = req.file;
    let used = provider;

    if (!message && file?.buffer?.length) {
      const heard = await transcribeAudio({
        provider,
        fallback,
        buffer: file.buffer,
        mimeType: file.mimetype || "audio/webm",
      });
      message = heard.text;
      used = heard.used;
    }
    if (!message) throw new AppError("NO_TEXT", "Введите вопрос.", 400);

    let plan: { tool?: string; args?: Record<string, unknown>; reply?: string | null } = {};
    try {
      const planned = await aiJson<typeof plan>({
        provider,
        fallback,
        system: PLAN_SYSTEM,
        text: `Вопрос: ${message}\nТекущий турнир: ${tournamentId || "не выбран"}`,
        parseError: "Не удалось понять вопрос. Напишите иначе.",
      });
      plan = planned.data;
      used = planned.used;
    } catch (e) {
      const guessed = localPlan(message);
      if (!guessed) throw e;
      plan = guessed;
    }
    if (isResultsQuestion(message) && plan.tool !== "getResults") {
      plan = localPlan(message) || { tool: "getResults", args: { place: 1 } };
    }
    if (!plan.tool || plan.tool === "none") {
      const guessed = localPlan(message);
      if (guessed) plan = guessed;
    }

    let reply = "";
    if (plan.tool && plan.tool !== "none") {
      const data = await runAiTool(plan.tool, plan.args || {}, tournamentId);
      try {
        const formatted = await aiJson<{ reply: string }>({
          provider,
          fallback,
          system: ANSWER_SYSTEM,
          text: `Вопрос: ${message}\nДанные: ${JSON.stringify(data)}`,
        });
        reply = formatted.data.reply?.trim() || "";
        used = formatted.used;
      } catch {
        reply = "";
      }
      if (!reply) reply = formatToolReply(plan.tool, data, message);
    } else {
      reply = plan.reply?.trim() || "";
    }

    if (!reply) reply = "Не удалось получить ответ. Попробуйте переформулировать вопрос.";
    logAi(req, "AI_QUERY", "SUCCESS", { used });
    res.json({ reply, heard: file ? message : undefined, used });
  } catch (e) {
    if ((e as { code?: string }).code !== "AI_UNAVAILABLE") logAi(req, "AI_QUERY", "API_ERROR");
    next(e);
  }
}

export async function parseTournamentVoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { provider, fallback } = opts(req);
    let text = String(req.body?.text || "").trim();
    const file = req.file;
    let used = provider;

    if (!text && file?.buffer?.length) {
      const heard = await transcribeAudio({
        provider,
        fallback,
        buffer: file.buffer,
        mimeType: file.mimetype || "audio/webm",
      });
      text = heard.text;
      used = heard.used;
    }
    if (!text) throw new AppError("NO_TEXT", "Пустая речь.", 400);

    const parsed = await aiJson<{
      title: string | null;
      slug: string | null;
      dateStart: string | null;
      dateEnd: string | null;
      timeStart: string | null;
      timeEnd: string | null;
      city: string | null;
      address: string | null;
      organizer: string | null;
      email: string | null;
      phone: string | null;
      venue: string | null;
      tatamiCount: string | null;
      description: string | null;
      country: string | null;
      transcript: string;
    }>({
      provider,
      fallback,
      system: TOURNAMENT_VOICE_SYSTEM,
      text: `Фраза администратора: ${text}`,
      parseError: "Не удалось разобрать фразу. Повторите название, даты и город турнира.",
    });

    logAi(req, "TOURNAMENT_VOICE", "SUCCESS", { used });
    res.json({ ...parsed.data, used });
  } catch (e) {
    if ((e as { code?: string }).code !== "AI_UNAVAILABLE") logAi(req, "TOURNAMENT_VOICE", "API_ERROR");
    next(e);
  }
}
