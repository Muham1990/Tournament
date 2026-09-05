import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  nextPowerOfTwo,
  generateSlots,
  generateDraw,
  validateDraw,
  advanceWinnerInMemory,
  getRoundName,
} from "./drawEngine.js";

describe("draw engine", () => {
  it("pads 10 participants to 16 slots", () => {
    assert.equal(nextPowerOfTwo(10), 16);
    assert.equal(generateSlots(10), 16);
  });

  it("generates 16-slot draw with BYEs for 10 athletes", () => {
    const people = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}` }));
    const { size, fights } = generateDraw(people, { mode: "RANDOM", rng: () => 0.5, bronzeMode: "TWO" });
    assert.equal(size, 16);
    const r1 = fights.filter((f) => f.round === 1 && !f.isThirdPlace);
    assert.equal(r1.length, 5);
    const ids = new Set<string>();
    for (const f of r1) {
      if (f.participantAId) ids.add(f.participantAId);
      if (f.participantBId) ids.add(f.participantBId);
      assert.ok(f.participantAId || f.participantBId, "round 1 should not be empty BYE vs BYE");
    }
    assert.equal(ids.size, 10);
    const nums = fights.map((f) => f.fightNumber).sort((a, b) => a - b);
    assert.deepEqual(nums, fights.map((_, i) => i + 1));
    const check = validateDraw(fights, people.map((p) => p.id));
    assert.equal(check.ok, true, check.errors.join(", "));
  });

  it("does not leave number gaps after pruning empty branches", () => {
    const people = Array.from({ length: 33 }, (_, i) => ({ id: `p${i + 1}` }));
    const { fights } = generateDraw(people, { mode: "RANDOM", rng: () => 0.3, bronzeMode: "TWO" });
    assert.equal(fights.some((f) => f.slotABye && f.slotBBye && !f.participantAId && !f.participantBId), false);
    const nums = fights.map((f) => f.fightNumber);
    assert.deepEqual([...nums].sort((a, b) => a - b), nums.map((_, i) => i + 1));
  });

  it("advances winner to next fight automatically", () => {
    const people = Array.from({ length: 4 }, (_, i) => ({ id: `p${i + 1}` }));
    const { fights } = generateDraw(people, { mode: "RANDOM", rng: () => 0.2, bronzeMode: "TWO" });
    const first = fights.find((f) => f.round === 1 && f.participantAId && f.participantBId);
    assert.ok(first);
    const winner = first!.participantAId!;
    const after = advanceWinnerInMemory(fights, first!.fightNumber, winner);
    const src = after.find((f) => f.fightNumber === first!.fightNumber)!;
    assert.equal(src.winnerId, winner);
    assert.ok(src.nextFightIndex != null);
    const next = after[src.nextFightIndex!];
    if (src.nextSlot === "A") assert.equal(next.participantAId, winner);
    else assert.equal(next.participantBId, winner);
  });

  it("names rounds for size 16", () => {
    assert.equal(getRoundName(16, 1), "ROUND 1");
    assert.equal(getRoundName(16, 2), "QUARTERFINAL");
    assert.equal(getRoundName(16, 3), "SEMIFINAL");
    assert.equal(getRoundName(16, 4), "FINAL");
  });
});
