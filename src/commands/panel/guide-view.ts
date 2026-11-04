import { ContainerBuilder } from "discord.js";
import { emojis } from "../../emojis.js";
import { slashCommands, slashMention } from "../../lib/register-slash.js";
import { divider, textBlock } from "../../lib/v2.js";
import { formatAccess } from "../bot/help.js";
import { helpCatalog, type HelpCategory, type HelpEntry } from "../bot/catalog.js";
import { guideFor, type Guide } from "./guides/index.js";

/** One accent and one emoji per family, so a channel of guides reads by family at a glance. */
const familyLook: Record<string, { color: number; emoji: string }> = {
  Bot: { color: 0xc8102e, emoji: emojis.runtime },
  Settings: { color: 0x7f8c8d, emoji: emojis.settings },
  Staff: { color: 0x9b59b6, emoji: emojis.judge_recorder },
  Tournament: { color: 0xd4a017, emoji: emojis.torneo },
  Sheet: { color: 0x2ecc71, emoji: emojis.rules },
  Room: { color: 0xe67e22, emoji: emojis.challonge },
  Schedule: { color: 0x3498db, emoji: emojis.calendar },
  Attendance: { color: 0x1abc9c, emoji: emojis.stats },
  Ticket: { color: 0xf1c40f, emoji: emojis.open_close },
  Role: { color: 0xe91e63, emoji: emojis.gem },
  Server: { color: 0x5865f2, emoji: emojis.server },
  Utility: { color: 0x95a5a6, emoji: emojis.random },
  Panel: { color: 0xeb459e, emoji: emojis.help },
};

export function lookFor(family: string): { color: number; emoji: string } {
  return familyLook[family] ?? { color: 0x5865f2, emoji: emojis.info };
}

type RawOption = { name: string; description: string; type: number; required?: boolean; options?: RawOption[] };

const SUBCOMMAND = 1;
const SUBCOMMAND_GROUP = 2;

/** The options of `"schedule results add"`, straight from the registered builder. */
function builderOptions(slash: string): RawOption[] {
  const [name, ...path] = slash.split(" ");
  let options = slashCommands.find((command) => command.name === name)?.options as RawOption[] | undefined;
  for (const part of path) {
    options = options?.find((option) => option.name === part)?.options;
  }
  return (options ?? []).filter((option) => option.type !== SUBCOMMAND && option.type !== SUBCOMMAND_GROUP);
}

/** `image1 … image10` for numbered runs, `judge · recorder` otherwise. */
function optionLabel(names: string[]): string {
  const prefix = names[0]?.match(/^(\D+)\d+$/)?.[1];
  if (names.length > 3 && prefix && names.every((name) => name.match(/^(\D+)\d+$/)?.[1] === prefix)) {
    return `\`${names[0]}\` … \`${names[names.length - 1]}\``;
  }
  return names.map((name) => `\`${name}\``).join(" · ");
}

export function optionLines(slash: string, texts: Guide["options"] = {}): string[] {
  const raw = builderOptions(slash);
  const known = new Set(raw.map((option) => option.name));
  const done = new Set<string>();
  const lines: string[] = [];

  for (const option of raw) {
    if (done.has(option.name)) {
      continue;
    }
    const key = Object.keys(texts).find((group) => group.split(" ").includes(option.name));
    const names = key ? key.split(" ").filter((name) => known.has(name)) : [option.name];
    for (const name of names) {
      done.add(name);
    }
    const required = raw.some((candidate) => names.includes(candidate.name) && candidate.required);
    const text = key ? texts[key] : option.description;
    lines.push(`${optionLabel(names)}: ${text}${required ? "" : " *Optional.*"}`);
  }
  return lines;
}

/** Turns every `{/command sub}` into a clickable slash mention. */
function withMentions(text: string, guildId: string | null): string {
  return text.replace(/\{\/([a-z0-9 ]+)\}/g, (_, path: string) => slashMention(guildId, path));
}

export type CatalogItem = { family: HelpCategory; entry: HelpEntry };

/** Every command once, in catalog order. A command listed in two families keeps the first one. */
export function catalogItems(): CatalogItem[] {
  const seen = new Set<string>();
  const items: CatalogItem[] = [];
  for (const family of helpCatalog) {
    for (const entry of family.entries) {
      if (!seen.has(entry.slash)) {
        seen.add(entry.slash);
        items.push({ family, entry });
      }
    }
  }
  return items;
}

export function catalogItem(slash: string): CatalogItem | undefined {
  return catalogItems().find((item) => item.entry.slash === slash);
}

export function buildGuideContainer(
  slash: string,
  guildId: string | null,
  position: { index: number; total: number },
): ContainerBuilder | null {
  const item = catalogItem(slash);
  const guide = guideFor(slash);
  if (!item || !guide) {
    return null;
  }
  const look = lookFor(item.family.title);
  const mention = (text: string) => withMentions(text, guildId);

  const who = [`**${formatAccess(item.entry.access)}**`];
  if (guide.where) {
    who.push(`-# ${mention(guide.where)}`);
  }

  const container = new ContainerBuilder()
    .setAccentColor(look.color)
    .addTextDisplayComponents(
      textBlock(`-# Staff Guide · ${item.family.title}\n## ${look.emoji} ${slashMention(guildId, slash)}`),
      textBlock(item.entry.summary),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`### Who can use it\n${who.join("\n")}`),
      textBlock(`### How it works\n${guide.steps.map((step, i) => `${i + 1}. ${mention(step)}`).join("\n")}`),
    );

  const options = optionLines(slash, guide.options);
  if (options.length > 0) {
    container.addTextDisplayComponents(textBlock(`### Options\n${options.map((line) => `- ${mention(line)}`).join("\n")}`));
  }

  container.addTextDisplayComponents(
    textBlock(`### Keep in mind\n${guide.notes.map((note) => `- ${mention(note)}`).join("\n")}`),
  );

  if (guide.related && guide.related.length > 0) {
    container.addTextDisplayComponents(
      textBlock(`### Related\n${guide.related.map((path) => slashMention(guildId, path)).join(" · ")}`),
    );
  }

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Staff guide ${position.index + 1} of ${position.total}`));
}
