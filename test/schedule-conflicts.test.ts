import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_SCHEDULES_PER_MINUTE,
  minuteIsFull,
  staffClash,
  tooClose,
  type BookedSchedule,
} from "../src/commands/schedule/conflicts.js";

const at = (time: string) => new Date(`2026-11-04T${time}:00Z`);

function booked(id: string, time: string, judgeId: string | null = null, recorderId: string | null = null): BookedSchedule {
  return { id, channelId: `channel-${id}`, scheduledAt: at(time), judgeId, recorderId };
}

test("staff window blocks less than 30 minutes and allows exactly 30", () => {
  assert.equal(tooClose(at("21:00"), at("21:00")), true);
  assert.equal(tooClose(at("21:00"), at("20:31")), true);
  assert.equal(tooClose(at("21:00"), at("21:29")), true);
  assert.equal(tooClose(at("21:00"), at("20:30")), false);
  assert.equal(tooClose(at("21:00"), at("21:30")), false);
});

test("a minute holds at most four schedules", () => {
  const rows = ["1", "2", "3"].map((id) => booked(id, "21:00"));
  assert.equal(MAX_SCHEDULES_PER_MINUTE, 4);
  assert.equal(minuteIsFull(rows, at("21:00")), false);
  rows.push(booked("4", "21:00"));
  assert.equal(minuteIsFull(rows, at("21:00")), true);
  assert.equal(minuteIsFull(rows, at("21:01")), false);
});

test("staff clash finds the nearest seat held by the same member", () => {
  const rows = [
    booked("a", "20:40", "judge-1"),
    booked("b", "21:10", null, "judge-1"),
    booked("c", "21:00", "someone-else"),
    booked("d", "21:30", "judge-1"),
  ];
  assert.equal(staffClash(rows, "judge-1", at("21:00"))?.id, "b");
  assert.equal(staffClash(rows, "judge-2", at("21:00")), null);
  assert.equal(staffClash([booked("e", "20:30", "judge-1")], "judge-1", at("21:00")), null);
});
