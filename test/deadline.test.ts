import assert from "node:assert/strict";
import test from "node:test";
import { within } from "../src/commands/schedule/deadline.js";

const later = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

test("within resolves work that finishes in time", async () => {
  assert.equal(await within(50, later(5, "done"), "Work"), "done");
});

test("within rejects slow work and hands its late result to onLate", async () => {
  let undone: string | null = null;
  await assert.rejects(within(10, later(40, "late"), "Work", (value) => (undone = value)), /Work took too long/);
  await later(60, null);
  assert.equal(undone, "late");
});

test("within does not call onLate when work finishes in time", async () => {
  let called = false;
  await within(50, later(5, "done"), "Work", () => (called = true));
  await later(20, null);
  assert.equal(called, false);
});
