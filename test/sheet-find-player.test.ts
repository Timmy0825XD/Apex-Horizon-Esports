import assert from "node:assert/strict";
import test from "node:test";
import { playerMatches, splitIds } from "../src/commands/sheet/find-player.js";

const player = { slot: 0, discordTag: "apex_one", discordId: "111", gameName: "Apex One", gameId: "AbC123", currentTitle: "" };

test("several IDs split on spaces and drop repeats", () => {
  assert.deepEqual(splitIds("  111   222\t111 "), ["111", "222"]);
  assert.deepEqual(splitIds("ABC abc", true), ["abc"]);
  assert.deepEqual(splitIds(null), []);
});

test("a player matches any of the IDs in a field", () => {
  const empty = { gameIds: [], discordIds: [] };
  assert.equal(playerMatches(player, { ...empty, discordIds: ["999", "111"] }), true);
  assert.equal(playerMatches(player, { ...empty, gameIds: splitIds("zzz abc123", true) }), true);
  assert.equal(playerMatches(player, { ...empty, gameIds: ["abc12"], discordIds: ["11"] }), false);
});

import { MAX_RESULT_MESSAGES, PLAYERS_CSV_NAME, playerFoundMessages, type PlayerHit } from "../src/commands/sheet/view.js";
import type { StoredSheetRecord } from "../src/commands/tournament/store.js";

function hit(index: number, sheetCount = 2): PlayerHit {
  const sheet = (n: number) =>
    ({ id: `s${n}`, tournamentName: `Cup ${n}`, format: "2vs2", origin: "manual", guildName: "Apex", sheetLink: `https://docs.google.com/spreadsheets/d/${n}` }) as unknown as StoredSheetRecord;
  return {
    identity: `d:${index}`,
    displayName: `Player ${index}`,
    teamName: `Team ${index}`,
    format: "2vs2",
    captain: { ...player, discordId: String(100000000000000000 + index) },
    headers: [],
    sheets: Array.from({ length: sheetCount }, (_, n) => sheet(n)),
  };
}

function cardCount(messages: ReturnType<typeof playerFoundMessages>): number {
  return messages.reduce((sum, message) => sum + (message.components?.length ?? 0), 0);
}

function within(message: ReturnType<typeof playerFoundMessages>[number]) {
  const json = (message.components ?? []).map((c) => (c as { toJSON(): unknown }).toJSON());
  const count = (node: unknown): number =>
    node && typeof node === "object"
      ? 1 + ["components", "accessory"].reduce((sum, key) => {
          const child = (node as Record<string, unknown>)[key];
          return sum + (Array.isArray(child) ? child.reduce((s: number, c) => s + count(c), 0) : child ? count(child) : 0);
        }, 0)
      : 0;
  const textOf = (node: unknown): number =>
    Array.isArray(node)
      ? node.reduce((sum: number, child) => sum + textOf(child), 0)
      : node && typeof node === "object"
        ? Object.entries(node).reduce((sum, [key, value]) => sum + (key === "content" && typeof value === "string" ? value.length : textOf(value)), 0)
        : 0;
  const text = textOf(json);
  return { components: json.reduce((sum: number, node) => sum + count(node), 0), text };
}

test("every matched player gets a card, packed under Discord's limits", () => {
  const messages = playerFoundMessages(Array.from({ length: 13 }, (_, i) => hit(i)));
  assert.equal(cardCount(messages), 13);
  assert.ok(messages.length > 1);
  for (const message of messages) {
    const size = within(message);
    assert.ok(size.components <= 40, `components ${size.components}`);
    assert.ok(size.text <= 4000, `text ${size.text}`);
    assert.equal(message.files, undefined);
  }
});

test("a player in many sheets still fits in one message", () => {
  const [message] = playerFoundMessages([hit(1, 200)]);
  assert.ok(within(message).text <= 4000);
});

test("past the message cap the rest goes in a CSV with every player", () => {
  const messages = playerFoundMessages(Array.from({ length: 200 }, (_, i) => hit(i)));
  assert.equal(messages.length, MAX_RESULT_MESSAGES);
  const last = messages[messages.length - 1];
  assert.ok(within(last).components <= 40);
  const file = (last.files as { name?: string; attachment: Buffer }[])[0];
  assert.equal(file.name, PLAYERS_CSV_NAME);
  assert.equal(file.attachment.toString("utf8").trim().split("\n").length, 1 + 200 * 2);
});
