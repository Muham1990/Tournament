import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../hooks/useSettings";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { canSeeAdminEntry } from "../lib/adminGate";
import { ADMIN_LINKS } from "../lib/adminNav";
import { mediaUrl } from "../lib/config";

const NAV = [
  ["/tournaments", "nav.tournaments"],
  ["/pricing", "nav.pricing"],
  ["/contacts", "nav.contacts"],
  ["/live", "nav.live"],
] as const;

export function Header() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const settings = useSettings();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });
  const showBack = loc.pathname !== "/";
  const showAdmin = Boolean(user) || canSeeAdminEntry();
  const inAdmin = loc.pathname.startsWith("/admin");

  function goBack() {
    if (loc.pathname.startsWith("/admin/tournament")) nav("/admin/tournaments");
    else if (loc.pathname.startsWith("/admin/tournaments/") && loc.pathname !== "/admin/tournaments/new") nav("/admin/tournaments");
    else if (loc.pathname.startsWith("/tournament")) nav("/tournaments");
    else if (window.history.length > 1) nav(-1);
    else nav("/");
  }

  useLayoutEffect(() => {
    const root = navRef.current;
    if (!root) return;
    const move = () => {
      const active = root.querySelector("a.active") as HTMLElement | null;
      if (!active) {
        setPill((p) => ({ ...p, width: 0, ready: false }));
        return;
      }
      setPill({ left: active.offsetLeft, width: active.offsetWidth, ready: true });
    };
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [loc.pathname]);

  return (
    <header className={`header ${open ? "open" : ""}`}>
      <div className="header-inner">
        <div className="header-left">
          {showBack && (
            <button className="back-btn" type="button" onClick={goBack} aria-label={t("nav.back")} title={t("nav.back")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <NavLink to="/" className="logo" onClick={() => setOpen(false)}>
            <img src={mediaUrl(settings?.logoUrl) || "/logo.svg"} alt="" className="logo-mark" />
            <div className="logo-text">
              <strong className="brand-lockup">
                <span className="brand-a">Kumite</span>
                <span className="brand-b">Arena</span>
              </strong>
            </div>
          </NavLink>
        </div>
        <nav className="nav" ref={navRef}>
          <span
            className={`nav-pill ${pill.ready ? "on" : ""}`}
            style={{ transform: `translateX(${pill.left}px)`, width: pill.width }}
          />
          {NAV.map(([to, key]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="header-right">
          {showAdmin && (user ? (
            <button className="login-link" onClick={() => nav("/admin")}>
              <UserIco /> <span className="login-text">{t("nav.admin")}</span>
            </button>
          ) : (
            <NavLink to="/login" className="login-link">
              <UserIco /> <span className="login-text">{t("nav.login")}</span>
            </NavLink>
          ))}
          <LanguageSwitcher />
          {user && (
            <button className="lang-btn logout-desk" onClick={() => logout().then(() => nav("/"))}>
              {t("nav.logout")}
            </button>
          )}
          <button className="burger" onClick={() => setOpen((v) => !v)} aria-label="menu">☰</button>
        </div>
      </div>
      <nav className="mobile-nav">
        {inAdmin
          ? ADMIN_LINKS.map(([to, key]) => (
            <NavLink key={key} to={to ? `/admin/${to}` : "/admin"} end={!to} onClick={() => setOpen(false)}>
              {t(key)}
            </NavLink>
          ))
          : NAV.map(([to, key]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>{t(key)}</NavLink>
          ))}
        {showAdmin && user && (
          <>
            {!inAdmin && <NavLink to="/admin" onClick={() => setOpen(false)}>{t("nav.admin")}</NavLink>}
            <button className="lang-btn" onClick={() => logout().then(() => { setOpen(false); nav("/"); })}>{t("nav.logout")}</button>
          </>
        )}
        {showAdmin && !user && (
          <NavLink to="/login" onClick={() => setOpen(false)}>{t("nav.login")}</NavLink>
        )}
      </nav>
    </header>
  );
}

function UserIco() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19c1.5-3.2 4-5 7-5s5.5 1.8 7 5" />
    </svg>
  );
}

export function Footer() {
  const settings = useSettings();
  return (
    <footer className="site">
      © {new Date().getFullYear()} {settings?.siteName || "Kumite Arena"}
    </footer>
  );
}
