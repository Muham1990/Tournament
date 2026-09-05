import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { canSeeAdminEntry } from "../lib/adminGate";
import { useTranslation } from "react-i18next";
import { MiscApi } from "../services/endpoints";
import { useSettings } from "../hooks/useSettings";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";
import { mediaUrl } from "../lib/config";

export function ContactsPage() {
  const { t } = useTranslation();
  const settings = useSettings();
  const toast = useToast();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", body: "" });
  const [err, setErr] = useState("");

  async function send() {
    setErr("");
    try {
      await MiscApi.sendMessage(form);
      toast.show(t("contacts.sent"));
      setForm({ firstName: "", lastName: "", email: "", phone: "", body: "" });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error || "Error");
    }
  }

  return (
    <div className="contacts-page">
      <section className="contacts-hero">
        <h1>{t("contacts.title")}</h1>
        <p className="lead">{t("contacts.lead")}</p>
      </section>
      <div className="container contacts-body">
        <div className="contact-grid">
          <a className="contact-btn" href={settings?.email ? `mailto:${settings.email}` : undefined}>
            <div className="circle">✉</div>
            <div className="lbl">{t("contacts.write")}</div>
            <div className="val">{settings?.email || "—"}</div>
          </a>
          <a className="contact-btn" href={settings?.phone ? `tel:${settings.phone.replace(/\s/g, "")}` : undefined}>
            <div className="circle">☎</div>
            <div className="lbl">{t("contacts.call")}</div>
            <div className="val">{settings?.phone || "—"}</div>
          </a>
          <a
            className="contact-btn alt"
            href={settings?.location ? `https://maps.google.com/?q=${encodeURIComponent(settings.location)}` : undefined}
            target="_blank"
            rel="noreferrer"
          >
            <div className="circle">📍</div>
            <div className="lbl">{t("contacts.map")}</div>
            <div className="val">{settings?.location || "—"}</div>
          </a>
        </div>
        <div className="form-card">
          <h2>{t("contacts.form")}</h2>
          <div className="form-grid">
            <label className="field">{t("contacts.first")} *<input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
            <label className="field">{t("contacts.last")} *<input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
            <label className="field">{t("contacts.email")} *<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="field">{t("contacts.phone")}<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="field span-2">{t("contacts.message")} *<textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
          </div>
          {err && <p className="err">{err}</p>}
          <div style={{ marginTop: 16 }}><button className="btn btn-hot" onClick={() => void send()}>{t("contacts.send")}</button></div>
        </div>
      </div>
    </div>
  );
}

export function PricingPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Array<{ id: string; name: string; price: string; description?: string; features: string[]; highlighted: boolean }>>([]);
  useEffect(() => { MiscApi.pricing().then((r) => setItems(r.data.items)); }, []);
  return (
    <div className="price-page">
      <section className="price-hero">
        <div className="price-hero-inner">
          <h1>{t("pricing.title")}</h1>
          <p>{t("pricing.lead")}</p>
        </div>
      </section>
      <div className="price-body">
        <div className="pricing-grid">
          {items.map((p) => (
            <article key={p.id} className={`price-card ${p.highlighted ? "hi" : ""}`}>
              {p.highlighted && <span className="price-badge">{t("pricing.popular")}</span>}
              <h3>{p.name}</h3>
              <div className="price">
                {p.price} <small>{t("pricing.currency")} {t("pricing.month")}</small>
              </div>
              {p.description && <p>{p.description}</p>}
              <ul>
                {p.features.map((f) => (
                  <li key={f}><span>✓</span>{f}</li>
                ))}
              </ul>
              <Link to="/contacts" className={`btn ${p.highlighted ? "" : "btn-ghost"}`}>{t("pricing.choose")}</Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login, user } = useAuth();
  const settings = useSettings();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user && !canSeeAdminEntry()) return <Navigate to="/" replace />;
  async function submit() {
    if (busy) return;
    setErr("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      nav("/admin", { replace: true });
    } catch (e: unknown) {
      const ax = e as { code?: string; response?: { data?: { error?: string } } };
      if (ax.code === "ECONNABORTED" || ax.code === "ERR_NETWORK") {
        setErr("Сервер не отвечает. Подождите, пока kumite-arena-server станет Online.");
      } else {
        setErr(ax.response?.data?.error || t("login.error"));
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="center-card login-card">
        <img src={mediaUrl(settings?.logoUrl) || "/logo.svg"} alt="" className="login-logo" />
        <h2>{t("login.title")}</h2>
        <p className="login-lead">{t("login.lead")}</p>
        <label className="field">{t("login.email")}<input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" onKeyDown={(e) => e.key === "Enter" && void submit()} /></label>
        <label className="field" style={{ marginTop: 12 }}>{t("login.password")}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && void submit()} /></label>
        {err && <p className="err">{err}</p>}
        <button type="button" className="btn" style={{ marginTop: 20, width: "100%" }} disabled={busy} onClick={() => void submit()}>{busy ? "..." : t("login.submit")}</button>
      </div>
    </div>
  );
}
