import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Fight } from "../types";
import { Modal } from "./Ui";
import { FightApi } from "../services/endpoints";
import { fmtDate } from "../utils";
import { mediaUrl } from "../lib/config";

export function FightControl({
  fight, onClose, onChanged, admin,
}: { fight: Fight; onClose: () => void; onChanged: () => void; admin: boolean }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const a = fight.participantA;
  const b = fight.participantB;

  return (
    <Modal title={`${t("draw.fight")} #${fight.fightNumber}`} onClose={onClose}>
      <p>{fight.tatami?.name || "Tatami"} · {fight.scheduledAt ? fmtDate(fight.scheduledAt) : ""} · {fight.status}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
        <AthleteSide p={a} />
        <strong>{t("draw.vs")}</strong>
        <AthleteSide p={b} />
      </div>
      {admin && (
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy || fight.status === "LIVE" || fight.status === "FINISHED"} onClick={() => run(() => FightApi.start(fight.id))}>{t("draw.start")}</button>
          <button className="btn" disabled={busy || !a} onClick={() => setConfirm(a!.id)}>{t("draw.winA")}</button>
          <button className="btn" disabled={busy || !b} onClick={() => setConfirm(b!.id)}>{t("draw.winB")}</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => FightApi.special(fight.id, { type: "DISQUALIFICATION", side: "A" }))}>{t("draw.dqA")}</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => FightApi.special(fight.id, { type: "DISQUALIFICATION", side: "B" }))}>{t("draw.dqB")}</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => FightApi.special(fight.id, { type: "NO_SHOW", side: "A" }))}>{t("draw.nsA")}</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => FightApi.special(fight.id, { type: "NO_SHOW", side: "B" }))}>{t("draw.nsB")}</button>
          {fight.status === "FINISHED" && (
            <button className="btn btn-danger" onClick={() => setConfirm(fight.winnerId === a?.id ? b?.id ?? null : a?.id ?? null)}>{t("draw.change")}</button>
          )}
        </div>
      )}
      {confirm && (
        <div style={{ marginTop: 12 }}>
          <p>{t("draw.confirmWin")}</p>
          {fight.status === "FINISHED" && <p className="err">{t("draw.changeWarn")}</p>}
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>{t("draw.cancel")}</button>
            <button className="btn" onClick={() => run(() => FightApi.result(fight.id, { winnerId: confirm, confirmChange: fight.status === "FINISHED" })).then(() => setConfirm(null))}>{t("draw.confirm")}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AthleteSide({ p }: { p?: Fight["participantA"] }) {
  if (!p) return <div>—</div>;
  return (
    <div className="ath">
      {p.photoUrl ? <img src={mediaUrl(p.photoUrl)} alt="" /> : <div className="avatar" />}
      <div>
        <div className="name">{p.firstName} {p.lastName}</div>
        <div className="flag">{p.country?.flag} {p.country?.nameRu}</div>
        <div className="flag">{p.club?.name} {p.weight ? `· ${p.weight} kg` : ""}</div>
      </div>
    </div>
  );
}
