import assert from "node:assert/strict";
import test from "node:test";
import type { Role } from "discord.js";
import { roleMassProgressMessage, roleMassResultMessage } from "../src/commands/role/view.js";

const role = { id: "123" } as Role;

function text(payload: { components?: unknown[] }): string {
  return JSON.stringify((payload.components ?? []).map((component) => (component as { toJSON(): unknown }).toJSON()));
}

test("progress shows the percentage and counters", () => {
  const body = text(roleMassProgressMessage("remove", role, { total: 80, done: 20, changed: 19, failed: 1 }, Date.now()));
  assert.match(body, /25%/);
  assert.match(body, /20 of 80 · 19 updated · 1 failed/);
  assert.match(body, /▰{5}▱{15}/);
});

test("progress before members load explains the wait", () => {
  assert.match(text(roleMassProgressMessage("add", role, null, Date.now())), /Loading the member list/);
});

test("result is a summary without member mentions", () => {
  const body = text(
    roleMassResultMessage({
      action: "remove",
      role,
      changed: 77,
      skipped: 5253,
      failed: 0,
      elapsedMs: 72_000,
      actorId: "9",
      at: new Date(),
    }),
  );
  assert.match(body, /\*\*Removed\*\* `77`/);
  assert.match(body, /\*\*Did not have it\*\* `5253`/);
  assert.match(body, /took 1m 12s/);
  assert.doesNotMatch(body, /<@(?!&|9>)/);
});

test("result turns red only when every update failed", () => {
  const body = text(
    roleMassResultMessage({ action: "add", role, changed: 0, skipped: 3, failed: 4, elapsedMs: 1_000, actorId: "9", at: new Date() }),
  );
  assert.match(body, /Could Not Update Roles/);
});
