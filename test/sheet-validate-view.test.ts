import assert from "node:assert/strict";
import test from "node:test";
import { sheetValidateMessages, type SheetIssueKind } from "../src/commands/sheet/view.js";

const kinds: SheetIssueKind[] = [
  "banned", "duplicate-discord", "duplicate-game", "discord-id", "game-id",
  "account-age", "staff-role", "membership", "tag",
];

function contentLength(node: unknown): number {
  if (Array.isArray(node)) {
    return node.reduce((sum: number, item) => sum + contentLength(item), 0);
  }
  if (node && typeof node === "object") {
    return Object.entries(node).reduce(
      (sum, [key, value]) => sum + (key === "content" && typeof value === "string" ? value.length : contentLength(value)),
      0,
    );
  }
  return 0;
}

function textOf(components: unknown): number {
  return contentLength((components as { toJSON(): unknown }[]).map((c) => c.toJSON()));
}

function components(node: unknown): number {
  if (Array.isArray(node)) {
    return node.reduce((sum: number, item) => sum + components(item), 0);
  }
  if (node && typeof node === "object") {
    const own = "type" in node ? 1 : 0;
    return own + Object.values(node).reduce((sum: number, value) => sum + (typeof value === "object" ? components(value) : 0), 0);
  }
  return 0;
}

test("every failing player is listed, split across messages within Discord's limits", () => {
  const kinds9 = kinds.map((kind) => ({
    kind,
    lines: Array.from(
      { length: 80 },
      (_, i) => `> **A Very Long Team Name Here** · **Player ${i}:** <@123456789012345678> · ${kind} check failed for row ${i}.`,
    ),
  }));
  const messages = sheetValidateMessages(
    { format: "5vs5", teams: 64, players: 320, staffConfigured: false, buckets: kinds9 },
    {},
  );
  assert.ok(messages.length > 1);
  const all: string[] = [];
  for (const message of messages) {
    const json = (message.components as { toJSON(): unknown }[]).map((c) => c.toJSON());
    assert.ok(textOf(message.components) <= 4000, `text was ${textOf(message.components)}`);
    assert.ok(components(json) <= 40, `components were ${components(json)}`);
    all.push(JSON.stringify(json));
  }
  const text = all.join("");
  assert.ok(!text.includes("more."));
  for (const bucket of kinds9) {
    for (const line of bucket.lines) {
      assert.ok(text.includes(JSON.stringify(line).slice(1, -1)), `missing ${line}`);
    }
  }
});
