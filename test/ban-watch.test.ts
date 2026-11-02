import assert from "node:assert/strict";
import test from "node:test";
import { parseAnnouncement } from "../src/commands/ban-watch/parse.js";

// The four real announcements, as they arrive (the @Staff CT mention is a role token).
const unbanned = `**UNBANNED**
This player has been declared able to return to active tournaments, and we will continue to monitor this ID.

Discord id :
1446490189856899227

Game ID:
739234EA38BC3E54

<@&1300000000000000001>`;

const oneBan = `🚫🚫BANNED🚫🚫


GAME ID: D36D433E12840B97
DC ID:979623848351772682

Permanently banned from all CTs
Reason:Jockey/Alt

<@&1300000000000000001>`;

const twoAccounts = `🚫🚫BANNED🚫🚫

Dc ID:1542796177744076921
Dc ID:1104039562231160952

Game I'd : B8072BE6FC7A7BD4

Permanently banned from all CTs
Reason:Current account already sold / not belong to original owner`;

const twoPlayers = `Player
E648DD6B7A37B3A
1212965928896303188

has been banned permanently.
Reason: share same login history with an already banned account:
9AE5BA3DB5C7214E
<@&1300000000000000001>
Player
1446490189856899227
739234EA38BC3E54has been banned permanently.
Reason: multiple login location during tournament match.

<@&1300000000000000001>`;

test("an unban announcement is told apart and keeps its Discord ID", () => {
  assert.deepEqual(parseAnnouncement(unbanned), {
    kind: "unban",
    ids: [{ userId: "1446490189856899227", reason: null }],
  });
});

test("a single ban reads the Discord ID and its reason, never the Game ID", () => {
  assert.deepEqual(parseAnnouncement(oneBan), {
    kind: "ban",
    ids: [{ userId: "979623848351772682", reason: "Jockey/Alt" }],
  });
});

test("several IDs sharing one reason all get it", () => {
  const reason = "Current account already sold / not belong to original owner";
  assert.deepEqual(parseAnnouncement(twoAccounts), {
    kind: "ban",
    ids: [
      { userId: "1542796177744076921", reason },
      { userId: "1104039562231160952", reason },
    ],
  });
});

test("two players in one post keep their own reasons", () => {
  assert.deepEqual(parseAnnouncement(twoPlayers), {
    kind: "ban",
    ids: [
      { userId: "1212965928896303188", reason: "share same login history with an already banned account:" },
      { userId: "1446490189856899227", reason: "multiple login location during tournament match." },
    ],
  });
});

test("role, channel, emoji, timestamp and link snowflakes are not people", () => {
  const text = "<@&123456789012345678> <#223456789012345678> <:x:323456789012345678> <t:1793598214:F> https://discord.com/channels/1/423456789012345678/523456789012345678";
  assert.deepEqual(parseAnnouncement(text).ids, []);
});

test("a user mention counts as a Discord ID and repeats collapse", () => {
  const { ids } = parseAnnouncement("BANNED <@!979623848351772682> also 979623848351772682");
  assert.deepEqual(ids, [{ userId: "979623848351772682", reason: null }]);
});

test("a post with only a Game ID yields no one to ban", () => {
  assert.deepEqual(parseAnnouncement("BANNED\nGame ID: D36D433E12840B97\nReason: alt").ids, []);
});

test("banned is not mistaken for unbanned", () => {
  assert.equal(parseAnnouncement("has been banned permanently 979623848351772682").kind, "ban");
  assert.equal(parseAnnouncement("UN-BANNED 979623848351772682").kind, "unban");
});

// ---------------------------------------------------------------- cards

import { ComponentType, type APIContainerComponent, type User } from "discord.js";
import type { BanRequest } from "@prisma/client";
import { pendingCard, pingContent, resultCard, type Target } from "../src/commands/ban-watch/view.js";

const request: BanRequest = {
  id: "65a1b2c3d4e5f60718293a4b",
  guildId: "1036107463516237925",
  channelId: "1544484391252791348",
  sourceMessageId: "1566684320050053299",
  kind: "ban",
  userId: "979623848351772682",
  reason: "Jockey/Alt",
  duration: "Permanent",
  cardMessageId: null,
  pingMessageId: null,
  status: "pending",
  decidedBy: null,
  decidedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const user = { id: request.userId, displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png" } as unknown as User;
const target: Target = {
  user,
  inServer: true,
  bannedHere: null,
  hits: [{ tournamentName: "Apex Winter Cup", teamName: "Ghost_Unit", slot: "Captain" }],
  blocker: null,
};

function walk(card: APIContainerComponent) {
  const texts: string[] = [];
  const ids: string[] = [];
  const disabled: string[] = [];
  for (const component of card.components) {
    if (component.type === ComponentType.TextDisplay) texts.push(component.content);
    if (component.type === ComponentType.Section) texts.push(...component.components.map((part) => part.content));
    if (component.type === ComponentType.ActionRow) {
      for (const inner of component.components) {
        const id = "custom_id" in inner ? inner.custom_id : "";
        ids.push(id);
        if ("disabled" in inner && inner.disabled) disabled.push(id);
      }
    }
  }
  return { text: texts.join("\n"), ids, disabled };
}

test("the pending ban card offers confirm, duration and cancel and raises the roster alert", () => {
  const { text, ids, disabled } = walk(pendingCard(request, target).toJSON());
  assert.deepEqual(ids, [`banwatch:confirm:${request.id}`, `banwatch:duration:${request.id}`, `banwatch:cancel:${request.id}`]);
  assert.deepEqual(disabled, []);
  assert.match(text, /Plays in an active tournament/);
  assert.ok(text.includes("team **Ghost\\_Unit** (Captain)"), "team name is escaped for Discord");
  assert.match(text, /\*\*Duration\*\* Permanent/);
  assert.match(text, /\*\*Reason\*\* Jockey\/Alt/);
});

test("duration mode swaps the buttons for the five durations and a way back", () => {
  const card = pendingCard({ ...request, duration: "1 month" }, target, "duration").toJSON();
  const row = card.components.find((component) => component.type === ComponentType.ActionRow);
  const select = row?.type === ComponentType.ActionRow ? row.components[0] : undefined;
  assert.equal(select?.type, ComponentType.StringSelect);
  if (select?.type === ComponentType.StringSelect) {
    assert.deepEqual(select.options.map((option) => option.value), ["7 days", "1 month", "2 months", "6 months", "Permanent"]);
    assert.equal(select.options.find((option) => option.default)?.value, "1 month");
  }
  assert.ok(walk(card).ids.includes(`banwatch:back:${request.id}`));
});

test("a blocked ID can only be cancelled", () => {
  const { disabled, text } = walk(pendingCard(request, { ...target, blocker: "Already banned here (**Permanent**)." }).toJSON());
  assert.deepEqual(disabled, [`banwatch:confirm:${request.id}`, `banwatch:duration:${request.id}`]);
  assert.match(text, /Already banned here/);
});

test("an unban card has no duration and only confirm and cancel", () => {
  const { ids, text } = walk(pendingCard({ ...request, kind: "unban" }, { ...target, bannedHere: "Permanent", hits: [] }).toJSON());
  assert.deepEqual(ids, [`banwatch:confirm:${request.id}`, `banwatch:cancel:${request.id}`]);
  assert.doesNotMatch(text, /Duration/);
  assert.match(text, /banned here \(\*\*Permanent\*\*\)/);
});

test("the result card records the duration, expiry and who approved", () => {
  const expiresAt = new Date("2026-12-02T00:06:00Z");
  const { text, ids } = walk(
    resultCard({ request: { ...request, duration: "1 month" }, target, outcome: "banned", actorId: "111111111111111111", expiresAt, at: new Date("2026-11-02T00:06:00Z") }).toJSON(),
  );
  assert.deepEqual(ids, []);
  assert.match(text, /Player banned/);
  assert.match(text, /\*\*Duration\*\* 1 month · expires <t:1796169960:D>/);
  assert.match(text, /Was on an active tournament roster/);
  assert.match(text, /Approved by <@111111111111111111> · 2026-11-02 00:06 UTC/);
});

test("one ping per announcement names how many decisions wait and the roster alert", () => {
  assert.match(pingContent("222", "ban", 2, 1), /^<@&222> \*\*2\*\* ban requests .* need a decision above\.\n.+\*\*1\*\* of them plays in an active tournament/);
  assert.doesNotMatch(pingContent("222", "unban", 1, 0), /active tournament/);
});
