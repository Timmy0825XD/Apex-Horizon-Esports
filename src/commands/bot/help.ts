import { ContainerBuilder } from "discord.js";
import { emojis } from "../../emojis.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { commandIdFor } from "../../lib/register-slash.js";
import { helpCatalog } from "./catalog.js";
import { brandColors, divider, helpJumpRow, textBlock, type BotViewContext } from "./view.js";

function helpCommandId(slash: string, ctx: BotViewContext): string | undefined {
  const command = slash.split(" ")[0] ?? slash;
  if (command === "bot") {
    return ctx.commandId;
  }
  return commandIdFor(ctx.guildId, command);
}

/** "Admin, Organiser, or Helper" → "Admin · Organiser · Helper". */
export function formatAccess(access: string): string {
  return access.replace(/,? or /g, " · ").replace(/, /g, " · ");
}

export function normalizeHelpPage(page: number | undefined): number {
  if (page == null || Number.isNaN(page) || page < 0 || page >= helpCatalog.length) {
    return 0;
  }
  return page;
}

export function buildHelpContainer(ctx: BotViewContext): ContainerBuilder {
  const page = normalizeHelpPage(ctx.helpPage);
  const category = helpCatalog[page] ?? helpCatalog[0];
  const lines = category.entries.map((entry) => {
    const mention = formatHelpEntry(entry.slash, helpCommandId(entry.slash, ctx));
    return `${mention}\n${entry.summary}\n-# ${formatAccess(entry.access)}`;
  });

  return new ContainerBuilder()
    .setAccentColor(brandColors.gold)
    .addTextDisplayComponents(textBlock(`## ${emojis.help} ${category.title}`), textBlock(category.description))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(lines.join("\n\n")))
    .addSeparatorComponents(divider())
    .addActionRowComponents(helpJumpRow(page));
}
