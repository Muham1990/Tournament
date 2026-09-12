import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TournamentApi } from "../services/endpoints";
import type { Tournament } from "../types";
import { TournamentCard } from "../components/TournamentCard";
import { CountryFilter, EmptyState, SearchBar } from "../components/Ui";
import { useCountries } from "../hooks/useCountries";

export function TournamentsPage() {
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();
  const when = sp.get("when") === "past" ? "past" : "upcoming";
  const q = sp.get("q") || "";
  const countryId = sp.get("country") || "";
  const [items, setItems] = useState<Tournament[]>([]);
  const { countries } = useCountries();

  useEffect(() => {
    const tmr = setTimeout(() => {
      TournamentApi.list({ when, q, countryId }).then((r) => setItems(r.data.items)).catch(() => setItems([]));
    }, 250);
    return () => clearTimeout(tmr);
  }, [when, q, countryId]);

  function patch(next: Record<string, string>) {
    const n = new URLSearchParams(sp);
    Object.entries(next).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    setSp(n);
  }

  return (
    <div className="tour-page">
      <section className="tour-hero">
        <div className="tour-hero-inner">
          <h1>{t("tournaments.title")}</h1>
          <p>{t("tournaments.lead")}</p>
          <div className="seg tour-seg">
            <button className={when === "upcoming" ? "active" : ""} onClick={() => patch({ when: "upcoming" })}>
              {t("tournaments.upcoming")}
            </button>
            <button className={when === "past" ? "active" : ""} onClick={() => patch({ when: "past" })}>
              {t("tournaments.past")}
            </button>
          </div>
        </div>
      </section>
      <div className="tour-body">
        <div className="live-panel">
          <div className="filter-bar">
            <SearchBar value={q} onChange={(v) => patch({ q: v })} placeholder={t("tournaments.search")} />
            <CountryFilter value={countryId} onChange={(v) => patch({ country: v })} countries={countries} label={t("tournaments.country")} />
          </div>
        </div>
        {items.length === 0 ? (
          <EmptyState text={t("tournaments.empty")} />
        ) : (
          <div className="t-grid">
            {items.map((it) => <TournamentCard key={it.id} item={it} />)}
          </div>
        )}
      </div>
    </div>
  );
}
