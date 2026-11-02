import assert from "node:assert/strict";
import test from "node:test";
import { helpCatalog } from "../src/commands/bot/catalog.js";
import { compactDuration } from "../src/lib/runtime.js";

test("uptime is compact at every scale", () => {
  assert.equal(compactDuration(45), "45s");
  assert.equal(compactDuration(67), "1m 7s");
  assert.equal(compactDuration(3 * 3600 + 12 * 60), "3h 12m");
  assert.equal(compactDuration(2 * 86400 + 4 * 3600 + 59), "2d 4h");
});

test("every help section fits one Components V2 message and the jump menu", () => {
  assert.ok(helpCatalog.length <= 25, "a select menu holds at most 25 options");
  for (const category of helpCatalog) {
    const text = category.entries
      .map((entry) => `</${entry.slash}:000000000000000000>\n${entry.summary}\n-# ${entry.access}`)
      .join("\n\n");
    assert.ok(text.length < 3500, `${category.title} help page is ${text.length} characters`);
    assert.ok(category.description.length <= 100, `${category.title} description must fit a select option`);
  }
});

test("help lists the staff info commands", () => {
  const staff = helpCatalog.find((category) => category.title === "Staff");
  const slashes = staff?.entries.map((entry) => entry.slash) ?? [];
  for (const slash of ["staff info add", "staff info edit", "staff info export"]) {
    assert.ok(slashes.includes(slash), `${slash} missing from help`);
  }
});
