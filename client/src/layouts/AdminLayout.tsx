import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Header } from "../components/Header";
import { useAuth } from "../hooks/useAuth";
import { Loading } from "../components/Ui";
import { AiAssistantDock } from "../components/AiFeatures";
import { ADMIN_LINKS } from "../lib/adminNav";

export function AdminLayout() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  return (
    <div className="admin-shell">
      <Header />
      <div className="admin">
        <aside className="sidebar">
          {ADMIN_LINKS.map(([to, key]) => (
            <NavLink key={key} to={to ? `/admin/${to}` : "/admin"} end={!to}>
              {t(key)}
            </NavLink>
          ))}
        </aside>
        <div className="admin-main"><Outlet /></div>
      </div>
      <nav className="admin-bottom">
        <NavLink to="/admin" end>{t("admin.dashboard")}</NavLink>
        <NavLink to="/admin/tournaments">{t("admin.tournaments")}</NavLink>
        <NavLink to="/admin/settings">{t("admin.settings")}</NavLink>
      </nav>
      <AiAssistantDock />
    </div>
  );
}
