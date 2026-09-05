import { useCallback, useEffect, useState } from "react";
import { NavLink, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CategoryApi, DrawApi, FightApi, MiscApi, ParticipantApi, ResultsApi, TournamentApi,
} from "../services/endpoints";
import type { Bracket, Category, Club, Fight, Participant, ResultRow, Tournament } from "../types";
import { fmtDate } from "../utils";
import { EmptyState, Loading, Pagination, SearchBar } from "../components/Ui";
import { ParticipantTable } from "../components/ParticipantTable";
import { DrawBracket } from "../components/DrawBracket";
import { FightControl } from "../components/FightControl";
import { useTournamentSocket } from "../hooks/useTournamentSocket";
import { useAuth } from "../hooks/useAuth";
import { CategoryPick } from "../components/CategoryPick";
import { mediaUrl } from "../lib/config";

const TABS = ["info", "live", "participants", "draws", "results", "officials", "videos"] as const;

export function TournamentPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();
  const loc = useLocation();
  const pathTab = loc.pathname.endsWith("/live")
    ? "live"
    : loc.pathname.endsWith("/participants")
      ? "participants"
      : loc.pathname.endsWith("/results")
        ? "results"
        : null;
  const tab = (pathTab || (sp.get("tab") as typeof TABS[number]) || "info") as typeof TABS[number];
  const [item, setItem] = useState<Tournament | null>(null);

  const load = useCallback(() => {
    TournamentApi.get(id).then((r) => setItem(r.data.item));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useTournamentSocket(id, useCallback(() => { load(); }, [load]));

  if (!item) return <Loading />;

  return (
    <div>
      <div className="t-bar">
        <span>{item.title}</span>
        <span>{fmtDate(item.dateStart)}</span>
      </div>
      <nav className="t-tabs">
        {TABS.map((key) => (
          <NavLink
            key={key}
            to={key === "info" ? `/tournament/${id}` : `/tournament/${id}?tab=${key}`}
            className={() => (tab === key ? "active" : "")}
          >
            {t(`t.${key}`)}
          </NavLink>
        ))}
      </nav>
      {tab === "info" && <Info t={item} />}
      {tab === "live" && <Live id={id} />}
      {tab === "participants" && <Parts id={id} />}
      {tab === "draws" && <Draws id={id} />}
      {tab === "results" && <Results id={id} />}
      {tab === "officials" && <Officials id={id} />}
      {tab === "videos" && <Videos id={id} />}
    </div>
  );
}

function Info({ t: item }: { t: Tournament }) {
  const { t } = useTranslation();
  const sameDay = item.dateStart.slice(0, 10) === item.dateEnd.slice(0, 10);
  const date = sameDay ? fmtDate(item.dateStart) : `${fmtDate(item.dateStart)} — ${fmtDate(item.dateEnd)}`;
  const time = [item.timeStart, item.timeEnd].filter(Boolean).join(" — ") || "—";
  const place = [item.city, item.country?.nameRu].filter(Boolean).join(", ");
  const facts: [string, string][] = [
    [t("t.status"), item.status],
    [t("t.date"), date],
    [t("t.time"), time],
    [t("t.country"), item.country?.nameRu || ""],
    [t("t.city"), item.city || ""],
    [t("t.address"), item.address || ""],
    [t("t.venue"), item.venue || ""],
    [t("t.organizer"), item.organizer || ""],
    [t("t.email"), item.email || ""],
    [t("t.phone"), item.phone || ""],
  ].filter(([k, v]) => v && (k === t("t.status") || k === t("t.date") || v !== "—"));
  const notes: [string, string][] = [
    [t("t.description"), item.description || ""],
    [t("t.rules"), item.rules || ""],
    [t("t.regulations"), item.regulations || ""],
    [t("t.registration"), item.registrationInfo || ""],
  ].filter(([, v]) => v.trim());
  return (
    <div className="container info-wrap">
      {item.imageUrl && <img className="info-cover" src={mediaUrl(item.imageUrl)} alt="" />}
      <article className="info-sheet">
        <header className="info-head">
          <span className={`status-pill ${item.status}`}>{item.status}</span>
          <div className="info-head-meta">
            <span>{date}</span>
            {place && <span>{place}</span>}
            {item.venue && <span>{item.venue}</span>}
          </div>
        </header>
        <dl className="info-dl">
          {facts.map(([k, v]) => (
            <div className="info-row" key={k}>
              <dt>{k}</dt>
              <dd>{k === t("t.status") ? <span className={`status-pill ${item.status}`}>{v}</span> : v}</dd>
            </div>
          ))}
        </dl>
        {notes.map(([k, v]) => (
          <section className="info-note" key={k}>
            <h3>{k}</h3>
            <p>{v}</p>
          </section>
        ))}
      </article>
    </div>
  );
}

function Live({ id }: { id: string }) {
  const { t } = useTranslation();
  const [boards, setBoards] = useState<Array<{ tatami: { id: string; name: string }; current: Fight | null; next: Fight | null; upcoming: Fight[] }>>([]);
  const load = useCallback(() => { MiscApi.live(id).then((r) => setBoards(r.data.boards)); }, [id]);
  useEffect(() => { load(); }, [load]);
  useTournamentSocket(id, load);
  if (!boards.length) return <EmptyState text={t("empty.generic")} />;
  return (
    <div className="container live-grid">
      {boards.map((b) => (
        <article key={b.tatami.id} className="tatami-card">
          <h3>{b.tatami.name}</h3>
          <p><strong>{t("live.current")}:</strong> {b.current ? `#${b.current.fightNumber} ${b.current.status}` : "—"}</p>
          <p><strong>{t("live.next")}:</strong> {b.next ? `#${b.next.fightNumber}` : "—"}</p>
          <ul>
            {b.upcoming.map((f) => <li key={f.id}>#{f.fightNumber} {f.category?.name} · {f.status}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

function Parts({ id }: { id: string }) {
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();
  const [items, setItems] = useState<Participant[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [sub, setSub] = useState<"p" | "c">("p");
  const clubId = sp.get("club") || "";
  const categoryId = sp.get("category") || "";
  const q = sp.get("q") || "";
  const page = Number(sp.get("page") || 1);
  const pageSize = Number(sp.get("pageSize") || 50);

  const load = useCallback(() => {
    ParticipantApi.list(id, { clubId, categoryId, q, page, pageSize }).then((r) => {
      setItems(r.data.items);
      setTotal(r.data.total);
      setClubs(r.data.clubs);
    });
    CategoryApi.list(id).then((r) => setCats(r.data.items));
  }, [id, clubId, categoryId, q, page, pageSize]);

  useEffect(() => {
    const tmr = setTimeout(load, 250);
    return () => clearTimeout(tmr);
  }, [load]);

  function patch(n: Record<string, string>) {
    const next = new URLSearchParams(sp);
    Object.entries(n).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!n.page) next.delete("page");
    setSp(next);
  }

  return (
    <div className="part-layout">
      <aside className="club-list">
        <button className={!clubId ? "active" : ""} onClick={() => patch({ club: "" })}>{t("common.all")}</button>
        {clubs.map((c) => (
          <button key={c.id} className={clubId === c.id ? "active" : ""} onClick={() => patch({ club: c.id })}>
            <span>{c.name}</span>
            <span>{c._count?.participants ?? 0}</span>
          </button>
        ))}
      </aside>
      <div>
        <div className="subtabs">
          <button className={sub === "p" ? "active" : ""} onClick={() => setSub("p")}>{t("t.participants")}</button>
          <button className={sub === "c" ? "active" : ""} onClick={() => setSub("c")}>{t("t.categories")}</button>
        </div>
        {sub === "c" ? (
          cats.length === 0 ? <EmptyState text={t("empty.categories")} /> : (
            <table className="data"><tbody>{cats.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c._count?.participants ?? 0}</td></tr>)}</tbody></table>
          )
        ) : (
          <>
            <div className="filter-bar">
              <select value={categoryId} onChange={(e) => patch({ category: e.target.value })}>
                <option value="">{t("p.category")}</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <SearchBar value={q} onChange={(v) => patch({ q: v })} placeholder={t("p.search")} />
            </div>
            {items.length === 0 ? <EmptyState text={t("p.empty")} /> : (
              <>
                <ParticipantTable items={items} total={total} />
                <Pagination page={page} pageSize={pageSize} total={total} onChange={(p, s) => patch({ page: String(p), pageSize: String(s) })} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Draws({ id }: { id: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [draws, setDraws] = useState<Bracket[]>([]);
  const [active, setActive] = useState<Bracket | null>(null);
  const [fight, setFight] = useState<Fight | null>(null);

  const load = useCallback(() => {
    DrawApi.list(id).then((r) => {
      setDraws(r.data.items);
      setActive((cur) => r.data.items.find((d) => d.id === cur?.id) || r.data.items[0] || null);
    });
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useTournamentSocket(id, load);

  if (!draws.length) return <EmptyState text={t("draw.empty")} />;
  return (
    <div className="container" style={{ paddingBottom: 40 }}>
      <div className="draw-bar">
        <CategoryPick
          label={t("draw.pickCategory")}
          items={draws.map((d) => ({ id: d.id, name: d.category.name }))}
          activeId={active?.id}
          onPick={(did) => setActive(draws.find((d) => d.id === did) || null)}
        />
        {active && (
          <NavLink className="btn btn-ghost" to={`/tournament/${id}/draws/${active.id}`}>{t("draw.open")}</NavLink>
        )}
      </div>
      {active && (
        <DrawBracket
          fights={active.fights}
          admin={Boolean(user)}
          onOpenFight={setFight}
          onConfirmWinner={async (fightId, winnerId, confirmChange) => {
            await FightApi.result(fightId, { winnerId, confirmChange });
            load();
          }}
        />
      )}
      {fight && <FightControl fight={fight} admin={Boolean(user)} onClose={() => setFight(null)} onChanged={() => { setFight(null); load(); }} />}
    </div>
  );
}

function Results({ id }: { id: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ResultRow[]>([]);
  const [catId, setCatId] = useState("");
  const load = useCallback(() => { ResultsApi.list(id).then((r) => setItems(r.data.items)); }, [id]);
  useEffect(() => { load(); }, [load]);
  useTournamentSocket(id, load);
  const byCat = new Map<string, ResultRow[]>();
  items.forEach((r) => {
    const arr = byCat.get(r.category.id) ?? [];
    arr.push(r);
    byCat.set(r.category.id, arr);
  });
  const cats = [...byCat.entries()].map(([cid, rows]) => ({ id: cid, name: rows[0].category.name }));
  const activeId = cats.some((c) => c.id === catId) ? catId : (cats[0]?.id || "");
  const rows = activeId ? (byCat.get(activeId) || []) : [];
  return (
    <div className="container results-page">
      {items.length === 0 ? <EmptyState text={t("results.empty")} /> : (
        <>
          <div className="draw-bar">
            <CategoryPick
              label={t("results.pickCategory")}
              items={cats}
              activeId={activeId}
              onPick={setCatId}
            />
          </div>
          {rows.length > 0 && (
            <section className="cat-results">
              <Podium rows={rows} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Podium({ rows }: { rows: ResultRow[] }) {
  const { t } = useTranslation();
  const sorted = [...rows].sort((a, b) => a.place - b.place);
  const pick = (medal: "GOLD" | "SILVER" | "BRONZE", place: number) =>
    sorted.find((r) => r.medal === medal) || sorted.find((r) => r.place === place);
  const gold = pick("GOLD", 1);
  const silver = pick("SILVER", 2);
  const bronze = pick("BRONZE", 3);
  const used = new Set([gold?.id, silver?.id, bronze?.id].filter(Boolean));
  const rest = sorted.filter((r) => !used.has(r.id));
  return (
    <>
      <div className="podium">
        {silver && <PodiumSpot row={silver} kind="SILVER" cup="🥈" label={t("results.silver")} />}
        {gold && <PodiumSpot row={gold} kind="GOLD" cup="🏆" label={t("results.gold")} />}
        {bronze && <PodiumSpot row={bronze} kind="BRONZE" cup="🥉" label={t("results.bronze")} />}
      </div>
      {rest.length > 0 && (
        <ol className="podium-rest">
          {rest.map((r) => (
            <li key={r.id}>
              <span className="place">{r.place}</span>
              {r.participant.photoUrl ? <img src={mediaUrl(r.participant.photoUrl)} alt="" /> : <div className="avatar" />}
              <div>
                <strong>{r.participant.firstName} {r.participant.lastName}</strong>
                <div className="flag">{r.participant.country?.flag} {r.participant.club?.name}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function PodiumSpot({ row, kind, cup, label }: { row: ResultRow; kind: "GOLD" | "SILVER" | "BRONZE"; cup: string; label: string }) {
  const p = row.participant;
  return (
    <article className={`podium-spot ${kind}`}>
      <div className="podium-cup">{cup}</div>
      {p.photoUrl ? <img src={mediaUrl(p.photoUrl)} alt="" /> : <div className="avatar podium-ava" />}
      <strong>{p.firstName} {p.lastName}</strong>
      <span className="podium-meta">{p.country?.flag} {p.club?.name || p.country?.code}</span>
      <div className="podium-step">
        <b>{row.place}</b>
        <em>{label}</em>
      </div>
    </article>
  );
}

function Officials({ id }: { id: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Array<{ id: string; firstName: string; lastName: string; role: string; photoUrl?: string; country?: { flag: string } }>>([]);
  useEffect(() => { MiscApi.officials(id).then((r) => setItems(r.data.items)); }, [id]);
  if (!items.length) return <EmptyState text={t("empty.generic")} />;
  return (
    <div className="container" style={{ padding: "24px 0" }}>
      <div className="t-grid">
        {items.map((o) => (
          <article key={o.id} className="feature-card">
            {o.photoUrl && <img src={mediaUrl(o.photoUrl)} alt="" style={{ height: 120, objectFit: "cover" }} />}
            <h3>{o.firstName} {o.lastName}</h3>
            <p>{o.country?.flag} {o.role}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function Videos({ id }: { id: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Array<{ id: string; title: string; youtubeUrl: string; description?: string }>>([]);
  useEffect(() => { MiscApi.videos(id).then((r) => setItems(r.data.items)); }, [id]);
  if (!items.length) return <EmptyState text={t("empty.generic")} />;
  return (
    <div className="container" style={{ padding: "24px 0" }}>
      {items.map((v) => {
        const m = v.youtubeUrl.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
        return (
          <article key={v.id} style={{ marginBottom: 24 }}>
            <h3>{v.title}</h3>
            {m && <iframe title={v.title} width="100%" height="400" src={`https://www.youtube.com/embed/${m[1]}`} allowFullScreen />}
            <p>{v.description}</p>
          </article>
        );
      })}
    </div>
  );
}
