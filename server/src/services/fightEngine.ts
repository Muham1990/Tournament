import { generateDraw, type DrawMode, type DrawParticipant } from "./drawEngine.js";

export interface FightLike {
  id: string;
  fightNumber: number;
  round: number;
  roundName: string;
  isThirdPlace: boolean;
  participantAId: string | null;
  participantBId: string | null;
  winnerId: string | null;
  loserId: string | null;
  nextFightId: string | null;
  nextSlot: "A" | "B" | null;
  status: string;
  slotABye: boolean;
  slotBBye: boolean;
}

export function resolveWinnerLoser(
  fight: { participantAId: string | null; participantBId: string | null },
  winnerId: string,
): { winnerId: string; loserId: string | null } {
  const { participantAId, participantBId } = fight;
  if (winnerId !== participantAId && winnerId !== participantBId) {
    throw new Error("WINNER_NOT_IN_FIGHT");
  }
  const loserId = winnerId === participantAId ? participantBId : participantAId;
  return { winnerId, loserId };
}

export function nextSlotField(slot: "A" | "B"): "participantAId" | "participantBId" {
  return slot === "A" ? "participantAId" : "participantBId";
}

export function canChangeResult(fight: FightLike, all: FightLike[]): boolean {
  if (!fight.winnerId) return false;
  if (!fight.nextFightId) return true;
  const next = all.find((f) => f.id === fight.nextFightId);
  if (!next) return true;
  return next.status !== "LIVE" && next.status !== "FINISHED";
}

export function collectDownstream(fightId: string, all: FightLike[]): FightLike[] {
  const byId = new Map(all.map((f) => [f.id, f]));
  const out: FightLike[] = [];
  const visit = (id: string) => {
    const f = byId.get(id);
    if (!f?.nextFightId) return;
    const next = byId.get(f.nextFightId);
    if (!next) return;
    out.push(next);
    visit(next.id);
  };
  visit(fightId);
  return out;
}

export { generateDraw, type DrawMode, type DrawParticipant };
