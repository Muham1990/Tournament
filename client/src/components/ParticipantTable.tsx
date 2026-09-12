import { useTranslation } from "react-i18next";
import type { Participant } from "../types";
import { mediaUrl } from "../lib/config";

export function ParticipantTable({
  items, total, onRow, onDelete,
}: {
  items: Participant[];
  total: number;
  onRow?: (p: Participant) => void;
  onDelete?: (p: Participant) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="part-table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>{t("p.n")}</th>
            <th>{t("p.athlete")} <span className="badge">{total}</span></th>
            <th>{t("p.category")}</th>
            <th>{t("p.age")}</th>
            <th>{t("p.rank")}</th>
            <th>{t("p.school")}</th>
            {onDelete && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={p.id} onClick={() => onRow?.(p)} style={{ cursor: onRow ? "pointer" : "default" }}>
              <td>{i + 1}</td>
              <td>
                <div className="ath">
                  {p.photoUrl ? <img src={mediaUrl(p.photoUrl)} alt="" loading="lazy" /> : <div className="avatar" />}
                  <div>
                    <div className="name">{p.firstName} {p.lastName}</div>
                    <div className="flag">{p.country?.flag} {p.country?.nameRu}</div>
                  </div>
                </div>
              </td>
              <td><span className="linkish">{p.category?.name || "—"}</span></td>
              <td>{p.age ?? "—"}</td>
              <td>{p.rank || p.belt || "—"}</td>
              <td>{p.school || p.club?.name || "—"}</td>
              {onDelete && (
                <td>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={(e) => { e.stopPropagation(); onDelete(p); }}
                  >
                    {t("p.remove")}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
