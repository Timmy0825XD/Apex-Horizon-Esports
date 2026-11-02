import assert from "node:assert/strict";
import test from "node:test";
import { isLateSlot, latestSlot } from "../src/commands/auto-room/slot.js";

const at = (iso: string) => new Date(iso);

test("latestSlot picks the 00:00 slot before noon UTC", () => {
  assert.equal(latestSlot(at("2026-11-01T00:00:00Z")).key, "2026-11-01-00");
  assert.equal(latestSlot(at("2026-11-01T11:59:59Z")).key, "2026-11-01-00");
});

test("latestSlot picks the 12:00 slot from noon UTC on", () => {
  assert.equal(latestSlot(at("2026-11-01T12:00:00Z")).key, "2026-11-01-12");
  assert.equal(latestSlot(at("2026-11-01T23:59:59Z")).key, "2026-11-01-12");
});

test("latestSlot crosses month and year boundaries", () => {
  assert.equal(latestSlot(at("2026-12-31T23:30:00Z")).key, "2026-12-31-12");
  assert.equal(latestSlot(at("2027-01-01T00:05:00Z")).key, "2027-01-01-00");
});

test("a slot is late only after its own hour has passed", () => {
  const slot = latestSlot(at("2026-11-01T12:30:00Z"));
  assert.equal(isLateSlot(slot, at("2026-11-01T12:59:59Z")), false);
  assert.equal(isLateSlot(slot, at("2026-11-01T13:00:00Z")), true);
});
