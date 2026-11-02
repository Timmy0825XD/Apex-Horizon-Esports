import assert from "node:assert/strict";
import test from "node:test";
import { ComponentType, type APIContainerComponent, type User } from "discord.js";
import { auditCard, auditModules, listWithOverflow, type AuditPayload } from "../src/lib/audit.js";

const actor = {
  id: "123456789012345678",
  displayAvatarURL: () => "https://cdn.discordapp.com/avatars/123/abc.png",
} as unknown as User;

function payload(overrides: Partial<AuditPayload> = {}): AuditPayload {
  return {
    guild: {} as AuditPayload["guild"],
    channelId: "1",
    module: "tournaments",
    action: "deleted",
    title: "Tournament deleted",
    summary: "**Tournament Test** was removed.",
    groups: [
      { lines: ["**Bracket** `test_tour_00000`"] },
      { label: "Records removed", lines: ["`57` matches", "`15` rooms"], inline: true },
    ],
    actor,
    ...overrides,
  };
}

/** Every text the card shows, in order. */
function texts(card: APIContainerComponent): string[] {
  return card.components.flatMap((component) => {
    if (component.type === ComponentType.TextDisplay) {
      return [component.content];
    }
    if (component.type === ComponentType.Section) {
      return component.components.map((text) => text.content);
    }
    return [];
  });
}

const now = new Date("2026-11-01T21:17:00Z");

test("the card title is the action and never the module name", () => {
  const card = auditCard(payload(), now).toJSON();
  const [heading] = texts(card);
  assert.match(heading, /^### .+ Tournament deleted\n\*\*Tournament Test\*\* was removed\.$/);
  assert.ok(!heading.includes(auditModules.tournaments.name));
});

test("the stripe color follows the action", () => {
  const colors = (["created", "updated", "deleted"] as const).map(
    (action) => auditCard(payload({ action }), now).toJSON().accent_color,
  );
  assert.deepEqual(colors, [0x3fae6a, 0xd9ad45, 0xd8453d]);
});

test("groups render as captioned blocks and inline groups join with dots", () => {
  const shown = texts(auditCard(payload(), now).toJSON());
  assert.ok(shown.includes("**Bracket** `test_tour_00000`"));
  assert.ok(shown.includes("-# Records removed\n`57` matches · `15` rooms"));
});

test("the footer names the actor with a UTC stamp and a live relative time", () => {
  const shown = texts(auditCard(payload(), now).toJSON());
  assert.equal(shown.at(-1), `-# By <@${actor.id}> · 2026-11-01 21:17 UTC · <t:${now.getTime() / 1000}:R>`);
});

test("the actor avatar sits beside the heading", () => {
  const card = auditCard(payload(), now).toJSON();
  const section = card.components[0];
  assert.equal(section.type, ComponentType.Section);
  assert.equal(section.type === ComponentType.Section && section.accessory.type, ComponentType.Thumbnail);
});

test("oversized logs stay under the Components V2 text limit", () => {
  const huge = Array.from({ length: 40 }, (_, index) => ({ label: `Block ${index}`, lines: ["x".repeat(400)] }));
  const card = auditCard(payload({ groups: huge }), now).toJSON();
  const total = texts(card).join("").length;
  assert.ok(total <= 4000, `text length ${total}`);
  assert.ok(card.components.length <= 40);
  assert.match(texts(card).at(-2) ?? "", /more sections not shown/);
});

test("long lists collapse after 15 entries", () => {
  const items = Array.from({ length: 20 }, (_, index) => `<#${index}>`);
  const shown = listWithOverflow(items);
  assert.equal(shown.length, 16);
  assert.equal(shown.at(-1), "*And **5** more.*");
});
