import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MiscApi } from "../services/endpoints";

type Sport = "all" | "football" | "basketball" | "tennis" | "ufc" | "f1" | "hockey" | "other";
type When = "live" | "today" | "week" | "finished";

type Match = {
  id: string;
  sport: Exclude<Sport, "all">;
  league: string;
  title: string;
  home: string;
  away: string;
  homeBadge: string | null;
  awayBadge: string | null;
  homeScore: string | null;
  awayScore: string | null;
  status: "live" | "upcoming" | "finished";
  statusText: string;
  minute: number | null;
  duration: number;
  kickoff: string | null;
  date: string;
  watch: { youtubeLive: string; yandexSport: string; matchtv: string; twitch: string };
};

const SPORTS: Sport[] = ["all", "football", "basketball", "tennis", "ufc", "f1", "hockey", "other"];
const WHENS: When[] = ["live", "today", "week", "finished"];
const TZ = "Asia/Dushanbe";

function todayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function formatWhen(iso: string | null, date: string, fallback: string) {
  const d = iso ? new Date(iso) : new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString("ru-RU", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function barPct(m: Match): number {
  if (m.status !== "live") return 0;
  const dur = m.duration || 90;
  const min = m.minute ?? Math.round(dur * 0.45);
  return Math.max(8, Math.min(100, Math.round((min / dur) * 100)));
}

function ClubLogo({ src }: { src: string | null }) {
  return (
    <span className="club-logo">
      {src ? <img src={src} alt="" width={22} height={22} /> : <span className="badge-ph" />}
    </span>
  );
}

export function LiveSportsPage() {
  const { t } = useTranslation();
  const [sport, setSport] = useState<Sport>("all");
  const [pickedWhen, setWhen] = useState<When | null>(null);
  const [items, setItems] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const r = await MiscApi.sportsLive();
      setItems((r.data as { items: Match[] }).items || []);
    } catch {
      setErr(t("sportsLive.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const today = todayYmd();
  const counts = useMemo(() => {
    const pool = sport === "all" ? items : items.filter((m) => m.sport === sport);
    return {
      live: pool.filter((m) => m.status === "live").length,
      today: pool.filter((m) => m.date === today && m.status !== "finished").length,
      week: pool.filter((m) => m.status !== "finished").length,
      finished: pool.filter((m) => m.status === "finished").length,
    };
  }, [items, sport, today]);

  const when: When = pickedWhen ?? (counts.live > 0 ? "live" : "today");

  const visible = useMemo(() => {
    const pool = sport === "all" ? items : items.filter((m) => m.sport === sport);
    if (when === "live") return pool.filter((m) => m.status === "live");
    if (when === "today") return pool.filter((m) => m.date === today && m.status !== "finished");
    if (when === "finished") return pool.filter((m) => m.status === "finished").slice(0, 40);
    return pool.filter((m) => m.status !== "finished");
  }, [items, sport, when, today]);

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of visible) {
      const key = m.date || "—";
      const arr = map.get(key) || [];
      arr.push(m);
      map.set(key, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  return (
    <div className="live-page">
      <section className="live-hero">
        <div className="live-hero-inner">
          <div className="live-kicker"><i /> Live</div>
          <h1>{t("sportsLive.title")}</h1>
          <p>{t("sportsLive.lead")}</p>
          <div className="live-hubs">
            <a className="hub-card yandex" href="https://sport.yandex.ru/football/broadcast/" target="_blank" rel="noreferrer">
              <span>{t("sportsLive.watch")}</span>
              <strong>{t("sportsLive.hubYandex")}</strong>
            </a>
            <a className="hub-card matchtv" href="https://matchtv.ru/on-air" target="_blank" rel="noreferrer">
              <span>{t("sportsLive.watch")}</span>
              <strong>{t("sportsLive.hubMatchtv")}</strong>
            </a>
            <a className="hub-card youtube" href="https://www.youtube.com/results?search_query=sports+live&sp=EgJAAQ%253D%253D" target="_blank" rel="noreferrer">
              <span>{t("sportsLive.watch")}</span>
              <strong>{t("sportsLive.hubYoutube")}</strong>
            </a>
            <a className="hub-card twitch" href="https://www.twitch.tv/directory/category/sports" target="_blank" rel="noreferrer">
              <span>{t("sportsLive.watch")}</span>
              <strong>{t("sportsLive.hubTwitch")}</strong>
            </a>
          </div>
        </div>
      </section>

      <div className="live-body">
        <div className="live-panel">
          <div className="seg">
            {SPORTS.map((f) => (
              <button key={f} className={sport === f ? "active" : ""} onClick={() => setSport(f)}>
                {t(`sportsLive.${f}`)}
              </button>
            ))}
          </div>
          <div className="seg">
            {WHENS.map((w) => (
              <button key={w} className={when === w ? "active" : ""} onClick={() => setWhen(w)}>
                {t(`sportsLive.${w}`)} · {counts[w]}
              </button>
            ))}
          </div>
        </div>

      {loading && <p style={{ textAlign: "center", color: "#757575" }}>{t("sportsLive.loading")}</p>}
      {err && <p className="err" style={{ textAlign: "center" }}>{err}</p>}
      {!loading && visible.length === 0 && <p style={{ textAlign: "center", color: "#757575" }}>{t("sportsLive.empty")}</p>}

      {grouped.map(([date, list]) => (
        <section key={date} className="match-day">
          <h2>{new Date(`${date}T12:00:00Z`).toLocaleDateString("ru-RU", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" })}</h2>
          <div className="match-list">
            {list.map((m) => (
              <article key={m.id} className={`match-card ${m.status}`}>
                <div className="match-meta">
                  <span className="match-league">{m.league}</span>
                  <span className={`match-status ${m.status}`}>
                    {m.status === "live" ? `${t("sportsLive.now")} ${m.statusText}` : m.status === "finished" ? m.statusText : formatWhen(m.kickoff, m.date, m.statusText)}
                  </span>
                </div>
                <div className="match-teams">
                  {m.away ? (
                    <>
                      <div className="match-team">
                        <ClubLogo src={m.homeBadge} />
                        <strong>{m.home}</strong>
                      </div>
                      <div className="match-score">
                        {m.status === "upcoming" || (!m.homeScore && !m.awayScore)
                          ? "vs"
                          : `${m.homeScore ?? "—"} : ${m.awayScore ?? "—"}`}
                      </div>
                      <div className="match-team right">
                        <strong>{m.away}</strong>
                        <ClubLogo src={m.awayBadge} />
                      </div>
                    </>
                  ) : (
                    <div className="match-team" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
                      <strong>{m.title}</strong>
                    </div>
                  )}
                </div>
                {m.status === "live" && (
                  <div className="match-bar" aria-hidden>
                    <span className="match-bar-fill" style={{ width: `${barPct(m)}%` }} />
                  </div>
                )}
                <div className="watch-links">
                  <a href={m.watch.youtubeLive} target="_blank" rel="noreferrer">{t("sportsLive.watchYoutube")}</a>
                  <a href={m.watch.yandexSport} target="_blank" rel="noreferrer">{t("sportsLive.watchYandexSport")}</a>
                  <a href={m.watch.matchtv} target="_blank" rel="noreferrer">{t("sportsLive.watchMatchtv")}</a>
                  <a href={m.watch.twitch} target="_blank" rel="noreferrer">{t("sportsLive.watchTwitch")}</a>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      <p className="live-note">{t("sportsLive.note")}</p>
      </div>
    </div>
  );
}
