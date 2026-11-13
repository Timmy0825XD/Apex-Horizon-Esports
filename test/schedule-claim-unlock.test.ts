import assert from "node:assert/strict";
import test from "node:test";
import { blockLine, earlyLine, FAST_CLAIM_MS, fastLine, reactionLine } from "../src/commands/schedule/audit.js";
import { blockedUntil, CLAIM_BLOCK_MS, reactionMs, unlockDelay, withBlock } from "../src/commands/schedule/unlock.js";
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

test("reaction counts from Assign turning on", () => {
  assert.equal(reactionMs(now.getTime() + 450, now), 450);
  assert.equal(reactionMs(now.getTime(), null), null);
  assert.match(reactionLine(450), /`450 ms`/);
  assert.match(reactionLine(-80), /`0 ms`/);
  assert.match(reactionLine(null), /unknown/);
  assert.match(fastLine(), new RegExp(`${FAST_CLAIM_MS} ms`));
});

test("a too-fast click bars that member from the schedule for 5 minutes", () => {
  const t = now.getTime();
  const blocks = withBlock([], "1", t);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].until.getTime() - t, CLAIM_BLOCK_MS);
  assert.equal(CLAIM_BLOCK_MS, 5 * 60_000);
  assert.deepEqual(blockedUntil(blocks, "1", t + 60_000), blocks[0].until);
  assert.equal(blockedUntil(blocks, "2", t + 60_000), null, "other members are free");
  assert.equal(blockedUntil(blocks, "1", t + CLAIM_BLOCK_MS), null, "free again after 5 minutes");
  assert.equal(blockedUntil(undefined, "1", t), null);
  // A new block replaces the member's old one and drops expired blocks of others.
  const later = withBlock([...blocks, { userId: "2", until: at(-1) }], "1", t + 60_000);
  assert.deepEqual(later.map((block) => [block.userId, block.until.getTime() - t]), [["1", 60_000 + CLAIM_BLOCK_MS]]);
  assert.match(blockLine(blocks[0].until), /<t:\d+:R>/);
});

test("a blocked claim says how early it was pressed", () => {
  assert.match(earlyLine(now.getTime(), at(1_200)), /`1200 ms` before Assign turned on/);
  assert.match(earlyLine(now.getTime(), null), /still disabled/);
});
