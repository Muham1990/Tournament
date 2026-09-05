export type SportKey = "football" | "basketball" | "tennis" | "ufc" | "boxing" | "f1" | "hockey" | "other";
export type MatchStatus = "live" | "upcoming" | "finished";

export type SportsMatch = {
  id: string;
  sport: SportKey;
  league: string;
  leagueId: string;
  title: string;
  home: string;
  away: string;
  homeBadge: string | null;
  awayBadge: string | null;
  homeScore: string | null;
  awayScore: string | null;
  status: MatchStatus;
  statusText: string;
  minute: number | null;
  duration: number;
  kickoff: string | null;
  date: string;
  watch: { youtubeLive: string; yandexSport: string; matchtv: string; twitch: string };
};

type CacheBox = { at: number; items: SportsMatch[] };
let cache: CacheBox | null = null;
const CACHE_MS = 2 * 60 * 1000;

const SPORT_FROM_TSDB: Record<string, SportKey> = {
  Soccer: "football",
  Basketball: "basketball",
  Tennis: "tennis",
  Fighting: "ufc",
  Boxing: "boxing",
  Motorsport: "f1",
  "Ice Hockey": "hockey",
  "American Football": "other",
  Volleyball: "other",
  Baseball: "other",
  Rugby: "other",
  Cricket: "other",
  Golf: "other",
};

const PRIORITY_LEAGUES = new Set([
  "4328", "4335", "4331", "4332", "4334", "4480", "4481", "4482",
  "4346", "4399", "4401", "4422", "4338", "4456", "4502", "4351", "5193",
  "4387", "4388", "4516", "4549", "4443", "4370", "4464", "4465", "4380",
]);

const NEXT_LEAGUES = [
  "4328", "4335", "4331", "4332", "4334", "4480", "4481",
  "4387", "4516", "4443", "4370", "4464",
];

const LIVE_SPORTS = ["Soccer", "Basketball", "Fighting"] as const;
const DAY_SPORTS = ["Soccer", "Basketball"] as const;

function key(): string {
  return process.env.THESPORTSDB_KEY || "3";
}

function base(): string {
  return `https://www.thesportsdb.com/api/v1/json/${key()}`;
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "KumiteArena/1.0 (sports schedule)",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function asList(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function classifyStatus(status: string, progress: string): { kind: MatchStatus; text: string } {
  const s = status.toUpperCase();
  const live = new Set(["1H", "2H", "HT", "ET", "P", "BT", "LIVE", "Q1", "Q2", "Q3", "Q4", "OT", "INT", "IN"]);
  const done = new Set(["FT", "AET", "PEN", "CANC", "PST", "ABD", "AWD", "WO"]);
  if (live.has(s)) {
    if (s === "HT") return { kind: "live", text: "HT" };
    if (progress && /^\d/.test(progress)) return { kind: "live", text: `${progress}'` };
    return { kind: "live", text: s };
  }
  if (done.has(s)) return { kind: "finished", text: s === "FT" ? "FT" : s };
  return { kind: "upcoming", text: status || "NS" };
}

function durationFor(sport: SportKey): number {
  if (sport === "basketball") return 40;
  if (sport === "hockey") return 60;
  if (sport === "tennis") return 100;
  if (sport === "ufc" || sport === "boxing") return 25;
  if (sport === "f1") return 120;
  return 90;
}

function minuteFrom(status: string, progress: string): number | null {
  const s = status.toUpperCase();
  if (s === "HT") return 45;
  const n = Number.parseInt(progress, 10);
  return Number.isFinite(n) ? n : null;
}

function watchLinks(query: string, sport: SportKey) {
  const yt = encodeURIComponent(`${query} live`);
  const hubs: Record<SportKey, string> = {
    football: "https://sport.yandex.ru/football/broadcast/",
    basketball: "https://sport.yandex.ru/basketball/",
    tennis: "https://sport.yandex.ru/tennis/",
    hockey: "https://sport.yandex.ru/hockey/",
    ufc: "https://sport.yandex.ru/",
    boxing: "https://sport.yandex.ru/",
    f1: "https://sport.yandex.ru/",
    other: "https://sport.yandex.ru/",
  };
  return {
    youtubeLive: `https://www.youtube.com/results?search_query=${yt}&sp=EgJAAQ%253D%253D`,
    yandexSport: hubs[sport],
    matchtv: "https://matchtv.ru/on-air",
    twitch: `https://www.twitch.tv/search?term=${encodeURIComponent(query)}`,
  };
}

function mapEvent(row: Record<string, unknown>): SportsMatch | null {
  const sportRaw = str(row.strSport);
  const sport = SPORT_FROM_TSDB[sportRaw] || "other";
  const home = str(row.strHomeTeam);
  const away = str(row.strAwayTeam);
  const eventName = str(row.strEvent);
  if (!home && !away && !eventName) return null;
  const title = home && away ? `${home} — ${away}` : eventName || `${home} ${away}`.trim();
  const statusRaw = str(row.strStatus);
  const progress = str(row.strProgress);
  const { kind, text } = classifyStatus(statusRaw, progress);
  const date = str(row.dateEvent) || (str(row.strTimestamp).slice(0, 10));
  if (!date) return null;
  const time = str(row.strEventTime) || str(row.strTime).slice(0, 5);
  const kickoff = str(row.strTimestamp) || (date && time ? `${date}T${time}:00Z` : null);
  const statusText = kind === "upcoming" && time ? time : text;
  const query = home && away ? `${home} ${away}` : title;
  const duration = durationFor(sport);
  return {
    id: str(row.idEvent) || str(row.idLiveScore) || `${title}-${date}-${time}`,
    sport,
    league: str(row.strLeague) || sportRaw,
    leagueId: str(row.idLeague),
    title,
    home: home || title,
    away,
    homeBadge: str(row.strHomeTeamBadge) || null,
    awayBadge: str(row.strAwayTeamBadge) || null,
    homeScore: str(row.intHomeScore) || null,
    awayScore: str(row.intAwayScore) || null,
    status: kind,
    statusText,
    minute: kind === "live" ? minuteFrom(statusRaw, progress) : null,
    duration,
    kickoff,
    date,
    watch: watchLinks(query, sport),
  };
}

function weekDates(): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = 0; i < 7; i++) {
    out.push(new Date(now + i * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Dushanbe" }));
  }
  return out;
}

function rank(m: SportsMatch): number {
  let n = 0;
  if (m.status === "live") n += 300;
  else if (m.status === "upcoming") n += 100;
  if (PRIORITY_LEAGUES.has(m.leagueId)) n += 80;
  const t = m.kickoff ? Date.parse(m.kickoff) : 0;
  return n * 10_000_000_000 - (Number.isFinite(t) ? t : 0);
}

function merge(items: SportsMatch[]): SportsMatch[] {
  const map = new Map<string, SportsMatch>();
  for (const it of items) {
    const prev = map.get(it.id);
    if (!prev) {
      map.set(it.id, it);
      continue;
    }
    if (it.status === "live" && prev.status !== "live") map.set(it.id, it);
    else if (it.homeScore && !prev.homeScore) map.set(it.id, { ...prev, ...it });
  }
  return [...map.values()].sort((a, b) => rank(b) - rank(a));
}

async function loadFresh(): Promise<SportsMatch[]> {
  const urls: string[] = [];
  for (const s of LIVE_SPORTS) urls.push(`${base()}/livescore.php?s=${encodeURIComponent(s)}`);
  for (const id of NEXT_LEAGUES) urls.push(`${base()}/eventsnextleague.php?id=${id}`);
  const days = weekDates();
  for (const day of days) {
    for (const s of DAY_SPORTS) {
      urls.push(`${base()}/eventsday.php?d=${day}&s=${encodeURIComponent(s)}`);
    }
  }

  const collected: SportsMatch[] = [];
  const batchSize = 6;
  for (let i = 0; i < urls.length; i += batchSize) {
    const chunk = urls.slice(i, i + batchSize);
    const rows = await Promise.all(chunk.map((u) => getJson(u)));
    for (const json of rows) {
      if (!json) continue;
      const list = [
        ...asList(json.livescore),
        ...asList(json.events),
        ...asList(json.event),
      ];
      for (const row of list) {
        const mapped = mapEvent(row);
        if (mapped) collected.push(mapped);
      }
    }
    if (i + batchSize < urls.length) await new Promise((r) => setTimeout(r, 150));
  }
  return merge(collected);
}

export async function getSportsSchedule(): Promise<{ items: SportsMatch[]; updatedAt: string; source: string }> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { items: cache.items, updatedAt: new Date(cache.at).toISOString(), source: "thesportsdb" };
  }
  const items = await loadFresh();
  cache = { at: Date.now(), items };
  return { items, updatedAt: new Date(cache.at).toISOString(), source: "thesportsdb" };
}
