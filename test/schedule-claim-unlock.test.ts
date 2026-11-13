import assert from "node:assert/strict";
import test from "node:test";
import { earlyLine, FAST_CLAIM_MS, reactionLine } from "../src/commands/schedule/audit.js";
import { reactionMs, unlockDelay } from "../src/commands/schedule/unlock.js";
import { claimsAreOpen } from "../src/commands/schedule/view.js";

const now = new Date("2026-11-13T20:00:00Z");
const at = (ms: number) => new Date(now.getTime() + ms);

test("Assign stays locked until the unlock moment, then open until the window ends", () => {
  const until = at(10 * 60_000);
  assert.equal(claimsAreOpen(until, null, now), false, "unset unlock = still locked");
  assert.equal(claimsAreOpen(until, at(2_500), now), false, "before the unlock");
  assert.equal(claimsAreOpen(until, at(2_500), at(2_500)), true, "at the unlock");
  assert.equal(claimsAreOpen(until, at(2_500), at(9 * 60_000)), true);
  assert.equal(claimsAreOpen(until, at(2_500), until), false, "window closed");
  assert.equal(claimsAreOpen(null, at(-1), now), false);
});

test("the unlock delay is random between 2 and 3 seconds", () => {
  assert.equal(unlockDelay(() => 0), 2_000);
  assert.equal(unlockDelay(() => 0.5), 2_500);
  assert.equal(unlockDelay(() => 0.9999999), 3_000);
});

test("reaction counts from Assign turning on and flags clicks faster than a person", () => {
  assert.equal(reactionMs(now.getTime() + 450, now), 450);
  assert.equal(reactionMs(now.getTime(), null), null);
  assert.match(reactionLine(450), /`450 ms`/);
  assert.match(reactionLine(450), /Fast click/);
  assert.match(reactionLine(-80), /`0 ms`/);
  assert.doesNotMatch(reactionLine(FAST_CLAIM_MS), /Fast click/);
  assert.doesNotMatch(reactionLine(1_800), /Fast click/);
  assert.match(reactionLine(null), /unknown/);
});

test("a blocked claim says how early it was pressed", () => {
  assert.match(earlyLine(now.getTime(), at(1_200)), /`1200 ms` before Assign turned on/);
  assert.match(earlyLine(now.getTime(), null), /still disabled/);
});
