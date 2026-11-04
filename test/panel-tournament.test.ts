import assert from "node:assert/strict";
import test from "node:test";
import { formatRounds, isYoutubeUrl, parseRounds } from "../src/commands/panel/tournament.js";

const now = new Date("2026-10-05T12:00:00Z");

test("deadline rounds parse one per line and keep the written dates", () => {
  const parsed = parseRounds("10/10 - 14/10\n15/10 - 18/10\n\nRound 3: 19/10 → 21/10", now);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(formatRounds(parsed.rounds), ["10/10 → 14/10", "15/10 → 18/10", "19/10 → 21/10"]);
  assert.equal(parsed.rounds[0].start.getUTCFullYear(), 2026);
});

test("a round that crosses into January moves to the next year", () => {
  const parsed = parseRounds("28/12 - 02/01\n03/01 - 06/01", now);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.rounds[0].start.getUTCFullYear(), 2026);
  assert.equal(parsed.rounds[0].end.getUTCFullYear(), 2027);
  assert.equal(parsed.rounds[1].start.getUTCFullYear(), 2027);
});

test("overlapping, impossible or malformed rounds are rejected", () => {
  assert.equal(parseRounds("10/10 - 14/10\n12/10 - 16/10", now).ok, false);
  assert.equal(parseRounds("10/10 - 14/10\n14/10 - 16/10", now).ok, false);
  assert.equal(parseRounds("31/02 - 03/03", now).ok, false);
  assert.equal(parseRounds("14/10 - 10/10", now).ok, false);
  assert.equal(parseRounds("next week", now).ok, false);
  assert.equal(parseRounds("   ", now).ok, false);
});

test("only YouTube https links are accepted for the shuffle video", () => {
  assert.equal(isYoutubeUrl("https://youtu.be/abc123"), true);
  assert.equal(isYoutubeUrl("https://www.youtube.com/watch?v=abc123"), true);
  assert.equal(isYoutubeUrl("http://youtube.com/watch?v=abc123"), false);
  assert.equal(isYoutubeUrl("https://vimeo.com/123"), false);
  assert.equal(isYoutubeUrl("https://youtube.com.evil.example/watch"), false);
});
