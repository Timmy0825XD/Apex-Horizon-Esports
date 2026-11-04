import assert from "node:assert/strict";
import test from "node:test";

// The guide view reads the registered slash builders, which load env on import.
process.env.DISCORD_TOKEN ??= "test-token";
process.env.DISCORD_CLIENT_ID ??= "1";
process.env.DATABASE_URL ??= "mongodb://localhost/test";
process.env.ALLOWED_GUILDS ??= "1";

const load = async () => ({
  view: await import("../src/commands/panel/guide-view.js"),
  guides: await import("../src/commands/panel/guides/index.js"),
  slash: await import("../src/lib/register-slash.js"),
});

type RawOption = { name: string; type: number; options?: RawOption[] };

function optionNames(commands: Array<{ name: string; options?: unknown }>, slash: string): string[] {
  const [name, ...path] = slash.split(" ");
  let options = commands.find((command) => command.name === name)?.options as RawOption[] | undefined;
  for (const part of path) {
    options = options?.find((option) => option.name === part)?.options;
  }
  return (options ?? []).filter((option) => option.type > 2).map((option) => option.name);
}

test("every command in the catalog has a staff guide", async () => {
  const { view, guides } = await load();
  for (const { entry } of view.catalogItems()) {
    assert.ok(guides.guideFor(entry.slash), `missing guide for /${entry.slash}`);
  }
});

test("guide options, mentions, and related commands point at real commands", async () => {
  const { view, guides, slash } = await load();
  const known = new Set(view.catalogItems().map((item) => item.entry.slash));

  for (const path of known) {
    const guide = guides.guideFor(path);
    assert.ok(guide);
    const names = new Set(optionNames(slash.slashCommands, path));
    for (const key of Object.keys(guide.options ?? {})) {
      for (const name of key.split(" ")) {
        assert.ok(names.has(name), `/${path} explains an option it does not have: ${name}`);
      }
    }
    for (const related of guide.related ?? []) {
      assert.ok(known.has(related), `/${path} relates to an unknown command: /${related}`);
    }
    const text = JSON.stringify(guide);
    for (const match of text.matchAll(/\{\/([a-z0-9 ]+)\}/g)) {
      assert.ok(known.has(match[1] ?? ""), `/${path} mentions an unknown command: /${match[1]}`);
    }
  }
});

test("each guide fits in one Components V2 message", async () => {
  const { view } = await load();
  const items = view.catalogItems();
  for (const [index, { entry }] of items.entries()) {
    const container = view.buildGuideContainer(entry.slash, "1", { index, total: items.length });
    assert.ok(container, `/${entry.slash} built no guide`);
    const json = container.toJSON();
    const text = JSON.stringify(json.components);
    assert.ok(json.components.length < 40, `/${entry.slash} has too many components`);
    assert.ok(text.length < 4000, `/${entry.slash} guide is too long (${text.length})`);
  }
});
