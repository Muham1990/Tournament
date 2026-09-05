export type DrawMode = "RANDOM" | "SEEDED" | "CLUB_SEPARATION" | "COUNTRY_SEPARATION";

export interface DrawParticipant {
  id: string;
  clubId?: string | null;
  countryId?: string | null;
  seed?: number | null;
}

export interface GeneratedFight {
  round: number;
  roundName: string;
  fightNumber: number;
  isThirdPlace: boolean;
  participantAId: string | null;
  participantBId: string | null;
  slotABye: boolean;
  slotBBye: boolean;
  status: "WAITING" | "BYE";
  winnerId: string | null;
  loserId: string | null;
  /** Index in the generated fights array */
  nextFightIndex: number | null;
  nextSlot: "A" | "B" | null;
}

export function nextPowerOfTwo(n: number): number {
  if (n <= 2) return 2;
  return 2 ** Math.ceil(Math.log2(Math.max(n, 2)));
}

export function generateSlots(participantCount: number): number {
  return nextPowerOfTwo(participantCount);
}

export function getRoundCount(size: number): number {
  return Math.log2(size);
}

export function getRoundName(size: number, round: number, isThirdPlace = false): string {
  if (isThirdPlace) return "THIRD PLACE";
  const remaining = size / 2 ** (round - 1);
  if (remaining === 2) return "FINAL";
  if (remaining === 4) return "SEMIFINAL";
  if (remaining === 8) return "QUARTERFINAL";
  if (round === 1) return "ROUND 1";
  return `ROUND ${round}`;
}

export function shuffleParticipants<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Standard single-elim seeding positions for a bracket of `size`. */
export function seedingPositions(size: number): number[] {
  const positions = [1, 2];
  let current = 2;
  while (current < size) {
    const next: number[] = [];
    const roundSize = current * 2;
    for (const p of positions) {
      next.push(p);
      next.push(roundSize + 1 - p);
    }
    positions.length = 0;
    positions.push(...next);
    current *= 2;
  }
  return positions.map((p) => p - 1);
}

export function applySeeding(participants: DrawParticipant[], size: number): Array<DrawParticipant | null> {
  const sorted = [...participants].sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999));
  const slots: Array<DrawParticipant | null> = Array(size).fill(null);
  const pos = seedingPositions(size);
  sorted.forEach((p, i) => {
    if (i < pos.length) slots[pos[i]] = p;
  });
  return slots;
}

function pairsConflict(
  a: DrawParticipant | null,
  b: DrawParticipant | null,
  mode: DrawMode,
): boolean {
  if (!a || !b) return false;
  if (mode === "CLUB_SEPARATION" && a.clubId && b.clubId && a.clubId === b.clubId) return true;
  if (mode === "COUNTRY_SEPARATION" && a.countryId && b.countryId && a.countryId === b.countryId) return true;
  return false;
}

export function applySeparation(slots: Array<DrawParticipant | null>, mode: DrawMode): Array<DrawParticipant | null> {
  const result = [...slots];
  const n = result.length;
  for (let i = 0; i < n; i += 2) {
    if (!pairsConflict(result[i], result[i + 1], mode)) continue;
    for (let j = i + 2; j < n; j++) {
      if (!result[j]) continue;
      const swapWith = j % 2 === 0 ? j : j;
      const partner = swapWith % 2 === 0 ? swapWith + 1 : swapWith - 1;
      const trial = [...result];
      [trial[i + 1], trial[swapWith]] = [trial[swapWith], trial[i + 1]];
      if (
        !pairsConflict(trial[i], trial[i + 1], mode) &&
        !pairsConflict(trial[swapWith], trial[partner] ?? null, mode)
      ) {
        result[i + 1] = trial[i + 1];
        result[swapWith] = trial[swapWith];
        break;
      }
    }
  }
  return result;
}

export function createByeSlots(participants: DrawParticipant[], size: number): Array<DrawParticipant | null> {
  const slots: Array<DrawParticipant | null> = Array(size).fill(null);
  participants.forEach((p, i) => {
    if (i < size) slots[i] = p;
  });
  return slots;
}

export function createRounds(size: number): { round: number; roundName: string; count: number }[] {
  const rounds: { round: number; roundName: string; count: number }[] = [];
  const totalRounds = getRoundCount(size);
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push({
      round: r,
      roundName: getRoundName(size, r),
      count: size / 2 ** r,
    });
  }
  return rounds;
}

export function generateDraw(
  participants: DrawParticipant[],
  options: {
    mode?: DrawMode;
    thirdPlace?: boolean;
    bronzeMode?: "ONE" | "TWO";
    rng?: () => number;
  } = {},
): { size: number; fights: GeneratedFight[] } {
  if (participants.length < 2) {
    throw new Error("NEED_MORE_PARTICIPANTS");
  }

  const mode = options.mode ?? "RANDOM";
  const rng = options.rng ?? Math.random;
  const size = generateSlots(participants.length);
  const totalRounds = getRoundCount(size);

  let ordered: DrawParticipant[];
  if (mode === "SEEDED") {
    ordered = [...participants].sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999));
  } else {
    ordered = shuffleParticipants(participants, rng);
  }

  let slots: Array<DrawParticipant | null>;
  if (mode === "SEEDED") {
    slots = applySeeding(ordered, size);
  } else {
    slots = createByeSlots(ordered, size);
    if (mode === "CLUB_SEPARATION" || mode === "COUNTRY_SEPARATION") {
      slots = applySeparation(slots, mode);
    }
  }

  const fights: GeneratedFight[] = [];
  const roundStartIndex: number[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    roundStartIndex[r] = fights.length;
    const count = size / 2 ** r;
    const roundName = getRoundName(size, r);
    for (let i = 0; i < count; i++) {
      let participantAId: string | null = null;
      let participantBId: string | null = null;
      let slotABye = false;
      let slotBBye = false;

      if (r === 1) {
        const a = slots[i * 2];
        const b = slots[i * 2 + 1];
        participantAId = a?.id ?? null;
        participantBId = b?.id ?? null;
        slotABye = !a;
        slotBBye = !b;
      }

      const bothBye = slotABye && slotBBye;
      const oneBye = (slotABye && participantBId) || (slotBBye && participantAId);
      let status: "WAITING" | "BYE" = "WAITING";
      let winnerId: string | null = null;

      if (r === 1 && bothBye) {
        status = "BYE";
      } else if (r === 1 && oneBye) {
        status = "BYE";
        winnerId = participantAId ?? participantBId;
      }

      fights.push({
        round: r,
        roundName,
        fightNumber: fights.length + 1,
        isThirdPlace: false,
        participantAId,
        participantBId,
        slotABye,
        slotBBye,
        status,
        winnerId,
        loserId: null,
        nextFightIndex: null,
        nextSlot: null,
      });
    }
  }

  linkNextFights(fights, size, totalRounds);

  const thirdPlace = options.thirdPlace !== false && options.bronzeMode !== "TWO" && totalRounds >= 2;
  if (thirdPlace) {
    const sfRound = totalRounds - 1;
    const sfStart = roundStartIndex[sfRound];
    const sfCount = size / 2 ** sfRound;
    const third: GeneratedFight = {
      round: totalRounds,
      roundName: "THIRD PLACE",
      fightNumber: fights.length + 1,
      isThirdPlace: true,
      participantAId: null,
      participantBId: null,
      slotABye: false,
      slotBBye: false,
      status: "WAITING",
      winnerId: null,
      loserId: null,
      nextFightIndex: null,
      nextSlot: null,
    };
    const thirdIndex = fights.length;
    fights.push(third);
    for (let i = 0; i < sfCount; i++) {
      const sf = fights[sfStart + i];
      sf.nextFightIndex = sf.nextFightIndex;
    }
    void thirdIndex;
  }

  applyByeAdvancement(fights);

  return { size, fights: pruneEmptyBranches(fights) };
}

export function linkNextFights(fights: GeneratedFight[], size: number, totalRounds: number): void {
  let offset = 0;
  for (let r = 1; r < totalRounds; r++) {
    const count = size / 2 ** r;
    const nextOffset = offset + count;
    for (let i = 0; i < count; i++) {
      const fight = fights[offset + i];
      const nextIndex = nextOffset + Math.floor(i / 2);
      fight.nextFightIndex = nextIndex;
      fight.nextSlot = i % 2 === 0 ? "A" : "B";
    }
    offset += count;
  }
}

export function applyByeAdvancement(fights: GeneratedFight[]): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const fight of fights) {
      if (fight.status !== "BYE" || !fight.winnerId || fight.nextFightIndex == null) continue;
      const next = fights[fight.nextFightIndex];
      if (!next) continue;
      const slot = fight.nextSlot;
      if (slot === "A" && !next.participantAId) {
        next.participantAId = fight.winnerId;
        changed = true;
      }
      if (slot === "B" && !next.participantBId) {
        next.participantBId = fight.winnerId;
        changed = true;
      }
      if (next.slotABye && next.participantBId && !next.winnerId) {
        next.status = "BYE";
        next.winnerId = next.participantBId;
        changed = true;
      }
      if (next.slotBBye && next.participantAId && !next.winnerId) {
        next.status = "BYE";
        next.winnerId = next.participantAId;
        changed = true;
      }
    }
  }
}

function fightHasAthlete(f: GeneratedFight) {
  return Boolean(f.participantAId || f.participantBId || f.winnerId);
}

/** Drop BYE-vs-BYE cards and empty later rounds, then number fights 1..n with no gaps. */
export function pruneEmptyBranches(fights: GeneratedFight[]): GeneratedFight[] {
  const feeders = new Map<number, number[]>();
  fights.forEach((f, i) => {
    if (f.nextFightIndex == null) return;
    const arr = feeders.get(f.nextFightIndex) ?? [];
    arr.push(i);
    feeders.set(f.nextFightIndex, arr);
  });

  const dead = new Set<number>();
  const visit = (i: number): boolean => {
    if (dead.has(i)) return true;
    const f = fights[i];
    if (!f || fightHasAthlete(f) || f.isThirdPlace) return false;
    const src = feeders.get(i) ?? [];
    const empty = src.length === 0 ? Boolean(f.slotABye && f.slotBBye) : src.every(visit);
    if (empty) dead.add(i);
    return empty;
  };
  fights.forEach((_, i) => visit(i));

  fights.forEach((f, i) => {
    if (dead.has(i)) return;
    for (const src of feeders.get(i) ?? []) {
      if (!dead.has(src)) continue;
      const slot = fights[src].nextSlot;
      if (slot === "A") f.slotABye = true;
      if (slot === "B") f.slotBBye = true;
    }
    if (f.slotABye && f.participantBId && !f.winnerId) {
      f.status = "BYE";
      f.winnerId = f.participantBId;
    }
    if (f.slotBBye && f.participantAId && !f.winnerId) {
      f.status = "BYE";
      f.winnerId = f.participantAId;
    }
  });

  applyByeAdvancement(fights);

  const oldToNew = new Map<number, number>();
  const kept: GeneratedFight[] = [];
  fights.forEach((f, i) => {
    if (dead.has(i)) return;
    oldToNew.set(i, kept.length);
    kept.push({ ...f });
  });

  for (const f of kept) {
    if (f.nextFightIndex == null) continue;
    const mapped = oldToNew.get(f.nextFightIndex);
    if (mapped == null) {
      f.nextFightIndex = null;
      f.nextSlot = null;
    } else {
      f.nextFightIndex = mapped;
    }
  }

  kept.forEach((f, i) => {
    f.fightNumber = i + 1;
  });
  return kept;
}

export function validateDraw(fights: GeneratedFight[], participantIds: string[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const f of fights) {
    if (f.round === 1 && !f.isThirdPlace) {
      for (const id of [f.participantAId, f.participantBId]) {
        if (!id) continue;
        if (seen.has(id)) errors.push(`Duplicate participant ${id} in round 1`);
        seen.add(id);
      }
    }
  }
  for (const id of participantIds) {
    if (!seen.has(id)) errors.push(`Participant ${id} missing from draw`);
  }
  return { ok: errors.length === 0, errors };
}

export function advanceWinnerInMemory(
  fights: GeneratedFight[],
  fightNumber: number,
  winnerId: string,
): GeneratedFight[] {
  const copy = fights.map((f) => ({ ...f }));
  const fight = copy.find((f) => f.fightNumber === fightNumber);
  if (!fight) throw new Error("FIGHT_NOT_FOUND");
  const a = fight.participantAId;
  const b = fight.participantBId;
  if (winnerId !== a && winnerId !== b) throw new Error("WINNER_NOT_IN_FIGHT");
  fight.winnerId = winnerId;
  fight.loserId = winnerId === a ? b : a;
  fight.status = "WAITING";
  if (fight.nextFightIndex != null) {
    const next = copy[fight.nextFightIndex];
    if (fight.nextSlot === "A") next.participantAId = winnerId;
    if (fight.nextSlot === "B") next.participantBId = winnerId;
  }
  return copy;
}
