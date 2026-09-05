import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function HomePage() {
  const { t } = useTranslation();
  const features = [
    ["🥋", "home.f1t", "home.f1d"],
    ["👥", "home.f2t", "home.f2d"],
    ["📋", "home.f3t", "home.f3d"],
    ["🏆", "home.f4t", "home.f4d"],
    ["📡", "home.f5t", "home.f5d"],
    ["🥇", "home.f6t", "home.f6d"],
  ] as const;
  return (
    <>
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-inner">
          <span className="hero-badge">Kumite Arena</span>
          <h1>
            <span className="l1">{t("home.hero1")} 🥋</span>
            <span className="l2">{t("home.hero2")} 🏆</span>
          </h1>
          <p>{t("home.sub")}</p>
          <div className="hero-actions">
            <Link to="/tournaments" className="btn-cta">{t("home.cta")}</Link>
            <Link to="/live" className="btn-cta ghost">{t("nav.live")}</Link>
          </div>
        </div>
      </section>
      <section className="features">
        <div className="container features-grid">
          {features.map(([ico, title, desc]) => (
            <article key={title} className="feature-card">
              <div className="ico">{ico}</div>
              <h3>{t(title)}</h3>
              <p>{t(desc)}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
