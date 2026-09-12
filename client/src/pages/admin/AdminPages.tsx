import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AuthApi, CategoryApi, ClubApi, CountryApi, DrawApi, FightApi, MiscApi, ParticipantApi, ResultsApi, TournamentApi,
} from "../../services/endpoints";
import { asForm } from "../../services/api";
import type { Bracket, Category, Club, Country, Fight, Participant, Tournament } from "../../types";
import { EmptyState, Modal } from "../../components/Ui";
import { ParticipantModal, CategoryModal } from "../../components/ParticipantModal";
import { ParticipantTable } from "../../components/ParticipantTable";
import { DrawBracket } from "../../components/DrawBracket";
import { FightControl } from "../../components/FightControl";
import { TournamentVoiceFill } from "../../components/AiFeatures";
import { fmtDate } from "../../utils";
import { useToast } from "../../hooks/useToast";
import { useTournamentSocket } from "../../hooks/useTournamentSocket";
import { mediaUrl } from "../../lib/config";

export function AdminDashboard() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [s, setS] = useState<Record<string, number>>({});
  useEffect(() => { MiscApi.dashboard().then((r) => setS(r.data as Record<string, number>)).catch(() => undefined); }, []);
  const cards = [
    ["tournaments", t("admin.tournaments")],
    ["live", t("status.LIVE")],
    ["finished", t("status.FINISHED")],
    ["participants", t("admin.participants")],
    ["categories", t("admin.categories")],
    ["fights", t("admin.fights")],
    ["finishedFights", t("draw.winner")],
    ["upcomingFights", t("live.next")],
  ] as const;
  return (
    <div>
      <h2>{t("admin.dashboard")}</h2>
      <div className="chip-row">
        <button className="btn" onClick={() => nav("/admin/tournaments/new")}>{t("admin.createTournament")}</button>
        <button className="chip" onClick={() => nav("/admin/tournaments")}>{t("admin.participants")}</button>
        <button className="chip" onClick={() => nav("/admin/tournaments")}>{t("admin.categories")}</button>
        <button className="chip" onClick={() => nav("/admin/tournaments")}>{t("admin.draws")}</button>
        <button className="chip" onClick={() => nav("/admin/tournaments")}>{t("admin.fights")}</button>
        <button className="chip" onClick={() => nav("/admin/tournaments")}>{t("admin.results")}</button>
      </div>
      <div className="stat-grid">
        {cards.map(([k, l]) => (
          <div className="stat" key={k}><div className="n">{s[k] ?? 0}</div><div className="l">{l}</div></div>
        ))}
      </div>
    </div>
  );
}

export function AdminTournaments() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [items, setItems] = useState<Tournament[]>([]);
  const load = () => TournamentApi.list({ when: "all" }).then((r) => setItems(r.data.items)).catch(() => setItems([]));
  useEffect(() => { void load(); }, []);
  return (
    <div>
      <div className="btn-row" style={{ justifyContent: "space-between" }}>
        <h2>{t("admin.tournaments")}</h2>
        <button className="btn" onClick={() => nav("/admin/tournaments/new")}>{t("admin.createTournament")}</button>
      </div>
      {items.length === 0 ? <EmptyState text={t("tournaments.empty")} action={<button className="btn" onClick={() => nav("/admin/tournaments/new")}>{t("admin.createTournament")}</button>} /> : (
        <div className="part-table-wrap">
        <table className="data">
          <thead><tr><th>{t("form.title")}</th><th>{t("t.date")}</th><th>{t("t.status")}</th><th /></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} style={{ cursor: "pointer" }} onClick={() => nav(`/admin/tournament/${it.id}`)}>
                <td><Link className="linkish" to={`/admin/tournament/${it.id}`} style={{ fontWeight: 700 }}>{it.title}</Link></td>
                <td>{fmtDate(it.dateStart)}</td>
                <td>{it.status}</td>
                <td>
                  <div className="btn-row" onClick={(e) => e.stopPropagation()}>
                    <button className="btn" onClick={() => nav(`/admin/tournament/${it.id}`)}>{t("admin.open")}</button>
                    <button className="btn btn-danger" onClick={() => TournamentApi.remove(it.id).then(load)}>{t("admin.delete")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

export function AdminTournamentForm() {
  const { t } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const [countries, setCountries] = useState<Country[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [coverErr, setCoverErr] = useState("");
  const [form, setForm] = useState({
    title: "", slug: "", dateStart: "", dateEnd: "", timeStart: "09:00", timeEnd: "18:00",
    countryId: "", city: "", address: "", organizer: "", email: "", phone: "", venue: "",
    description: "", rules: "", regulations: "", registrationInfo: "", tatamiCount: "2",
  });
  useEffect(() => { CountryApi.list().then((r) => setCountries(r.data.items)); }, []);
  useEffect(() => {
    if (!id || id === "new") return;
    TournamentApi.get(id).then((r) => {
      const it = r.data.item;
      setForm({
        title: it.title, slug: it.slug,
        dateStart: it.dateStart.slice(0, 10), dateEnd: it.dateEnd.slice(0, 10),
        timeStart: it.timeStart || "09:00", timeEnd: it.timeEnd || "18:00",
        countryId: it.countryId || "", city: it.city || "", address: it.address || "",
        organizer: it.organizer || "", email: it.email || "", phone: it.phone || "", venue: it.venue || "",
        description: it.description || "", rules: it.rules || "", regulations: it.regulations || "",
        registrationInfo: it.registrationInfo || "", tatamiCount: String(it.tatamiCount || 1),
      });
      setPreview(it.imageUrl || "");
    });
  }, [id]);

  function onCover(f: File | null) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setCoverErr(t("form.tooBig"));
      return;
    }
    setCoverErr("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    const fd = asForm(form, file, "image");
    if (!id || id === "new") {
      const r = await TournamentApi.create(fd);
      nav(`/admin/tournament/${r.data.item.id}`);
    } else {
      await TournamentApi.update(id, fd);
      nav(`/admin/tournament/${id}`);
    }
  }

  return (
    <div>
      <h2>{t("admin.createTournament")}</h2>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <TournamentVoiceFill
          countries={countries}
          onFill={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
      </div>
      <div className="form-grid">
        {Object.entries({
          title: t("form.title"), slug: t("form.slug"), dateStart: t("form.dateStart"), dateEnd: t("form.dateEnd"),
          timeStart: t("form.timeStart"), timeEnd: t("form.timeEnd"), city: t("form.city"), address: t("t.address"),
          organizer: t("t.organizer"), email: t("form.email"), phone: t("form.phone"), venue: t("t.venue"),
          tatamiCount: "Tatami",
        }).map(([k, label]) => (
          <label className="field" key={k}>{label}
            <input type={k.includes("date") ? "date" : k.includes("time") ? "time" : "text"} value={(form as Record<string, string>)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </label>
        ))}
        <label className="field">{t("form.country")}
          <select value={form.countryId} onChange={(e) => setForm({ ...form, countryId: e.target.value })}>
            <option value="">—</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.nameRu}</option>)}
          </select>
        </label>
        <label className="field span-2">{t("t.description")}<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <div className="field span-2">
          {t("form.cover")}
          <div
            className="drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onCover(e.dataTransfer.files[0] || null); }}
            onClick={() => document.getElementById("cover-inp")?.click()}
          >
            {preview
              ? <img className="cover-preview" src={preview} alt="" />
              : t("form.drop")}
            <input id="cover-inp" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onCover(e.target.files?.[0] || null)} />
          </div>
          {coverErr && <p className="err">{coverErr}</p>}
        </div>
      </div>
      <button className="btn" style={{ marginTop: 16 }} onClick={() => void save()}>{t("admin.save")}</button>
    </div>
  );
}

export function AdminTournamentHub() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const [item, setItem] = useState<Tournament | null>(null);
  const [tab, setTab] = useState("participants");
  const [err, setErr] = useState("");
  const [coverErr, setCoverErr] = useState("");
  const loadT = () => TournamentApi.get(id).then((r) => setItem(r.data.item));
  useEffect(() => { void loadT(); }, [id]);

  async function start() {
    setErr("");
    try {
      await TournamentApi.start(id);
      toast.show(t("status.LIVE"));
      loadT();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error || t("admin.startTournament"));
    }
  }

  if (!item) return null;
  const tabs = ["participants", "categories", "draws", "fights", "schedule", "tatami", "results", "officials", "videos", "stats"] as const;

  async function onHubCover(f: File | null) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setCoverErr(t("form.tooBig"));
      return;
    }
    setCoverErr("");
    await TournamentApi.update(id, asForm({}, f, "image"));
    loadT();
  }

  return (
    <div>
      <h2>{item.title} · {item.status}</h2>
      <div className="field" style={{ maxWidth: 420, marginBottom: 12 }}>
        {t("form.cover")}
        <div
          className="drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void onHubCover(e.dataTransfer.files[0] || null); }}
          onClick={() => document.getElementById("hub-cover-inp")?.click()}
        >
          {item.imageUrl
            ? <img className="cover-preview" src={mediaUrl(item.imageUrl)} alt="" />
            : t("form.drop")}
          <input id="hub-cover-inp" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void onHubCover(e.target.files?.[0] || null)} />
        </div>
        {coverErr && <p className="err">{coverErr}</p>}
      </div>
      <div className="btn-row admin-hub-actions">
        <Link className="btn btn-ghost" to={`/admin/tournaments/${id}`}>{t("admin.edit")}</Link>
        <button className="btn" onClick={() => TournamentApi.closeReg(id).then(loadT)}>{t("admin.closeReg")}</button>
        <button className="btn" onClick={() => void start()}>{t("admin.startTournament")}</button>
        <button className="btn btn-ghost" onClick={() => TournamentApi.finish(id).then(loadT)}>{t("admin.finishTournament")}</button>
        <a className="btn btn-ghost" href={`/api/tournaments/${id}/export/participants?format=xlsx`}>Excel</a>
        <a className="btn btn-ghost" href={`/api/tournaments/${id}/export/pdf?kind=draw`}>PDF</a>
        <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="subtabs">
        {tabs.map((k) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{t(`admin.${k === "stats" ? "stats" : k}`)}</button>
        ))}
      </div>
      {tab === "participants" && <AdminParts tid={id} />}
      {tab === "categories" && <AdminCats tid={id} />}
      {tab === "draws" && <AdminDraws tid={id} />}
      {tab === "fights" && <AdminFights tid={id} />}
      {tab === "schedule" && <AdminSchedule tid={id} />}
      {tab === "tatami" && <AdminTatami tid={id} />}
      {tab === "results" && <AdminResults tid={id} />}
      {tab === "officials" && <AdminOfficials tid={id} />}
      {tab === "videos" && <AdminVideos tid={id} />}
      {tab === "stats" && <AdminStats tid={id} />}
    </div>
  );
}

function AdminParts({ tid }: { tid: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState<Participant[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Participant | null>(null);
  const load = () => ParticipantApi.list(tid, { pageSize: 100 }).then((r) => { setItems(r.data.items); setTotal(r.data.total); });
  useEffect(() => { void load(); }, [tid]);

  async function removeOne(p: Participant) {
    if (!confirm(`${t("p.removeConfirm")} ${p.firstName} ${p.lastName}?`)) return;
    try {
      await ParticipantApi.remove(p.id);
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      toast.show(ax.response?.data?.error || "Error");
    }
  }

  async function removeAll() {
    if (!items.length) return;
    if (!confirm(t("p.removeAllConfirm"))) return;
    try {
      await ParticipantApi.removeAll(tid);
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      toast.show(ax.response?.data?.error || "Error");
    }
  }

  return (
    <div>
      <div className="btn-row">
        <button className="btn" onClick={() => { setEdit(null); setOpen(true); }}>{t("p.add")}</button>
        {items.length > 0 && (
          <>
            <button className="btn btn-danger" disabled>{t("p.remove")}</button>
            <button className="btn btn-danger" onClick={() => void removeAll()}>{t("p.all")}</button>
          </>
        )}
      </div>
      {items.length === 0 ? <EmptyState text={t("p.empty")} action={<button className="btn" onClick={() => setOpen(true)}>{t("p.add")}</button>} /> : (
        <ParticipantTable
          items={items}
          total={total}
          onRow={(p) => { setEdit(p); setOpen(true); }}
          onDelete={(p) => void removeOne(p)}
        />
      )}
      {open && <ParticipantModal tournamentId={tid} initial={edit} onClose={() => setOpen(false)} onSaved={load} />}
    </div>
  );
}

function AdminCats({ tid }: { tid: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Category | null>(null);
  const load = () => CategoryApi.list(tid).then((r) => setItems(r.data.items));
  useEffect(() => { void load(); }, [tid]);
  return (
    <div>
      <button className="btn" onClick={() => { setEdit(null); setOpen(true); }}>{t("admin.add")}</button>
      {items.length === 0 ? <EmptyState text={t("empty.categories")} /> : (
        <table className="data">
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.discipline}</td>
                <td>{c._count?.participants ?? 0}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => { setEdit(c); setOpen(true); }}>{t("admin.edit")}</button>
                  <button className="btn btn-danger" onClick={() => CategoryApi.remove(c.id).then(load)}>{t("admin.delete")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && <CategoryModal tournamentId={tid} initial={edit} onClose={() => setOpen(false)} onSaved={load} />}
    </div>
  );
}

function AdminDraws({ tid }: { tid: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [cats, setCats] = useState<Category[]>([]);
  const [catId, setCatId] = useState("");
  const [mode, setMode] = useState("RANDOM");
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [fight, setFight] = useState<Fight | null>(null);
  const [warn, setWarn] = useState("");

  const load = useCallback(() => {
    CategoryApi.list(tid).then((r) => setCats(r.data.items));
    DrawApi.list(tid).then((r) => {
      const b = catId ? r.data.items.find((x) => x.category.id === catId) : r.data.items[0];
      setBracket(b || null);
      if (b && !catId) setCatId(b.category.id);
    });
  }, [tid, catId]);
  useEffect(() => { void load(); }, [load]);
  useTournamentSocket(tid, load);

  async function gen(force = false) {
    setWarn("");
    try {
      const r = await DrawApi.generate(tid, { categoryId: catId, mode, force });
      setBracket(r.data.item);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { code?: string; error?: string } } };
      if (ax.response?.data?.code === "DRAW_HAS_RESULTS") setWarn(ax.response.data.error || t("draw.regenWarn"));
      else toast.show(ax.response?.data?.error || "Error");
    }
  }

  return (
    <div>
      <div className="btn-row">
        <select value={catId} onChange={(e) => setCatId(e.target.value)}>
          <option value="">{t("p.category")}</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name} ({c._count?.participants ?? 0})</option>)}
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="RANDOM">RANDOM</option>
          <option value="SEEDED">SEEDED</option>
          <option value="CLUB_SEPARATION">CLUB SEPARATION</option>
          <option value="COUNTRY_SEPARATION">COUNTRY SEPARATION</option>
        </select>
        <button className="btn" disabled={!catId} onClick={() => void gen()}>{t("draw.generate")}</button>
        <button className="btn btn-ghost" disabled={!catId} onClick={() => void gen(true)}>{t("draw.regenerate")}</button>
      </div>
      {warn && (
        <p className="err">{warn} <button className="btn" onClick={() => void gen(true)}>{t("draw.confirm")}</button></p>
      )}
      {!bracket ? <EmptyState text={t("draw.empty")} /> : (
        <DrawBracket
          fights={bracket.fights}
          admin
          onOpenFight={setFight}
          onConfirmWinner={async (fightId, winnerId, confirmChange) => {
            await FightApi.result(fightId, { winnerId, confirmChange });
            load();
          }}
        />
      )}
      {fight && <FightControl fight={fight} admin onClose={() => setFight(null)} onChanged={() => { setFight(null); load(); }} />}
    </div>
  );
}

function AdminFights({ tid }: { tid: string }) {
  const [items, setItems] = useState<Fight[]>([]);
  const [fight, setFight] = useState<Fight | null>(null);
  const load = () => FightApi.list(tid).then((r) => setItems(r.data.items));
  useEffect(() => { void load(); }, [tid]);
  return (
    <div>
      <table className="data">
        <tbody>
          {items.map((f) => (
            <tr key={f.id} onClick={() => setFight(f)} style={{ cursor: "pointer" }}>
              <td>#{f.fightNumber}</td>
              <td>{f.roundName}</td>
              <td>{f.participantA ? `${f.participantA.lastName}` : f.slotABye ? "BYE" : "TBD"} vs {f.participantB ? `${f.participantB.lastName}` : f.slotBBye ? "BYE" : "TBD"}</td>
              <td>{f.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {fight && <FightControl fight={fight} admin onClose={() => setFight(null)} onChanged={() => { setFight(null); load(); }} />}
    </div>
  );
}

function AdminSchedule({ tid }: { tid: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Array<{ id: string; startsAt: string; title?: string; tatami?: { name: string } }>>([]);
  const load = () => MiscApi.schedule(tid).then((r) => setItems(r.data.items));
  useEffect(() => { void load(); }, [tid]);
  return (
    <div>
      <button className="btn" onClick={() => MiscApi.autoSchedule(tid).then(load)}>{t("admin.schedule")}</button>
      <table className="data">
        <tbody>
          {items.map((s) => (
            <tr key={s.id}><td>{new Date(s.startsAt).toLocaleString()}</td><td>{s.tatami?.name}</td><td>{s.title}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminTatami({ tid }: { tid: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Array<{ id: string; name: string; number: number; responsible?: string }>>([]);
  const [name, setName] = useState("Tatami");
  const load = () => MiscApi.tatami(tid).then((r) => setItems(r.data.items));
  useEffect(() => { void load(); }, [tid]);
  return (
    <div>
      <div className="btn-row">
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" onClick={() => MiscApi.createTatami(tid, { name, number: items.length + 1 }).then(load)}>{t("admin.add")}</button>
      </div>
      {items.map((x) => (
        <div key={x.id} className="tatami-card" style={{ marginTop: 8 }}>
          {x.name} #{x.number}
          <button className="btn btn-danger" onClick={() => MiscApi.deleteTatami(x.id).then(load)}>{t("admin.delete")}</button>
        </div>
      ))}
    </div>
  );
}

function AdminResults({ tid }: { tid: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Array<{ id: string; place: number; medal?: string | null; official: boolean; participant: Participant; category: Category }>>([]);
  const load = () => ResultsApi.list(tid).then((r) => setItems(r.data.items));
  useEffect(() => { void load(); }, [tid]);
  const cats = [...new Set(items.map((i) => i.category.id))];
  return (
    <div>
      {cats.map((cid) => (
        <button key={cid} className="btn btn-ghost" onClick={() => CategoryApi.confirmResults(cid).then(load)}>{t("results.confirm")}</button>
      ))}
      <table className="data">
        <tbody>
          {items.map((r) => (
            <tr key={r.id}><td>{r.category.name}</td><td>{r.place}</td><td>{r.medal}</td><td>{r.participant.lastName} {r.participant.firstName}</td><td>{r.official ? "official" : ""}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminOfficials({ tid }: { tid: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Array<{ id: string; firstName: string; lastName: string; role: string }>>([]);
  const [form, setForm] = useState({ firstName: "", lastName: "", role: "REFEREE" });
  const load = () => MiscApi.officials(tid).then((r) => setItems(r.data.items));
  useEffect(() => { void load(); }, [tid]);
  return (
    <div>
      <div className="form-grid">
        <input placeholder={t("form.firstName")} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <input placeholder={t("form.lastName")} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {["REFEREE", "JUDGE", "ORGANIZER", "OFFICIAL", "DOCTOR", "OTHER"].map((r) => <option key={r}>{r}</option>)}
        </select>
        <button className="btn" onClick={() => {
          const fd = asForm(form);
          MiscApi.createOfficial(tid, fd).then(load);
        }}>{t("admin.add")}</button>
      </div>
      <table className="data"><tbody>{items.map((o) => <tr key={o.id}><td>{o.firstName} {o.lastName}</td><td>{o.role}</td><td><button className="btn btn-danger" onClick={() => MiscApi.deleteOfficial(o.id).then(load)}>{t("admin.delete")}</button></td></tr>)}</tbody></table>
    </div>
  );
}

function AdminVideos({ tid }: { tid: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Array<{ id: string; title: string; youtubeUrl: string }>>([]);
  const [form, setForm] = useState({ title: "", youtubeUrl: "", description: "" });
  const load = () => MiscApi.videos(tid).then((r) => setItems(r.data.items));
  useEffect(() => { void load(); }, [tid]);
  return (
    <div>
      <div className="form-grid">
        <input placeholder={t("form.title")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input placeholder="YouTube URL" value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} />
        <button className="btn" onClick={() => MiscApi.createVideo(tid, form).then(load)}>{t("admin.add")}</button>
      </div>
      {items.map((v) => (
        <div key={v.id}>{v.title} <button className="btn btn-danger" onClick={() => MiscApi.deleteVideo(v.id).then(load)}>{t("admin.delete")}</button></div>
      ))}
    </div>
  );
}

function AdminStats({ tid }: { tid: string }) {
  const [s, setS] = useState<Record<string, unknown>>({});
  useEffect(() => { MiscApi.stats(tid).then((r) => setS(r.data)); }, [tid]);
  return (
    <div className="stat-grid">
      {Object.entries(s).filter(([, v]) => typeof v === "number").map(([k, v]) => (
        <div className="stat" key={k}><div className="n">{v as number}</div><div className="l">{k}</div></div>
      ))}
    </div>
  );
}

export function AdminClubs() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Club[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", coach: "", phone: "", email: "" });
  const load = () => ClubApi.list().then((r) => setItems(r.data.items));
  useEffect(() => { void load(); }, []);
  return (
    <div>
      <button className="btn" onClick={() => setOpen(true)}>{t("admin.add")}</button>
      {items.length === 0 ? <EmptyState text={t("empty.clubs")} /> : (
        <table className="data">
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.city}</td><td>{c._count?.participants ?? 0}</td>
                <td><button className="btn btn-danger" onClick={() => ClubApi.remove(c.id).then(load)}>{t("admin.delete")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && (
        <Modal title={t("admin.add")} onClose={() => setOpen(false)}>
          <div className="form-grid">
            <label className="field">{t("form.title")}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field">{t("form.city")}<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          </div>
          <button className="btn" onClick={() => ClubApi.create(asForm(form, null, "logo")).then(() => { setOpen(false); load(); })}>{t("admin.save")}</button>
        </Modal>
      )}
    </div>
  );
}

export function AdminCountries() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Country[]>([]);
  const [form, setForm] = useState({ name: "", nameRu: "", nameTg: "", code: "", flag: "" });
  const load = () => CountryApi.list().then((r) => setItems(r.data.items));
  useEffect(() => { void load(); }, []);
  return (
    <div>
      <div className="form-grid">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="RU" value={form.nameRu} onChange={(e) => setForm({ ...form, nameRu: e.target.value })} />
        <input placeholder="TG" value={form.nameTg} onChange={(e) => setForm({ ...form, nameTg: e.target.value })} />
        <input placeholder="TJ" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input placeholder="🏳️" value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} />
        <button className="btn" onClick={() => CountryApi.create(form).then(load)}>{t("admin.add")}</button>
      </div>
      <table className="data"><tbody>{items.map((c) => <tr key={c.id}><td>{c.flag}</td><td>{c.code}</td><td>{c.nameRu}</td></tr>)}</tbody></table>
    </div>
  );
}

export function AdminMessages() {
  const [items, setItems] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; body: string; read: boolean; createdAt: string }>>([]);
  const load = () => MiscApi.messages().then((r) => setItems(r.data.items));
  useEffect(() => { void load(); }, []);
  return (
    <table className="data">
      <tbody>
        {items.map((m) => (
          <tr key={m.id} onClick={() => MiscApi.readMessage(m.id).then(load)}>
            <td>{m.read ? "" : "●"}</td>
            <td>{m.firstName} {m.lastName}</td>
            <td>{m.email}</td>
            <td>{m.body}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AdminSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ siteName: "", tagline: "", email: "", phone: "", location: "" });
  const [file, setFile] = useState<File | null>(null);
  const [invite, setInvite] = useState("");
  const [plans, setPlans] = useState<Array<{ id: string; name: string; price: string; description?: string; features: string[] }>>([]);
  useEffect(() => {
    MiscApi.settings().then((r) => setForm({
      siteName: r.data.item.siteName, tagline: r.data.item.tagline, email: r.data.item.email,
      phone: r.data.item.phone, location: r.data.item.location,
    }));
    MiscApi.pricing().then((r) => setPlans(r.data.items));
    AuthApi.invite().then((r) => setInvite(`${window.location.origin}${r.data.path}`)).catch(() => undefined);
  }, []);
  return (
    <div>
      <h2>{t("admin.settings")}</h2>
      {invite && (
        <div className="panel">
          <h3>{t("admin.inviteTitle")}</h3>
          <p className="muted">{t("admin.inviteLead")}</p>
          <input readOnly value={invite} onFocus={(e) => e.target.select()} style={{ width: "100%", height: 44, padding: "0 12px" }} />
          <button
            className="btn"
            style={{ marginTop: 10 }}
            type="button"
            onClick={() => { void navigator.clipboard.writeText(invite); toast.show(t("admin.inviteCopied")); }}
          >
            {t("admin.inviteCopy")}
          </button>
        </div>
      )}
      <div className="panel">
      <div className="form-grid">
        {(["siteName", "tagline", "email", "phone", "location"] as const).map((k) => (
          <label className="field" key={k}>{k}<input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
        ))}
        <label className="field">
          Logo
          <div
            className="drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0] || null); }}
            onClick={() => document.getElementById("settings-logo")?.click()}
          >
            {file ? file.name : t("form.drop")}
            <input id="settings-logo" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </label>
      </div>
      <button className="btn" style={{ marginTop: 16 }} onClick={() => MiscApi.updateSettings(asForm(form, file, "logo"))}>{t("admin.save")}</button>
      </div>
      <h3>{t("pricing.title")}</h3>
      {plans.map((p) => (
        <div key={p.id} className="form-grid" style={{ marginBottom: 12 }}>
          <input value={p.name} onChange={(e) => setPlans(plans.map((x) => x.id === p.id ? { ...x, name: e.target.value } : x))} />
          <input value={p.price} onChange={(e) => setPlans(plans.map((x) => x.id === p.id ? { ...x, price: e.target.value } : x))} />
          <span style={{ alignSelf: "center", color: "#555" }}>{t("pricing.currency")} {t("pricing.month")}</span>
          <button className="btn btn-ghost" onClick={() => MiscApi.updatePricing(p.id, p)}>{t("admin.save")}</button>
        </div>
      ))}
    </div>
  );
}

export function AdminAudit() {
  const [items, setItems] = useState<Array<{ id: string; action: string; entity: string; entityId?: string; createdAt: string; user?: { email: string } }>>([]);
  useEffect(() => { MiscApi.audit().then((r) => setItems(r.data.items)); }, []);
  return (
    <table className="data">
      <thead><tr><th>Action</th><th>Entity</th><th>Admin</th><th>Date</th></tr></thead>
      <tbody>
        {items.map((a) => (
          <tr key={a.id}><td>{a.action}</td><td>{a.entity} {a.entityId}</td><td>{a.user?.email}</td><td>{new Date(a.createdAt).toLocaleString()}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function PublicDrawPage() {
  const { id = "", drawId = "" } = useParams();
  const [b, setB] = useState<Bracket | null>(null);
  const load = useCallback(() => { DrawApi.get(id, drawId).then((r) => setB(r.data.item)); }, [id, drawId]);
  useEffect(() => { void load(); }, [load]);
  useTournamentSocket(id, load);
  if (!b) return null;
  return (
    <div className="container" style={{ padding: "16px 0 40px" }}>
      <h2>{b.category.name}</h2>
      <DrawBracket fights={b.fights} admin={false} onOpenFight={() => undefined} onConfirmWinner={async () => undefined} />
    </div>
  );
}
