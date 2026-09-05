import { prisma } from "../utils/prisma.js";
import { getSportsSchedule } from "../services/sportsSchedule.js";
import fs from "fs";
import path from "path";
import https from "node:https";
const usersFile = path.resolve(process.cwd(), ".telegram-users.json");

type StoredUser = { telegramId: string; firstName?: string; username?: string; lastSeenAt: string };

function loadUsers(): StoredUser[] {
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf8")) as StoredUser[];
  } catch {
    return [];
  }
}

function saveUsers(list: StoredUser[]) {
  fs.writeFileSync(usersFile, JSON.stringify(list, null, 2));
}

function touchUser(from?: { id: number; first_name?: string; username?: string }) {
  if (!from?.id) return;
  const list = loadUsers();
  const id = String(from.id);
  const now = new Date().toISOString();
  const i = list.findIndex((u) => u.telegramId === id);
  const row: StoredUser = { telegramId: id, firstName: from.first_name, username: from.username, lastSeenAt: now };
  if (i >= 0) list[i] = row;
  else list.push(row);
  saveUsers(list);
}

type TgResponse = { ok: boolean; result?: unknown; description?: string };
type TgUser = { id: number; first_name?: string; username?: string };
type TgChat = { id: number };
type TgMessage = { chat: TgChat; from?: TgUser; text?: string };
type TgCallback = { id: string; from: TgUser; data?: string; message?: { chat: TgChat; message_id: number } };
type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallback };

async function tg(token: string, method: string, body: Record<string, unknown> = {}): Promise<TgResponse> {
  const waitMs = method === "getUpdates" ? 60_000 : 30_000;
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/${method}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: waitMs,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as TgResponse);
        } catch {
          resolve({ ok: false, description: "bad_json" });
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, description: "timeout" });
    });
    req.on("error", (e) => resolve({ ok: false, description: e.message }));
    req.write(payload);
    req.end();
  });
}

function appUrl(): string {
  return (process.env.TELEGRAM_WEBAPP_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
}

function adminId(): string {
  return process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || "";
}

function isAdmin(chatId: number | string): boolean {
  return String(chatId) === adminId();
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("ru-RU", { timeZone: "Asia/Dushanbe", day: "2-digit", month: "long", year: "numeric" });
}

function webBtn(url: string, path = "", label = "Открыть приложение") {
  const full = `${url}${path}`;
  if (full.startsWith("https://")) return { text: label, web_app: { url: full } };
  return { text: label, url: full };
}

function userKeyboard(url: string, admin = false) {
  const rows: Array<Array<{ text: string; web_app?: { url: string }; url?: string }>> = [
    [{ text: "🏆 Турниры" }, { text: "📺 Эфиры" }],
    [webBtn(url, "", "📱 Приложение")],
  ];
  if (admin) rows.push([{ text: "⚙️ Админ-панель" }]);
  return { keyboard: rows, resize_keyboard: true };
}

function adminInline(url: string) {
  return {
    inline_keyboard: [
      [{ text: "📊 Статистика", callback_data: "adm_stats" }, { text: "👥 Пользователи", callback_data: "adm_users" }],
      [{ text: "🏆 Турниры", callback_data: "adm_tournaments" }, { text: "✉️ Сообщения", callback_data: "adm_messages" }],
      [webBtn(url, "/admin", "💻 Админка на сайте")],
    ],
  };
}

function greeting(name?: string, admin = false): string {
  const hi = name ? `Здравствуйте, ${name}!` : "Здравствуйте!";
  return (
    `${hi} Я бот Kumite Arena.\n\n` +
    `Помогу с турнирами и прямыми эфирами.\n\n` +
    `🏆 Турниры — прошедшие и будущие\n` +
    `📺 Эфиры — какие матчи идут сейчас\n` +
    `📱 Приложение — открыть сайт в Telegram` +
    (admin ? `\n\n⚙️ Админ-панель — статистика, пользователи, сообщения` : "")
  );
}

async function tournamentsText(): Promise<string> {
  const now = new Date();
  const upcoming = await prisma.tournament.findMany({
    where: {
      OR: [
        { status: { in: ["LIVE", "REGISTRATION", "READY", "DRAFT"] } },
        { dateStart: { gte: now } },
      ],
    },
    orderBy: { dateStart: "asc" },
    take: 8,
  });
  const past = await prisma.tournament.findMany({
    where: { OR: [{ status: { in: ["FINISHED", "ARCHIVED"] } }, { dateEnd: { lt: now } }] },
    orderBy: { dateEnd: "desc" },
    take: 8,
  });
  const lines: string[] = ["🏆 Турниры Kumite Arena\n"];
  if (upcoming.length) {
    lines.push("Будут / идут:");
    for (const t of upcoming) lines.push(`• ${t.title} — ${fmtDay(t.dateStart)} (${t.status})`);
  } else lines.push("Ближайших турниров пока нет.");
  lines.push("");
  if (past.length) {
    lines.push("Уже прошли:");
    for (const t of past) lines.push(`• ${t.title} — ${fmtDay(t.dateEnd)}`);
  } else lines.push("Прошедших турниров пока нет.");
  return lines.join("\n");
}

async function liveText(): Promise<string> {
  const { items } = await getSportsSchedule();
  const live = items.filter((m) => m.status === "live").slice(0, 10);
  const soon = items.filter((m) => m.status === "upcoming").slice(0, 8);
  const lines: string[] = ["📺 Прямые эфиры\n"];
  if (live.length) {
    lines.push("Сейчас идут:");
    for (const m of live) {
      const score = m.homeScore != null ? ` ${m.homeScore}:${m.awayScore ?? "—"}` : "";
      lines.push(`• ${m.title}${score} — ${m.league} (${m.statusText})`);
    }
  } else lines.push("Прямо сейчас матчей нет.");
  if (soon.length) {
    lines.push("\nСкоро:");
    for (const m of soon) lines.push(`• ${m.title} — ${m.league}`);
  }
  return lines.join("\n");
}

function ymdDushanbe(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dushanbe" });
}

function fmtSeen(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Asia/Dushanbe",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function statsText(): Promise<string> {
  const users = loadUsers();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dushanbe" });
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const todayUsers = users.filter((u) => ymdDushanbe(u.lastSeenAt) === today).length;
  const weekUsers = users.filter((u) => new Date(u.lastSeenAt).getTime() >= weekAgo).length;
  const [tournaments, liveT, finished, participants, clubs, messages, unread, fights] = await Promise.all([
    prisma.tournament.count(),
    prisma.tournament.count({ where: { status: "LIVE" } }),
    prisma.tournament.count({ where: { status: "FINISHED" } }),
    prisma.participant.count(),
    prisma.club.count(),
    prisma.message.count(),
    prisma.message.count({ where: { read: false } }),
    prisma.fight.count(),
  ]);
  return (
    `📊 Админ-панель\n\n` +
    `👥 Пользователи бота: ${users.length}\n` +
    `📅 Сегодня заходили: ${todayUsers}\n` +
    `📆 За 7 дней: ${weekUsers}\n\n` +
    `🏆 Турниры: ${tournaments} (live ${liveT}, завершено ${finished})\n` +
    `🥋 Участники: ${participants}\n` +
    `🏠 Клубы: ${clubs}\n` +
    `⚔️ Бои: ${fights}\n` +
    `✉️ Сообщения: ${messages} (непрочитанных ${unread})`
  );
}

async function usersText(): Promise<string> {
  const all = loadUsers();
  const last = [...all].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)).slice(0, 20);
  const lines = [`👥 Пользователи бота: ${all.length}\n`];
  if (!last.length) lines.push("Пока никто не писал боту.");
  for (const u of last) {
    const name = [u.firstName, u.username ? `@${u.username}` : ""].filter(Boolean).join(" ");
    lines.push(`• ${name || u.telegramId} — ${fmtSeen(u.lastSeenAt)}`);
  }
  return lines.join("\n");
}

async function messagesText(): Promise<string> {
  const items = await prisma.message.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
  if (!items.length) return "✉️ Сообщений с сайта пока нет.";
  const lines = ["✉️ Последние сообщения с сайта:\n"];
  for (const m of items) {
    const flag = m.read ? "" : "🆕 ";
    lines.push(`${flag}${m.firstName} ${m.lastName} — ${m.body.slice(0, 120)}`);
  }
  return lines.join("\n");
}

function intent(text: string): "start" | "tournaments" | "live" | "app" | "admin" | "unknown" {
  const t = text.toLowerCase().replace(/^\//, "").trim();
  if (t.startsWith("admin") || t.includes("админ") || t.includes("статистик") || t.includes("панел")) return "admin";
  if (t.startsWith("start") || t.includes("привет") || t.includes("здравств") || t.includes("салом")) return "start";
  if (t.startsWith("tournament") || t.includes("турнир") || t.includes("мусобик") || t.includes("🏆")) return "tournaments";
  if (t.startsWith("live") || t.includes("эфир") || t.includes("матч") || t.includes("футбол") || t.includes("📺")) return "live";
  if (t.startsWith("app") || t.includes("прилож") || t.includes("сайт") || t.includes("📱")) return "app";
  return "unknown";
}

export async function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.log("Telegram: нет TELEGRAM_BOT_TOKEN — бот не запущен.");
    return;
  }

  const url = appUrl();
  let me: TgResponse = { ok: false };
  for (let i = 0; i < 5; i++) {
    try {
      me = await tg(token, "getMe", {});
      if (me.ok) break;
    } catch (e) {
      console.warn(`Telegram getMe попытка ${i + 1}/5:`, e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  if (!me.ok) {
    console.warn("Telegram: токен не принят —", me.description);
    return;
  }
  const username = (me.result as { username?: string } | undefined)?.username || "bot";

  await tg(token, "deleteWebhook", { drop_pending_updates: true });
  await tg(token, "setMyCommands", {
    commands: [
      { command: "start", description: "Приветствие" },
      { command: "tournaments", description: "Турниры" },
      { command: "live", description: "Прямые эфиры" },
      { command: "app", description: "Мини-приложение" },
    ],
  });
  const admin = adminId();
  if (admin) {
    await tg(token, "setMyCommands", {
      commands: [
        { command: "start", description: "Приветствие" },
        { command: "tournaments", description: "Турниры" },
        { command: "live", description: "Прямые эфиры" },
        { command: "app", description: "Мини-приложение" },
        { command: "admin", description: "Админ-панель" },
      ],
      scope: { type: "chat", chat_id: Number(admin) || admin },
    });
  }

  if (url.startsWith("https://")) {
    await tg(token, "setChatMenuButton", {
      menu_button: { type: "web_app", text: "Приложение", web_app: { url } },
    });
  }

  console.log(`Telegram bot @${username} запущен. Mini App: ${url}`);

  const send = async (chatId: number, text: string, extra: Record<string, unknown> = {}) => {
    await tg(token, "sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: extra.reply_markup ?? userKeyboard(url, isAdmin(chatId)),
      ...extra,
    });
  };

  const handleAdmin = async (chatId: number) => {
    if (!isAdmin(chatId)) {
      await send(chatId, "Эта команда только для администратора.");
      return;
    }
    await send(chatId, await statsText(), { reply_markup: adminInline(url) });
  };

  let offset = 0;
  const poll = async () => {
    try {
      const data = await tg(token, "getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"],
      });
      const updates = Array.isArray(data.result) ? (data.result as TgUpdate[]) : [];
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.callback_query) {
          const cb = u.callback_query;
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
          const chatId = cb.message?.chat.id || cb.from.id;
          await touchUser(cb.from);
          if (!isAdmin(chatId)) continue;
          if (cb.data === "adm_stats") await send(chatId, await statsText(), { reply_markup: adminInline(url) });
          else if (cb.data === "adm_users") await send(chatId, await usersText(), { reply_markup: adminInline(url) });
          else if (cb.data === "adm_tournaments") await send(chatId, await tournamentsText(), { reply_markup: adminInline(url) });
          else if (cb.data === "adm_messages") await send(chatId, await messagesText(), { reply_markup: adminInline(url) });
          continue;
        }
        const msg = u.message;
        if (!msg?.chat?.id || !msg.text) continue;
        await touchUser(msg.from);
        const kind = intent(msg.text);
        const chatId = msg.chat.id;
        const name = msg.from?.first_name;
        const kb = userKeyboard(url, isAdmin(chatId));
        if (kind === "tournaments") await send(chatId, await tournamentsText(), { reply_markup: kb });
        else if (kind === "live") await send(chatId, await liveText(), { reply_markup: { inline_keyboard: [[webBtn(url, "/live", "Смотреть Live")]] } });
        else if (kind === "app") await send(chatId, "Откройте Kumite Arena:", { reply_markup: { inline_keyboard: [[webBtn(url)]] } });
        else if (kind === "admin") await handleAdmin(chatId);
        else await send(chatId, greeting(name, isAdmin(chatId)), { reply_markup: kb });
      }
    } catch (e) {
      console.warn("Telegram poll error", e);
      await new Promise((r) => setTimeout(r, 3000));
    }
    setImmediate(poll);
  };
  void poll();
}
