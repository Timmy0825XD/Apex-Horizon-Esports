import {
  AttachmentBuilder,
  ContainerBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatHelpEntry, formatSheetLink, formatUser } from "../../lib/formatters.js";
import { escapeDiscord } from "../room/labels.js";
import { attachedFile, divider, textBlock, v2Flags } from "../../lib/v2.js";
import {
  findStoredSheetById,
  findStoredSheetsByName,
  listStoredSheetSummaries,
  type StoredSheetSummary,
} from "../tournament/store.js";
import { actorMatches } from "../../lib/command-access.js";
import { deferSheet, respondSheet } from "./respond.js";
import { sheetButtonRow, sheetErrorMessage } from "./view.js";

const SHEET_CSV_NAME = "tournament-sheets.csv";

function originLabel(origin: StoredSheetSummary["origin"]): string {
  if (origin === "historical") {
    return "historical";
  }
  if (origin === "manual") {
    return "manual archive";
  }
  return "active tournament";
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function storedSheetCatalogCsv(sheets: StoredSheetSummary[]): Buffer {
  const header = ["Tournament", "Sheet", "Server"];
  const lines = [
    header.join(","),
    ...sheets.map((sheet) =>
      [sheet.tournamentName || "Untitled sheet", sheet.sheetLink, sheet.guildName || "Unknown server"]
        .map(csvCell)
        .join(","),
    ),
  ];
  return Buffer.from(`\uFEFF${lines.join("\n")}\n`, "utf8");
}

function sheetLine(sheet: StoredSheetSummary): string {
  const event = sheet.tournamentName ? `**${escapeDiscord(sheet.tournamentName)}**` : "Untitled sheet";
  const server = escapeDiscord(sheet.guildName || "Unknown server");
  return `- ${event} · \`${sheet.format}\` · ${originLabel(sheet.origin)} · **${server}** · ${formatSheetLink(sheet.sheetLink)}`;
}

function lookupContainer(query: string, matches: StoredSheetSummary[]): ContainerBuilder {
  if (matches.length === 0) {
    return new ContainerBuilder()
      .setAccentColor(embedColors.error)
      .addTextDisplayComponents(
        textBlock(`## ${emojis.error} No Sheet Named That`),
        textBlock(`Nothing in the global archive matched **${escapeDiscord(query)}**. Try another name or export the CSV catalog.`),
      );
  }

  const sheet = matches[0];
  if (matches.length === 1 && sheet) {
    const title = sheet.tournamentName ? escapeDiscord(sheet.tournamentName) : "Untitled sheet";
    const container = new ContainerBuilder()
      .setAccentColor(embedColors.info)
      .addTextDisplayComponents(
        textBlock(`## ${emojis.info} ${title}\n-# Global archive · ${originLabel(sheet.origin)}`),
        textBlock(`\`${sheet.format}\` · ${emojis.server} **${escapeDiscord(sheet.guildName || "Unknown server")}**`),
      );
    const button = sheetButtonRow(sheet.sheetLink);
    if (button) {
      container.addActionRowComponents(button);
    }
    return container;
  }

  return new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(
      textBlock(`## ${emojis.info} Sheets Matched\n\`${matches.length}\` stored sheets matched **${escapeDiscord(query)}**.`),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(matches.map(sheetLine).join("\n")));
}

function catalogContainer(count: number, actorId: string): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(
      textBlock(
        `## ${emojis.success} Sheet Catalog\n\`${count}\` stored ${count === 1 ? "tournament" : "tournaments"} and their Google Sheet links.`,
      ),
    )
    .addFileComponents(attachedFile(SHEET_CSV_NAME))
    .addTextDisplayComponents(
      textBlock(`-# Exported by ${formatUser(actorId)} · <t:${Math.floor(Date.now() / 1000)}:F>`),
    );
}

export function sheetGetMessage(input: {
  query?: string;
  matches: StoredSheetSummary[];
  catalog: StoredSheetSummary[];
  csv: boolean;
  commandId?: string;
  actorId: string;
}): InteractionReplyOptions {
  const containers: ContainerBuilder[] = [];
  const files: AttachmentBuilder[] = [];

  if (input.query) {
    containers.push(lookupContainer(input.query, input.matches));
  }

  if (input.csv) {
    if (input.catalog.length === 0) {
      containers.push(
        new ContainerBuilder()
          .setAccentColor(embedColors.info)
          .addTextDisplayComponents(
            textBlock(`## ${emojis.info} Archive Is Empty`),
            textBlock(
              `There are no stored sheets to put in a CSV yet. Archive one with ${formatHelpEntry("sheet add", input.commandId)}.`,
            ),
          ),
      );
    } else {
      containers.push(catalogContainer(input.catalog.length, input.actorId));
      files.push(new AttachmentBuilder(storedSheetCatalogCsv(input.catalog), { name: SHEET_CSV_NAME }));
    }
  }

  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    components: containers,
    files,
  };
}

function withLiveGuildName(sheet: StoredSheetSummary, liveName: string | undefined): StoredSheetSummary {
  return {
    ...sheet,
    guildName: liveName ?? (sheet.guildName || "Unknown server"),
  };
}

export async function handleSheetGet(interaction: ChatInputCommandInteraction, commandId?: string): Promise<void> {
  if (!(await actorMatches(interaction, { admin: true, organiser: true }))) {
    await respondSheet(
      interaction,
      sheetErrorMessage("Admin or organiser required", "You need **Admin** or **Organiser** to read stored sheets."),
    );
    return;
  }

  const query = interaction.options.getString("name")?.trim() || undefined;
  const csv = interaction.options.getBoolean("csv") ?? false;

  if (!query && !csv) {
    await respondSheet(
      interaction,
      sheetErrorMessage(
        "Need a name or CSV",
        "Pick a **name** to get that sheet link, or set **csv** to export every stored tournament and its sheet.",
      ),
    );
    return;
  }

  await deferSheet(interaction, true);

  const liveName = (guildId: string, stored: string) =>
    interaction.client.guilds.cache.get(guildId)?.name ?? (stored || "Unknown server");

  let matches: StoredSheetSummary[] = [];
  if (query) {
    const byId = await findStoredSheetById(query);
    matches = byId ? [byId] : await findStoredSheetsByName(query);
  }

  const catalog = csv ? await listStoredSheetSummaries() : [];

  await respondSheet(
    interaction,
    sheetGetMessage({
      query,
      matches: matches.map((sheet) => withLiveGuildName(sheet, liveName(sheet.guildId, sheet.guildName))),
      catalog: catalog.map((sheet) => withLiveGuildName(sheet, liveName(sheet.guildId, sheet.guildName))),
      csv,
      commandId,
      actorId: interaction.user.id,
    }),
  );
}
