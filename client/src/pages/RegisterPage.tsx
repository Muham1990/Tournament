import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isEmailConfirmed, useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { supabaseAuthMessage } from "../lib/supabaseAuthErrors";
import { markSignupEmailSent, setPendingSignupEmail } from "../lib/signupPending";
import { Loading } from "../components/Ui";
import { AuthField, IconLock, IconMail, IconPerson } from "../components/AuthFields";

function EyeOn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A3 3 0 0012 15a3 3 0 002.4-4.4" />
      <path d="M9.9 5.1A11 11 0 0112 5c6.2 0 10 7 10 7a18 18 0 01-4.2 4.8" />
      <path d="M6.1 6.1C3.5 8 2 12 2 12s3.8 7 10 7a11 11 0 004.1-.8" />
    </svg>
  );
}

export function RegisterPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user, confirmed, loading, signUp } = useSupabaseAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (confirmed) return <Navigate to="/account" replace />;
  if (user) return <Navigate to="/confirm-email" replace state={{ email: user.email || "" }} />;

  async function submit() {
    if (busy) return;
    setErr("");
    const fullName = name.trim();
    const mail = email.trim();
    if (!fullName || !mail || !password) {
      setErr(t("auth.fill"));
      return;
    }
    setBusy(true);
    try {
      const created = await signUp(mail, password, fullName);
      setPendingSignupEmail(mail);
      markSignupEmailSent();
      if (isEmailConfirmed(created)) {
        nav("/account", { replace: true });
        return;
      }
      nav("/confirm-email", { replace: true, state: { email: mail } });
    } catch (e) {
      setErr(supabaseAuthMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="center-card login-card auth-card">
        <div className="auth-badge">{t("auth.register")}</div>
        <h2>{t("auth.registerTitle")}</h2>
        <p className="login-lead">{t("auth.registerLead")}</p>
        <div className="auth-fields">
          <AuthField label={t("auth.name")} icon={<IconPerson />} value={name} onChange={setName} autoComplete="name" onEnter={() => void submit()} />
          <AuthField label={t("auth.email")} icon={<IconMail />} type="email" value={email} onChange={setEmail} autoComplete="email" onEnter={() => void submit()} />
          <AuthField
            label={t("auth.password")}
            icon={<IconLock />}
            type={showPass ? "text" : "password"}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            onEnter={() => void submit()}
            extra={(
              <button
                type="button"
                className="auth-eye"
                aria-label={showPass ? t("auth.hidePass") : t("auth.showPass")}
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? <EyeOff /> : <EyeOn />}
              </button>
            )}
          />
        </div>
        {err && <p className="err">{err}</p>}
        <button type="button" className="btn auth-submit" disabled={busy} onClick={() => void submit()}>
          {busy ? "..." : t("auth.registerSubmit")}
        </button>
        <p className="login-lead auth-alt">
          <Link to="/confirm-email">{t("auth.haveCode")}</Link>
        </p>
      </div>
    </div>
  );
}
