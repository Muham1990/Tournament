import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { supabaseAuthMessage } from "../lib/supabaseAuthErrors";
import { Loading } from "../components/Ui";
import { AuthField, IconMail, OTP_LEN, OtpBoxes } from "../components/AuthFields";
import {
  clearPendingSignup,
  getPendingSignupEmail,
  markSignupEmailSent,
  setPendingSignupEmail,
  signupResendWaitSec,
} from "../lib/signupPending";

export function ConfirmEmailPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const { user, confirmed, loading, verifySignup, resendSignup } = useSupabaseAuth();
  const fromState = (loc.state as { email?: string } | null)?.email || "";
  const [email, setEmail] = useState(fromState || user?.email || getPendingSignupEmail());
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(signupResendWaitSec);
  const inflight = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait(signupResendWaitSec()), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  if (loading) return <Loading />;
  if (confirmed) return <Navigate to="/account" replace />;

  async function confirm(code = token) {
    if (busy || inflight.current) return;
    setErr("");
    setInfo("");
    const mail = email.trim();
    const otp = code.replace(/\D/g, "");
    if (!mail || otp.length !== OTP_LEN) {
      setErr(t("auth.fillCode"));
      return;
    }
    inflight.current = true;
    setBusy(true);
    try {
      await verifySignup(mail, otp);
      clearPendingSignup();
      nav("/account", { replace: true });
    } catch (e) {
      setErr(supabaseAuthMessage(e, t));
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || wait > 0) return;
    setErr("");
    setInfo("");
    const mail = email.trim();
    if (!mail) {
      setErr(t("auth.fill"));
      return;
    }
    setBusy(true);
    try {
      await resendSignup(mail);
      markSignupEmailSent();
      setWait(signupResendWaitSec());
      setInfo(t("auth.resent"));
    } catch (e) {
      setErr(supabaseAuthMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="center-card login-card auth-card">
        <div className="auth-badge">{t("auth.code")}</div>
        <h2>{t("auth.checkTitle")}</h2>
        <p className="login-lead">{t("auth.checkLead")}</p>
        <p className="muted">{t("auth.checkSpam")}</p>
        <div className="auth-fields">
          <AuthField
            label={t("auth.email")}
            icon={<IconMail />}
            type="email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              setPendingSignupEmail(v.trim());
            }}
            autoComplete="email"
          />
        </div>
        <p className="otp-caption">{t("auth.code")}</p>
        <OtpBoxes value={token} onChange={setToken} disabled={busy} onComplete={(code) => void confirm(code)} />
        {err && <p className="err">{err}</p>}
        {info && <p className="muted">{info}</p>}
        <button type="button" className="btn auth-submit" disabled={busy || token.length !== OTP_LEN} onClick={() => void confirm()}>
          {busy ? "..." : t("auth.confirm")}
        </button>
        <button
          type="button"
          className="btn btn-ghost auth-submit"
          disabled={busy || wait > 0}
          onClick={() => void resend()}
        >
          {wait > 0 ? t("auth.resendWait", { sec: wait }) : t("auth.resend")}
        </button>
      </div>
    </div>
  );
}
