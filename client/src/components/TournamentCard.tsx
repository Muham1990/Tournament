import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Tournament } from "../types";
import { fmtDate } from "../utils";
import { mediaUrl } from "../lib/config";

export function TournamentCard({ item }: { item: Tournament }) {
  const { t } = useTranslation();
  return (
    <Link to={`/tournament/${item.id}`} className="t-card">
      <div className="t-card-media">
        {item.imageUrl ? <img src={mediaUrl(item.imageUrl)} alt="" loading="lazy" /> : <div className="ph" />}
        <span className={`t-status ${item.status}`}>{t(`status.${item.status}`, { defaultValue: item.status })}</span>
      </div>
      <div className="t-card-body">
        <h3>{item.title}</h3>
        <div className="t-card-meta">
          <span>{item.country?.flag} {item.country?.nameRu || item.city || "—"}</span>
          <span className="date">📅 {fmtDate(item.dateStart)}</span>
        </div>
        <span className="t-open">{t("tournaments.open")} →</span>
      </div>
    </Link>
  );
}
