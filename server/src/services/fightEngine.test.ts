import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveWinnerLoser, nextSlotField } from "./fightEngine.js";

describe("fight engine", () => {
  it("resolves winner and loser", () => {
    const r = resolveWinnerLoser({ participantAId: "a", participantBId: "b" }, "a");
    assert.equal(r.winnerId, "a");
    assert.equal(r.loserId, "b");
  });

  it("rejects winner not in fight", () => {
    assert.throws(() => resolveWinnerLoser({ participantAId: "a", participantBId: "b" }, "c"));
  });

  it("maps next slot", () => {
    assert.equal(nextSlotField("A"), "participantAId");
    assert.equal(nextSlotField("B"), "participantBId");
  });
});
