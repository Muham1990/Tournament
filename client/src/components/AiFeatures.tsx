import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Modal } from "./Ui";
import { AiApi, ParticipantApi, type AiAthleteResult, type AiProviderName, type AiTournamentDraft } from "../services/endpoints";
import type { Country } from "../types";
import { asForm } from "../services/api";

function aiError(e: unknown, fallback: string) {
  const ax = e as { response?: { data?: { error?: string; code?: string } } };
  if (ax.response?.data?.code === "VISION_UNSUPPORTED") return ax.response.data.error || fallback;
  return ax.response?.data?.error || fallback;
}

function recMime() {
  const types = ["audio/mp4", "audio/aac", "audio/mpeg", "audio/webm;codecs=opus", "audio/webm"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "";
}

function recFileName(mime: string) {
  if (mime.includes("mp4") || mime.includes("aac")) return "voice.m4a";
  if (mime.includes("mpeg")) return "voice.mp3";
  return "voice.webm";
}

async function recordAudio(onStart: () => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime = recMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: rec.mimeType || mime || "audio/mp4" }));
    };
    rec.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      reject(new Error("rec"));
    };
  });
  rec.start();
  onStart();
  return { stop: () => { if (rec.state !== "inactive") rec.stop(); }, done };
}

function ProviderBar({
  provider, setProvider, fallback, setFallback, vision,
}: {
  provider: AiProviderName;
  setProvider: (v: AiProviderName) => void;
  fallback: boolean;
  setFallback: (v: boolean) => void;
  vision?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="ai-prov">
      <label>
        {t("ai.provider")}
        <select value={provider} onChange={(e) => setProvider(e.target.value as AiProviderName)}>
          <option value="gemini">Gemini</option>
          {!vision && <option value="groq">Groq</option>}
          <option value="openrouter">OpenRouter</option>
        </select>
      </label>
      <label className="ai-fb">
        <input type="checkbox" checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
        {t("ai.fallback")}
      </label>
    </div>
  );
}

function AddPhotoBtn({ id, onDone }: { id: string; onDone?: () => void }) {
  const { t } = useTranslation();
  const inp = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  async function pick(f: File | null) {
    if (!f) return;
    try {
      await ParticipantApi.update(id, asForm({}, f, "photo"));
      setMsg("✓");
      onDone?.();
    } catch (e) {
      setMsg(aiError(e, t("ai.unavailable")));
    }
  }
  return (
    <div>
      <button type="button" className="btn btn-ghost" onClick={() => inp.current?.click()}>{t("ai.addPhoto")}</button>
      <input ref={inp} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void pick(e.target.files?.[0] || null)} />
      {msg && <span style={{ marginLeft: 8 }}>{msg}</span>}
    </div>
  );
}

function CreatedCard({ row, onSaved }: { row: AiAthleteResult; onSaved?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="ai-created">
      <p><strong>{t("ai.added")}</strong></p>
      <p>{row.firstName} {row.lastName}</p>
      <p>{row.age} {t("p.age").toLowerCase()} · {row.weight} kg · {row.country}</p>
      <p>{t("ai.category")}: {row.category}</p>
      {row.participant?.id && <AddPhotoBtn id={row.participant.id} onDone={onSaved} />}
    </div>
  );
}

export function PhotoScanModal({
  tournamentId, onClose, onSaved,
}: {
  tournamentId: string;
  countryId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<AiProviderName>("gemini");
  const [fallback, setFallback] = useState(true);
  const [step, setStep] = useState<"pick" | "progress" | "done">("pick");
  const [progress, setProgress] = useState(10);
  const [rows, setRows] = useState<AiAthleteResult[]>([]);
  const [err, setErr] = useState("");
  const [cam, setCam] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileInp = useRef<HTMLInputElement>(null);
  const camInp = useRef<HTMLInputElement>(null);

  function stopCam() {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setCam(false);
  }

  function openNativeCam() {
    camInp.current?.click();
  }

  async function startCam() {
    setErr("");
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !local) {
      openNativeCam();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      openNativeCam();
      return;
    }
    try {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      } catch {
        s = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      stream.current = s;
      setCam(true);
      requestAnimationFrame(() => {
        if (!video.current) return;
        video.current.srcObject = s;
        void video.current.play().catch(() => undefined);
      });
    } catch {
      openNativeCam();
    }
  }

  async function sendFile(file: File) {
    setErr("");
    setStep("progress");
    setProgress(18);
    const timer = window.setInterval(() => setProgress((p) => Math.min(88, p + 7)), 400);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("tournamentId", tournamentId);
      fd.append("provider", provider);
      fd.append("fallback", fallback ? "true" : "false");
      const r = await AiApi.scan(fd);
      setRows(r.data.results);
      setStep("done");
      if (r.data.results.some((x) => x.created)) onSaved();
    } catch (e) {
      setErr(aiError(e, t("ai.badPhoto")));
      setStep("pick");
    } finally {
      window.clearInterval(timer);
      setProgress(100);
    }
  }

  async function commitRow(i: number, extra: Record<string, unknown> = {}) {
    const row = rows[i];
    try {
      const r = await AiApi.commit({
        tournamentId,
        firstName: row.firstName,
        lastName: row.lastName,
        age: row.age,
        weight: row.weight,
        country: row.country,
        countryId: row.countryId,
        forceDuplicate: extra.forceDuplicate,
      });
      setRows((list) => list.map((x, idx) => (idx === i ? { ...x, ...r.data } : x)));
      if (r.data.created) onSaved();
    } catch (e) {
      setErr(aiError(e, t("ai.unavailable")));
    }
  }

  function setRow(i: number, patch: Partial<AiAthleteResult>) {
    setRows((list) => list.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function snap() {
    const v = video.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    stopCam();
    canvas.toBlob((b) => b && void sendFile(new File([b], "camera.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9);
  }

  return (
    <Modal title={t("ai.scanTitle")} onClose={() => { stopCam(); onClose(); }} wide>
      <ProviderBar vision provider={provider} setProvider={setProvider} fallback={fallback} setFallback={setFallback} />
      {step === "pick" && (
        <>
          <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void sendFile(f); }}>
            <p>{t("ai.drop")}</p>
            <div className="btn-row" style={{ justifyContent: "center", marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => fileInp.current?.click()}>{t("ai.pick")}</button>
              <button type="button" className="btn btn-ghost" onClick={() => void startCam()}>{t("ai.camera")}</button>
            </div>
            <input ref={fileInp} type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden onChange={(e) => e.target.files?.[0] && void sendFile(e.target.files[0])} />
            <input ref={camInp} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && void sendFile(e.target.files[0])} />
          </div>
          {cam && (
            <div className="ai-cam">
              <video ref={video} autoPlay playsInline muted />
              <button type="button" className="btn" onClick={() => void snap()}>{t("ai.capture")}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { stopCam(); openNativeCam(); }}>{t("ai.takePhoto")}</button>
            </div>
          )}
        </>
      )}
      {step === "progress" && (
        <div className="ai-progress">
          <p>{t("ai.analyzing")}</p>
          <div className="ai-bar"><span style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {step === "done" && (
        <>
          <p>{t("ai.found")}: {rows.length}</p>
          {rows.map((row, i) => (
            <div key={i} className="ai-row-card">
              {row.created ? <CreatedCard row={row} onSaved={onSaved} /> : (
                <>
                  <div className="form-grid">
                    <label className="field">{t("form.firstName")}<input value={row.firstName || ""} onChange={(e) => setRow(i, { firstName: e.target.value })} /></label>
                    <label className="field">{t("form.lastName")}<input value={row.lastName || ""} onChange={(e) => setRow(i, { lastName: e.target.value })} /></label>
                    <label className="field">{t("p.age")}<input value={row.age ?? ""} onChange={(e) => setRow(i, { age: e.target.value === "" ? null : Number(e.target.value) })} /></label>
                    <label className="field">{t("form.weight")}<input value={row.weight ?? ""} onChange={(e) => setRow(i, { weight: e.target.value === "" ? null : Number(e.target.value) })} /></label>
                    <label className="field">{t("ai.country")}<input value={row.country || ""} onChange={(e) => setRow(i, { country: e.target.value, countryId: undefined })} /></label>
                  </div>
                  {row.warnings.map((w) => <p key={w} className="err">⚠️ {w}</p>)}
                  {row.duplicate && <p className="err">{t("ai.duplicate")}{row.existing ? `: ${row.existing}` : ""}</p>}
                  <div className="btn-row">
                    {row.duplicate
                      ? <button type="button" className="btn" onClick={() => void commitRow(i, { forceDuplicate: true })}>{t("ai.anyway")}</button>
                      : <button type="button" className="btn" onClick={() => void commitRow(i)}>{t("ai.ok")}</button>}
                  </div>
                </>
              )}
            </div>
          ))}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setStep("pick"); setRows([]); }}>{t("ai.retry")}</button>
          </div>
        </>
      )}
      {err && <p className="err">{err}</p>}
    </Modal>
  );
}

export function VoiceFill({
  tournamentId, onCreated,
}: {
  tournamentId: string;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AiProviderName>("gemini");
  const [fallback, setFallback] = useState(true);
  const [phase, setPhase] = useState<"idle" | "listen" | "process" | "result">("idle");
  const [draft, setDraft] = useState<AiAthleteResult | null>(null);
  const [err, setErr] = useState("");
  const [typed, setTyped] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const draftRef = useRef<AiAthleteResult | null>(null);
  const retryRef = useRef<string | undefined>(undefined);
  draftRef.current = draft;

  function close() {
    stopRef.current?.();
    stopRef.current = null;
    setOpen(false);
    setPhase("idle");
  }

  async function send(body: FormData | Record<string, unknown>) {
    setPhase("process");
    setErr("");
    try {
      const r = await AiApi.voice(body);
      setDraft(r.data);
      setPhase("result");
      if (r.data.created) onCreated();
    } catch (e) {
      setErr(aiError(e, t("ai.unavailable")));
      setPhase("idle");
    }
  }

  function baseFd() {
    const fd = new FormData();
    fd.append("tournamentId", tournamentId);
    fd.append("provider", provider);
    fd.append("fallback", fallback ? "true" : "false");
    return fd;
  }

  async function listen(retryField?: string) {
    retryRef.current = retryField;
    setOpen(true);
    setErr("");
    try {
      const rec = await recordAudio(() => setPhase("listen"));
      stopRef.current = rec.stop;
      window.setTimeout(() => rec.stop(), 15000);
      const blob = await rec.done;
      stopRef.current = null;
      if (!blob.size) {
        setPhase("idle");
        setErr(t("ai.noMic"));
        return;
      }
      const fd = baseFd();
      fd.append("audio", blob, recFileName(blob.type));
      if (retryField) fd.append("retryField", retryField);
      if (draftRef.current) fd.append("prev", JSON.stringify({
        firstName: draftRef.current.firstName, lastName: draftRef.current.lastName, age: draftRef.current.age, weight: draftRef.current.weight, country: draftRef.current.country,
      }));
      await send(fd);
    } catch {
      stopRef.current = null;
      setPhase("idle");
      setErr(t("ai.noMic"));
    }
  }

  async function commit(force = false) {
    if (!draft) return;
    try {
      const r = await AiApi.commit({
        tournamentId,
        firstName: draft.firstName,
        lastName: draft.lastName,
        age: draft.age,
        weight: draft.weight,
        country: draft.country,
        countryId: draft.countryId,
        forceDuplicate: force,
      });
      setDraft(r.data);
      if (r.data.created) onCreated();
    } catch (e) {
      setErr(aiError(e, t("ai.unavailable")));
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => void listen()}>{t("ai.voice")}</button>
      {open && (
        <Modal title={t("ai.voice")} onClose={close}>
          <ProviderBar provider={provider} setProvider={setProvider} fallback={fallback} setFallback={setFallback} />
          {phase === "listen" && (
            <div className="ai-listen">
              <div className="ai-mic" />
              <p>{draft?.ask || t("ai.listening")}</p>
              <button type="button" className="btn" onClick={() => stopRef.current?.()}>{t("ai.stopListen")}</button>
            </div>
          )}
          {phase === "process" && <p>{t("ai.processing")}</p>}
          {phase === "result" && draft?.created && <CreatedCard row={draft} onSaved={onCreated} />}
          {phase === "result" && draft && !draft.created && (
            <>
              {draft.transcript && <p>{t("ai.youSaid")}: {draft.transcript}</p>}
              {draft.warnings.map((w) => <p key={w} className="err">⚠️ {w}</p>)}
              {draft.ask && <p>{draft.ask}</p>}
              {draft.duplicate && <p className="err">{t("ai.duplicate")}</p>}
              <div className="form-grid" style={{ marginTop: 10 }}>
                <label className="field">{t("form.firstName")}<input value={draft.firstName || ""} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} /></label>
                <label className="field">{t("form.lastName")}<input value={draft.lastName || ""} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} /></label>
                <label className="field">{t("p.age")}<input value={draft.age ?? ""} onChange={(e) => setDraft({ ...draft, age: e.target.value === "" ? null : Number(e.target.value) })} /></label>
                <label className="field">{t("form.weight")}<input value={draft.weight ?? ""} onChange={(e) => setDraft({ ...draft, weight: e.target.value === "" ? null : Number(e.target.value) })} /></label>
                <label className="field">{t("ai.country")}<input value={draft.country || ""} onChange={(e) => setDraft({ ...draft, country: e.target.value, countryId: undefined })} /></label>
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => void listen(draft.askField || undefined)}>{t("ai.again")}</button>
                <button type="button" className="btn" onClick={() => void commit(false)}>{t("ai.ok")}</button>
                {draft.duplicate && <button type="button" className="btn" onClick={() => void commit(true)}>{t("ai.anyway")}</button>}
              </div>
            </>
          )}
          {phase !== "process" && phase !== "listen" && !draft?.created && (
            <div className="field" style={{ marginTop: 12 }}>
              <button type="button" className="btn" style={{ width: "100%", marginBottom: 12 }} onClick={() => void listen()}>{t("ai.recordPhone")}</button>
              {t("ai.typePhrase")}
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Мухаммад Саидов, 14 лет, 55 кг, Таджикистан" />
              <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} disabled={!typed.trim()} onClick={() => void send({
                tournamentId, provider, fallback, text: typed.trim(),
              })}>{t("ai.parseText")}</button>
            </div>
          )}
          {err && <p className="err">{err}</p>}
        </Modal>
      )}
    </>
  );
}

export function TournamentVoiceFill({
  countries,
  onFill,
}: {
  countries: Country[];
  onFill: (patch: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AiProviderName>("gemini");
  const [fallback, setFallback] = useState(true);
  const [phase, setPhase] = useState<"idle" | "listen" | "process">("idle");
  const [err, setErr] = useState("");
  const [typed, setTyped] = useState("");
  const stopRef = useRef<(() => void) | null>(null);

  function close() {
    stopRef.current?.();
    stopRef.current = null;
    setOpen(false);
    setPhase("idle");
    setErr("");
  }

  function apply(data: AiTournamentDraft) {
    const patch: Record<string, string> = {};
    const keys = ["title", "slug", "dateStart", "dateEnd", "timeStart", "timeEnd", "city", "address", "organizer", "email", "phone", "venue", "tatamiCount", "description"] as const;
    for (const k of keys) {
      const v = data[k];
      if (v) patch[k] = v;
    }
    if (data.country) {
      const q = data.country.toLowerCase();
      const c = countries.find((x) =>
        [x.nameRu, x.name, x.nameTg, x.code].some((n) => n && (n.toLowerCase() === q || n.toLowerCase().includes(q))),
      );
      if (c) patch.countryId = c.id;
    }
    onFill(patch);
    close();
  }

  async function send(body: FormData | Record<string, unknown>) {
    setPhase("process");
    setErr("");
    try {
      const r = await AiApi.voiceTournament(body);
      apply(r.data);
    } catch (e) {
      setErr(aiError(e, t("ai.unavailable")));
      setPhase("idle");
    }
  }

  async function listen() {
    setOpen(true);
    setErr("");
    try {
      const rec = await recordAudio(() => setPhase("listen"));
      stopRef.current = rec.stop;
      window.setTimeout(() => rec.stop(), 15000);
      const blob = await rec.done;
      stopRef.current = null;
      if (!blob.size) {
        setPhase("idle");
        setErr(t("ai.noMic"));
        return;
      }
      const fd = new FormData();
      fd.append("audio", blob, recFileName(blob.type));
      fd.append("provider", provider);
      fd.append("fallback", fallback ? "true" : "false");
      await send(fd);
    } catch {
      setPhase("idle");
      setErr(t("ai.noMic"));
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => void listen()}>{t("ai.voiceTournament")}</button>
      {open && (
        <Modal title={t("ai.voiceTournament")} onClose={close}>
          <ProviderBar provider={provider} setProvider={setProvider} fallback={fallback} setFallback={setFallback} />
          {phase === "listen" && <p>{t("ai.listening")}</p>}
          {phase === "process" && <p>{t("ai.processing")}</p>}
          {phase === "listen" && (
            <button type="button" className="btn" onClick={() => stopRef.current?.()}>{t("ai.stopListen")}</button>
          )}
          {phase === "idle" && (
            <div className="field" style={{ marginTop: 12 }}>
              <button type="button" className="btn" style={{ width: "100%", marginBottom: 12 }} onClick={() => void listen()}>{t("ai.recordPhone")}</button>
              <p>{t("ai.typePhrase")}</p>
              <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={3} />
              <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => void send({
                text: typed, provider, fallback: fallback ? "true" : "false",
              })}>{t("ai.parseText")}</button>
            </div>
          )}
          {err && <p className="err">{err}</p>}
        </Modal>
      )}
    </>
  );
}

function RobotIcon({ light = false }: { light?: boolean }) {
  const face = light ? "#fff" : "#e3f2fd";
  const ink = light ? "#1565c0" : "#0d47a1";
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      <rect x="28" y="4" width="8" height="10" rx="4" fill={face} />
      <circle cx="32" cy="6" r="4" fill="#ff8a80" />
      <rect x="10" y="16" width="44" height="36" rx="14" fill={face} />
      <rect x="16" y="24" width="32" height="16" rx="8" fill={ink} />
      <circle cx="24" cy="32" r="3.2" fill="#80d8ff" />
      <circle cx="40" cy="32" r="3.2" fill="#80d8ff" />
      <rect x="26" y="44" width="12" height="3" rx="1.5" fill={ink} opacity="0.35" />
    </svg>
  );
}

export function AiAssistantDock() {
  const { t } = useTranslation();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AiProviderName>("gemini");
  const [fallback, setFallback] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState("");
  const [msgs, setMsgs] = useState<Array<{ role: "ai" | "admin"; text: string }>>([
    { role: "ai", text: t("ai.hello") },
  ]);
  const box = useRef<HTMLDivElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const tid = loc.pathname.match(/\/admin\/tournament\/([^/]+)/)?.[1];

  useEffect(() => {
    box.current?.scrollTo(0, box.current.scrollHeight);
  }, [msgs, open]);

  async function ask(body: FormData | Record<string, unknown>, shown?: string) {
    if (busy) return;
    setErr("");
    if (shown) setMsgs((m) => [...m, { role: "admin", text: shown }]);
    setBusy(true);
    try {
      const r = await AiApi.assistant(body);
      if (!shown && r.data.heard) setMsgs((m) => [...m, { role: "admin", text: r.data.heard! }]);
      setMsgs((m) => [...m, { role: "ai", text: r.data.reply }]);
    } catch (e) {
      setErr(aiError(e, t("ai.unavailable")));
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const q = text.trim();
    if (!q) return;
    setText("");
    void ask({ message: q, tournamentId: tid, provider, fallback }, q);
  }

  async function listen() {
    if (busy || listening) {
      stopRef.current?.();
      return;
    }
    try {
      const rec = await recordAudio(() => { setListening(true); setErr(""); });
      stopRef.current = rec.stop;
      window.setTimeout(() => rec.stop(), 12000);
      const blob = await rec.done;
      stopRef.current = null;
      setListening(false);
      if (!blob.size) {
        setErr(t("ai.noMic"));
        return;
      }
      const fd = new FormData();
      fd.append("audio", blob, recFileName(blob.type));
      fd.append("provider", provider);
      fd.append("fallback", fallback ? "true" : "false");
      if (tid) fd.append("tournamentId", tid);
      await ask(fd);
    } catch {
      stopRef.current = null;
      setListening(false);
      setErr(t("ai.noMic"));
    }
  }

  return (
    <>
      <button type="button" className="ai-fab" onClick={() => setOpen((v) => !v)} aria-label={t("ai.assistant")}>
        <RobotIcon light />
      </button>
      {open && (
        <div className="ai-dock">
          <div className="ai-dock-h">
            <div className="ai-dock-brand">
              <div className="ai-mini"><RobotIcon light /></div>
              <div>
                <strong>{t("ai.assistant")}</strong>
                <span className="ai-dock-sub">Kumite Arena</span>
              </div>
            </div>
            <button type="button" className="lang-btn" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="ai-dock-tools">
            <ProviderBar provider={provider} setProvider={setProvider} fallback={fallback} setFallback={setFallback} />
          </div>
          <div className="ai-dock-msgs" ref={box}>
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                <b>{m.role === "ai" ? "AI" : "Admin"}</b>
                <span className="ai-msg-text">{m.text}</span>
              </div>
            ))}
            {busy && <div className="ai-msg ai"><span className="ai-msg-text">{t("common.loading")}</span></div>}
          </div>
          {err && <p className="err" style={{ margin: "0 12px 6px" }}>{err}</p>}
          <div className="ai-dock-in">
            <button type="button" className={`lang-btn ${listening ? "ai-mic-on" : ""}`} onClick={() => void listen()} aria-label={t("ai.voice")}>🎤</button>
            <input value={text} placeholder={t("ai.placeholder")} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button type="button" className="btn btn-sm" disabled={busy} onClick={send}>{t("ai.send")}</button>
          </div>
        </div>
      )}
    </>
  );
}
