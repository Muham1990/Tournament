import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Ui";
import { CategoryApi, ClubApi, CountryApi } from "../services/endpoints";
import { asForm } from "../services/api";
import type { Category, Club, Country, Participant } from "../types";
import { PhotoScanModal, VoiceFill } from "./AiFeatures";
import { mediaUrl } from "../lib/config";

const GENDERS = ["BOYS", "GIRLS", "MEN", "WOMEN", "MIXED"] as const;
const MAX_MB = 5;

export function ParticipantModal({
  tournamentId, initial, onClose, onSaved,
}: {
  tournamentId: string;
  initial?: Participant | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<Country[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(mediaUrl(initial?.photoUrl) || "");
  const [err, setErr] = useState("");
  const [dup, setDup] = useState(false);
  const [mismatch, setMismatch] = useState<string[]>([]);
  const [form, setForm] = useState({
    firstName: initial?.firstName || "",
    lastName: initial?.lastName || "",
    birthDate: initial?.birthDate?.slice(0, 10) || "",
    gender: initial?.gender || "MEN",
    countryId: initial?.countryId || "",
    city: initial?.city || "",
    clubId: initial?.clubId || "",
    school: initial?.school || "",
    weight: initial?.weight?.toString() || "",
    rank: initial?.rank || "",
    coach: initial?.coach || "",
    categoryId: initial?.categoryId || "",
    entryFee: initial?.entryFee != null ? String(initial.entryFee) : "",
  });
  const [scan, setScan] = useState(false);

  useEffect(() => {
    CountryApi.list().then((r) => setCountries(r.data.items));
    ClubApi.list().then((r) => setClubs(r.data.items));
    CategoryApi.list(tournamentId).then((r) => setCats(r.data.items));
  }, [tournamentId]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function onFile(f: File | null) {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      setErr(t("form.tooBig"));
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(extra: Record<string, unknown> = {}) {
    setErr("");
    if (!form.firstName) return setErr(t("errors.name"));
    const { ParticipantApi } = await import("../services/endpoints");
    const fd = asForm({ ...form, ...extra }, file, "photo");
    try {
      if (initial) await ParticipantApi.update(initial.id, fd);
      else await ParticipantApi.create(tournamentId, fd);
      onSaved();
      onClose();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { code?: string; error?: string; warnings?: string[] } } };
      const data = ax.response?.data;
      if (data?.code === "DUPLICATE") {
        setDup(true);
        setErr(data.error || t("errors.duplicate"));
      } else if (data?.code === "CATEGORY_MISMATCH") {
        setMismatch(data.warnings || [data.error || ""]);
      } else {
        setErr(data?.error || "Error");
      }
    }
  }

  return (
    <Modal title={initial ? t("admin.edit") : t("p.add")} onClose={onClose}>
      {!initial && (
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setScan(true)}>{t("ai.scan")}</button>
          <VoiceFill tournamentId={tournamentId} onCreated={onSaved} />
        </div>
      )}
      {scan && (
        <PhotoScanModal
          tournamentId={tournamentId}
          onClose={() => setScan(false)}
          onSaved={() => { onSaved(); onClose(); }}
        />
      )}
      <div className="form-grid">
        <label className="field">{t("form.firstName")} *<input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></label>
        <label className="field">{t("form.lastName")} *<input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></label>
        <label className="field">{t("form.birthDate")} *<input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></label>
        <label className="field">{t("form.gender")} *
          <select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
            {GENDERS.map((g) => <option key={g} value={g}>{t(`gender.${g}`)}</option>)}
          </select>
        </label>
        <label className="field">{t("form.country")} *
          <select value={form.countryId} onChange={(e) => set("countryId", e.target.value)}>
            <option value="">—</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.nameRu}</option>)}
          </select>
        </label>
        <label className="field">{t("form.city")}<input value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
        <label className="field">{t("form.club")}
          <select value={form.clubId} onChange={(e) => set("clubId", e.target.value)}>
            <option value="">—</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">{t("p.category")}
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">—</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">{t("form.weight")}<input value={form.weight} onChange={(e) => set("weight", e.target.value)} /></label>
        <label className="field">{t("form.entryFee")}<input value={form.entryFee} onChange={(e) => set("entryFee", e.target.value)} /></label>
        <label className="field">{t("form.rank")}<input value={form.rank} onChange={(e) => set("rank", e.target.value)} /></label>
        <label className="field">{t("form.coach")}<input value={form.coach} onChange={(e) => set("coach", e.target.value)} /></label>
        <label className="field">{t("p.school")}<input value={form.school} onChange={(e) => set("school", e.target.value)} /></label>
        <div className="field span-2">
          {t("form.photo")}
          <div
            className="drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0] || null); }}
          >
            {preview ? <img src={preview} alt="" style={{ height: 80, margin: "0 auto" }} /> : t("form.drop")}
            <div className="btn-row" style={{ justifyContent: "center", marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => document.getElementById("photo-inp")?.click()}>{t("ai.pick")}</button>
              <button type="button" className="btn btn-ghost" onClick={() => document.getElementById("photo-cam")?.click()}>{t("ai.camera")}</button>
            </div>
            <input id="photo-inp" type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden onChange={(e) => onFile(e.target.files?.[0] || null)} />
            <input id="photo-cam" type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0] || null)} />
          </div>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      {dup && (
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={onClose}>{t("draw.cancel")}</button>
          <button className="btn" onClick={() => submit({ forceDuplicate: true })}>{t("errors.anyway")}</button>
        </div>
      )}
      {mismatch.length > 0 && (
        <div>
          {mismatch.map((m) => <p key={m} className="err">{m}</p>)}
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={onClose}>{t("draw.cancel")}</button>
            <button className="btn" onClick={() => submit({ overrideOk: true })}>{t("draw.confirm")}</button>
          </div>
        </div>
      )}
      {!dup && mismatch.length === 0 && (
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => submit()}>{t("admin.save")}</button>
        </div>
      )}
    </Modal>
  );
}

export function CategoryModal({
  tournamentId, initial, onClose, onSaved,
}: {
  tournamentId: string;
  initial?: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: initial?.name || "",
    discipline: initial?.discipline || "KUMITE",
    gender: initial?.gender || "BOYS",
    minAge: initial?.minAge?.toString() || "",
    maxAge: initial?.maxAge?.toString() || "",
    minWeight: initial?.minWeight?.toString() || "",
    maxWeight: initial?.maxWeight?.toString() || "",
    rankMin: initial?.rankMin || "",
    rankMax: initial?.rankMax || "",
    bronzeMode: initial?.bronzeMode || "TWO",
    thirdPlace: initial?.thirdPlace ?? true,
  });
  return (
    <Modal title={initial ? t("admin.edit") : t("admin.add")} onClose={onClose}>
      <div className="form-grid">
        <label className="field span-2">{t("form.title")}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field">Discipline
          <select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value as never })}>
            {["KUMITE", "KATA", "TEAM_KATA", "TEAM_KUMITE"].map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="field">{t("form.gender")}
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as never })}>
            {GENDERS.map((g) => <option key={g} value={g}>{t(`gender.${g}`)}</option>)}
          </select>
        </label>
        <label className="field">Min age<input value={form.minAge} onChange={(e) => setForm({ ...form, minAge: e.target.value })} /></label>
        <label className="field">Max age<input value={form.maxAge} onChange={(e) => setForm({ ...form, maxAge: e.target.value })} /></label>
        <label className="field">Min kg<input value={form.minWeight} onChange={(e) => setForm({ ...form, minWeight: e.target.value })} /></label>
        <label className="field">Max kg<input value={form.maxWeight} onChange={(e) => setForm({ ...form, maxWeight: e.target.value })} /></label>
        <label className="field">Bronze
          <select value={form.bronzeMode} onChange={(e) => setForm({ ...form, bronzeMode: e.target.value as never })}>
            <option value="TWO">2× bronze</option>
            <option value="ONE">1× bronze + 3rd place</option>
          </select>
        </label>
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={async () => {
          if (initial) await CategoryApi.update(initial.id, form);
          else await CategoryApi.create(tournamentId, form);
          onSaved(); onClose();
        }}>{t("admin.save")}</button>
      </div>
    </Modal>
  );
}
