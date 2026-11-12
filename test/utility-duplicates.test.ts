import assert from "node:assert/strict";
import test from "node:test";
import { checkIds } from "../src/commands/utility/duplicates.js";

const banned = new Set(["ABCDEF1234567890"]);

test("finds repeated Discord IDs and case-insensitive game IDs", () => {
  const report = checkIds("123456789012345678 1A2B3C4D5E6F7A8B 123456789012345678\n1a2b3c4d5e6f7a8b", banned);
  assert.deepEqual(report.duplicates, [
    { kind: "discord", value: "123456789012345678", count: 2 },
    { kind: "game", value: "1A2B3C4D5E6F7A8B", count: 2 },
  ]);
  assert.deepEqual(report.banned, []);
});

test("flags banned game IDs once and skips non-IDs", () => {
  const report = checkIds("abcdef1234567890 hello ABCDEF1234567890 42", banned);
  assert.deepEqual(report.banned, ["ABCDEF1234567890"]);
  assert.deepEqual(report.invalid, ["hello", "42"]);
  assert.equal(report.total, 4);
});

test("reports a clean list", () => {
  const report = checkIds("123456789012345678 223456789012345678", banned);
  assert.deepEqual(report.duplicates, []);
  assert.deepEqual(report.banned, []);
});
