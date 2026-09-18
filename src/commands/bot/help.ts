import { ContainerBuilder } from "discord.js";
import { embedColors } from "../../lib/embeds.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { helpCatalog } from "./catalog.js";
import { divider, helpPagerRow, textBlock, type BotViewContext } from "./view.js";

function helpCommandId(slash: string, ctx: BotViewContext): string | undefined {
  if (slash.startsWith("bot ")) {
    return ctx.commandId;
  }
  if (slash.startsWith("settings ")) {
    return ctx.settingsCommandId;
  }
  if (slash.startsWith("server ")) {
    return ctx.serverCommandId;
  }
  if (slash.startsWith("staff ")) {
    return ctx.staffCommandId;
  }
  if (slash.startsWith("tournament ")) {
    return ctx.tournamentCommandId;
  }
  if (slash.startsWith("team ")) {
    return ctx.teamCommandId;
  }
  if (slash.startsWith("utility ")) {
    return ctx.utilityCommandId;
  }
  return undefined;
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
    return `${mention}\n${entry.summary}\n*${entry.access}*`;
  });

  return new ContainerBuilder()
    .setAccentColor(embedColors.error)
    .addTextDisplayComponents(
      textBlock(`# ${category.title}`),
      textBlock(category.description),
      textBlock(lines.join("\n\n")),
      textBlock(`-# ${category.title} · Category ${page + 1}/${helpCatalog.length}`),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(helpPagerRow(page));
}
