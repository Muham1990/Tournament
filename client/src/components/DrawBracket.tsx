import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Fight, Participant } from "../types";
import { mediaUrl } from "../lib/config";
import { ConfirmModal } from "./Ui";

function Slot({
  n, p, bye, fight, admin, onPick,
}: {
  n: number;
  p?: Participant | null;
  bye: boolean;
  fight: Fight;
  admin: boolean;
  onPick: (p: Participant) => void;
}) {
  const { t } = useTranslation();
  const isWin = p && fight.winnerId === p.id;
  const isLose = p && fight.loserId === p.id;
  const name = p ? `${p.firstName} ${p.lastName}` : bye ? t("draw.bye") : "—";
  return (
    <button
      id={`fight-${fight.id}-p${n}`}
      className={`slot ${isWin ? "win" : ""} ${isLose ? "lose" : ""} ${bye && !p ? "bye" : ""}`}
      disabled={!admin || !p || fight.status === "BYE"}
      onClick={() => p && onPick(p)}
    >
      <span className="num">{n}</span>
      {p?.photoUrl ? <img src={mediaUrl(p.photoUrl)} alt="" /> : <div className="avatar" />}
      <div className="slot-main">
        <div className="slot-fio">{name}</div>
        <div className="slot-sub">
          {p?.country?.flag && <span>{p.country.flag}</span>}
          {p?.country?.code && <span className="slot-cc">{p.country.code}</span>}
          {isWin && <span className="winner-tag">{fight.status === "BYE" ? t("draw.advancedBye") : t("draw.winner")}</span>}
          {isLose && <span className="elim-tag">{t("draw.eliminated")}</span>}
        </div>
      </div>
    </button>
  );
}

function TrophyCup() {
  return (
    <svg className="cup-svg" viewBox="0 0 64 64" aria-hidden>
      <path d="M16 10h32v10c0 10-7 18-16 18S16 30 16 20V10z" fill="url(#cupGold)" />
      <path d="M16 12h-8c0 10 5 16 12 18" fill="none" stroke="#e6a100" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 12h8c0 10-5 16-12 18" fill="none" stroke="#e6a100" strokeWidth="4" strokeLinecap="round" />
      <rect x="28" y="38" width="8" height="8" rx="1" fill="#f5c542" />
      <path d="M20 54h24l-3-8H23l-3 8z" fill="#d4a017" />
      <ellipse cx="32" cy="54" rx="14" ry="3" fill="#c4920f" />
      <defs>
        <linearGradient id="cupGold" x1="16" y1="8" x2="48" y2="40">
          <stop offset="0" stopColor="#ffe082" />
          <stop offset="0.5" stopColor="#ffc107" />
          <stop offset="1" stopColor="#f9a825" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function FightCard({
  fight, admin, onOpen, onPickWinner, byeA, byeB, displayNo,
}: {
  fight: Fight;
  admin: boolean;
  onOpen: (f: Fight) => void;
  onPickWinner: (f: Fight, p: Participant) => void;
  byeA?: boolean;
  byeB?: boolean;
  displayNo?: number;
}) {
  const { t } = useTranslation();
  const labelNo = displayNo ?? fight.fightNumber;
  const final = !fight.nextFightId && !fight.isThirdPlace;
  const label = fight.isThirdPlace
    ? `${t("draw.fight")} #${labelNo}`
    : final
      ? `${t("draw.fight")} #${labelNo} · FINAL`
      : `${t("draw.fight")} #${labelNo}`;
  return (
    <div className="fight-block">
      <div className="fight-no">{label}</div>
      <div className={`fight-card ${fight.status === "LIVE" ? "live" : ""}`} id={`fight-${fight.id}`}>
        <div onDoubleClick={() => onOpen(fight)}>
          <Slot n={1} p={fight.participantA} bye={byeA ?? fight.slotABye} fight={fight} admin={admin} onPick={(p) => onPickWinner(fight, p)} />
          <Slot n={2} p={fight.participantB} bye={byeB ?? fight.slotBBye} fight={fight} admin={admin} onPick={(p) => onPickWinner(fight, p)} />
        </div>
      </div>
    </div>
  );
}

function hasAthlete(f: Fight) {
  return Boolean(f.participantAId || f.participantA || f.participantBId || f.participantB || f.winnerId);
}

/** BYE vs BYE and later empty cards that nobody can reach. */
function emptyBranchIds(fights: Fight[]) {
  const feeders = new Map<string, Fight[]>();
  for (const f of fights) {
    if (!f.nextFightId) continue;
    const arr = feeders.get(f.nextFightId) ?? [];
    arr.push(f);
    feeders.set(f.nextFightId, arr);
  }
  const dead = new Set<string>();
  const visit = (f: Fight): boolean => {
    if (dead.has(f.id)) return true;
    if (hasAthlete(f)) return false;
    const src = feeders.get(f.id) ?? [];
    const empty = src.length === 0
      ? Boolean(f.slotABye && f.slotBBye)
      : src.every(visit);
    if (empty) dead.add(f.id);
    return empty;
  };
  for (const f of fights) visit(f);
  return dead;
}

function groupPairs(list: Fight[]) {
  const map = new Map<string, Fight[]>();
  const rest: Fight[] = [];
  for (const f of list) {
    if (!f.nextFightId) {
      rest.push(f);
      continue;
    }
    const arr = map.get(f.nextFightId) ?? [];
    arr.push(f);
    map.set(f.nextFightId, arr);
  }
  const pairs = [...map.values()];
  if (rest.length) pairs.push(rest);
  return pairs.length ? pairs : [list];
}

function BracketLines({
  fights, zoom, host,
}: {
  fights: Fight[];
  zoom: number;
  host: HTMLDivElement | null;
}) {
  const [paths, setPaths] = useState<Array<{ d: string; kind: "won" | "lose" | "idle"; id: string }>>([]);
  const [box, setBox] = useState({ w: 1, h: 1 });

  useLayoutEffect(() => {
    if (!host) return;
    const draw = () => {
      const z = zoom || 1;
      const root = host.getBoundingClientRect();
      const next: Array<{ d: string; kind: "won" | "lose" | "idle"; id: string }> = [];
      const xy = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: (r.right - root.left) / z,
          y: (r.top + r.height / 2 - root.top) / z,
          left: (r.left - root.left) / z,
        };
      };
      for (const f of fights) {
        if (!f.nextFightId) continue;
        const p1 = xy(document.getElementById(`fight-${f.id}-p1`));
        const p2 = xy(document.getElementById(`fight-${f.id}-p2`));
        const destEl = document.getElementById(
          f.nextSlot === "B" ? `fight-${f.nextFightId}-p2` : `fight-${f.nextFightId}-p1`,
        ) || document.getElementById(`fight-${f.nextFightId}`);
        const dest = xy(destEl);
        if (!dest || (!p1 && !p2)) continue;
        const a = p1 || p2!;
        const b = p2 || p1!;
        const joinX = Math.max(a.x, b.x) + 22;
        const joinY = p1 && p2 ? (p1.y + p2.y) / 2 : a.y;
        const midX = joinX + Math.max(16, (dest.left - joinX) * 0.5);
        const xN = dest.left;
        const yN = dest.y;
        const idA = f.participantAId || f.participantA?.id;
        const idB = f.participantBId || f.participantB?.id;
        const winA = Boolean(f.winnerId && idA === f.winnerId);
        const winB = Boolean(f.winnerId && idB === f.winnerId);
        const kindA: "won" | "lose" | "idle" = f.winnerId ? (winA ? "won" : "lose") : "idle";
        const kindB: "won" | "lose" | "idle" = f.winnerId ? (winB ? "won" : "lose") : "idle";
        if (p1) next.push({ id: `${f.id}-a`, kind: kindA, d: `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} H ${joinX.toFixed(1)} V ${joinY.toFixed(1)}` });
        if (p2) next.push({ id: `${f.id}-b`, kind: kindB, d: `M ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} H ${joinX.toFixed(1)} V ${joinY.toFixed(1)}` });
        next.push({
          id: `${f.id}-out`,
          kind: f.winnerId ? "won" : "idle",
          d: `M ${joinX.toFixed(1)} ${joinY.toFixed(1)} H ${midX.toFixed(1)} V ${yN.toFixed(1)} H ${xN.toFixed(1)}`,
        });
      }
      setPaths(next);
      setBox({ w: Math.max(host.offsetWidth, 1), h: Math.max(host.offsetHeight, 1) });
    };
    draw();
    const later = window.setTimeout(draw, 80);
    const ro = new ResizeObserver(() => requestAnimationFrame(draw));
    ro.observe(host);
    window.addEventListener("resize", draw);
    return () => {
      window.clearTimeout(later);
      ro.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [fights, zoom, host]);

  if (!paths.length) return null;
  return (
    <svg className="bracket-lines" width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden>
      {paths.map((p) => (
        <path key={p.id} d={p.d} className={p.kind} pathLength={1} fill="none" />
      ))}
    </svg>
  );
}

export function DrawBracket({
  fights, admin, onOpenFight, onConfirmWinner,
}: {
  fights: Fight[];
  admin: boolean;
  onOpenFight: (f: Fight) => void;
  onConfirmWinner: (fightId: string, winnerId: string, confirmChange?: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const [innerEl, setInnerEl] = useState<HTMLDivElement | null>(null);
  const [pending, setPending] = useState<{ fight: Fight; p: Participant } | null>(null);
  const dragging = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

  const visible = useMemo(() => {
    const dead = emptyBranchIds(fights);
    return fights.filter((f) => !dead.has(f.id));
  }, [fights]);

  const deadIncoming = useMemo(() => {
    const dead = emptyBranchIds(fights);
    const map = new Map<string, { A: boolean; B: boolean }>();
    for (const f of fights) {
      if (!f.nextFightId || !dead.has(f.id)) continue;
      const cur = map.get(f.nextFightId) ?? { A: false, B: false };
      if (f.nextSlot === "B") cur.B = true;
      else cur.A = true;
      map.set(f.nextFightId, cur);
    }
    return map;
  }, [fights]);

  const displayNo = useMemo(() => {
    const map = new Map<string, number>();
    [...visible].sort((a, b) => a.fightNumber - b.fightNumber).forEach((f, i) => map.set(f.id, i + 1));
    return map;
  }, [visible]);

  const rounds = useMemo(() => {
    const map = new Map<string, Fight[]>();
    for (const f of visible) {
      const key = f.isThirdPlace ? "THIRD PLACE" : f.roundName;
      const arr = map.get(key) ?? [];
      arr.push(f);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [visible]);

  function fit() {
    const el = scroller.current;
    if (!el) return;
    const need = 268 * rounds.length + 80 * (rounds.length - 1) + 48;
    setZoom(Math.min(1, el.clientWidth / need));
  }

  const champion = useMemo(() => {
    const f = fights.find((x) => !x.nextFightId && !x.isThirdPlace && x.winnerId);
    if (!f) return null;
    const p = f.winner || (f.winnerId === f.participantA?.id ? f.participantA : f.participantB);
    return p ? { fight: f, p } : null;
  }, [fights]);

  function showCurrent() {
    const live = fights.find((f) => f.status === "LIVE") || fights.find((f) => f.status === "READY");
    if (!live) return;
    document.getElementById(`fight-${live.id}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }

  return (
    <div>
      <div className="bracket-toolbar">
        <button className="btn btn-ghost" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="btn btn-ghost" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}>+</button>
        <button className="btn btn-ghost" onClick={fit}>{t("draw.fit")}</button>
        <button className="btn btn-ghost" onClick={showCurrent}>{t("draw.current")}</button>
      </div>
      <div
        className="bracket-scroller"
        ref={scroller}
        onMouseDown={(e) => {
          dragging.current = { x: e.clientX, y: e.clientY, sl: scroller.current!.scrollLeft, st: scroller.current!.scrollTop };
        }}
        onMouseMove={(e) => {
          if (!dragging.current || !scroller.current) return;
          scroller.current.scrollLeft = dragging.current.sl - (e.clientX - dragging.current.x);
          scroller.current.scrollTop = dragging.current.st - (e.clientY - dragging.current.y);
        }}
        onMouseUp={() => { dragging.current = null; }}
        onMouseLeave={() => { dragging.current = null; }}
      >
        {champion && (
          <div className="champ-float">
            <TrophyCup />
            <div>
              <b>{t("draw.winner")}</b>
              <span>{champion.p.firstName} {champion.p.lastName}</span>
            </div>
          </div>
        )}
        <div className="bracket-inner" ref={setInnerEl} style={{ transform: `scale(${zoom})` }}>
          <BracketLines fights={visible} zoom={zoom} host={innerEl} />
          {rounds.map(([name, list], ri) => {
            const last = ri === rounds.length - 1 || list.every((f) => !f.nextFightId);
            const pairs = groupPairs(list);
            return (
              <div className={`round ${last ? "round-final" : ""}`} key={name}>
                {!last && <h4 className="round-title">{name}</h4>}
                <div className="round-body">
                  {pairs.map((pair) => (
                    <div className={`pair ${pair.length < 2 ? "pair-one" : ""}`} key={pair.map((f) => f.id).join("-")}>
                      {pair.map((f) => (
                        <div className={`fight-wrap ${f.nextFightId ? "" : "no-out"}`} key={f.id}>
                          {last && <h4 className="round-title">{name}</h4>}
                          <FightCard
                            fight={f}
                            admin={admin}
                            onOpen={onOpenFight}
                            onPickWinner={(fight, p) => setPending({ fight, p })}
                            byeA={deadIncoming.get(f.id)?.A}
                            byeB={deadIncoming.get(f.id)?.B}
                            displayNo={displayNo.get(f.id)}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {pending && (
        <ConfirmModal
          title={t("draw.confirmWin")}
          text={`${pending.p.firstName} ${pending.p.lastName}`}
          confirmLabel={t("draw.confirmVictory")}
          cancelLabel={t("draw.cancel")}
          onClose={() => setPending(null)}
          onConfirm={async () => {
            const change = pending.fight.status === "FINISHED";
            await onConfirmWinner(pending.fight.id, pending.p.id, change);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
