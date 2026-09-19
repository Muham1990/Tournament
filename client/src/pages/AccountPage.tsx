import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSupabaseAuth } from "../hooks/useSupabaseAuth";
import { Loading } from "../components/Ui";
import { getPendingSignupEmail } from "../lib/signupPending";

export function AccountPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user, loading, confirmed, signOut } = useSupabaseAuth();

  if (loading) return <Loading />;
  if (!user) {
    const pending = getPendingSignupEmail();
    if (pending) return <Navigate to="/confirm-email" replace state={{ email: pending }} />;
    return <Navigate to="/register" replace />;
  }
  if (!confirmed) return <Navigate to="/confirm-email" replace state={{ email: user.email || "" }} />;

  const name = String(user.user_metadata?.full_name || "").trim();

  return (
    <div className="login-page">
      <div className="center-card login-card auth-card">
        <div className="auth-badge">{t("auth.cabinet")}</div>
        <h2>{t("auth.cabinetTitle")}</h2>
        {name && <p className="auth-welcome">{name}</p>}
        <p className="login-lead">{user.email}</p>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: "100%" }}
          onClick={() => void signOut().then(() => nav("/", { replace: true }))}
        >
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}
