import {
  AttachmentBuilder,
  ContainerBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatSheetLink } from "../../lib/formatters.js";
import { attachedFile, divider, textBlock, v2Flags } from "../../lib/v2.js";
import { deferTournament, respondTournament } from "./respond.js";
import {
  findStoredSheetById,
  findStoredSheetsByName,
  listStoredSheetSummaries,
  type StoredSheetSummary,
} from "./store.js";
import { tournamentErrorMessage } from "./view.js";

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

function sheetLines(sheet: StoredSheetSummary): string {
  const event = sheet.tournamentName ? `**${sheet.tournamentName}**` : "Untitled sheet";
  const server = sheet.guildName || "Unknown server";
  return [
    `> ${event} (\`${sheet.format}\`, ${originLabel(sheet.origin)})`,
    `> **Server:** **${server}**`,
    `> ${formatSheetLink(sheet.sheetLink)}`,
  ].join("\n");
}

function lookupContainer(query: string, matches: StoredSheetSummary[]): ContainerBuilder {
  if (matches.length === 0) {
    return new ContainerBuilder()
      .setAccentColor(embedColors.error)
      .addTextDisplayComponents(
        textBlock(`# ${emojis.error} No sheet named that`),
        textBlock(`Nothing in the global archive matched **${query}**. Try another name or export the CSV catalog.`),
      );
  }

  if (matches.length === 1) {
    const sheet = matches[0];
    const title = sheet?.tournamentName ? `**${sheet.tournamentName}**` : "this sheet";
    return new ContainerBuilder()
      .setAccentColor(embedColors.info)
      .addTextDisplayComponents(
        textBlock(`# ${emojis.info} Sheet for ${title}`),
        textBlock("This is the stored Google Sheet for that tournament in the global archive."),
        textBlock(sheet ? sheetLines(sheet) : ""),
      );
  }

  return new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(
      textBlock(`# ${emojis.info} Several sheets matched`),
      textBlock(`**${matches.length}** stored sheets matched **${query}**. Each one is a different archive entry.`),
      textBlock(matches.map(sheetLines).join("\n\n")),
    );
}

function catalogContainer(count: number): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(
      textBlock(`# ${emojis.success} Sheet catalog`),
      textBlock(
        `Exported **${count}** stored tournament${count === 1 ? "" : "s"} and their Google Sheet links from the global archive.`,
      ),
    )
    .addSeparatorComponents(divider())
    .addFileComponents(attachedFile(SHEET_CSV_NAME));
}

export function tournamentGetSheetMessage(input: {
  query?: string;
  matches: StoredSheetSummary[];
  catalog: StoredSheetSummary[];
  csv: boolean;
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
            textBlock(`# ${emojis.info} Archive is empty`),
            textBlock("There are no stored sheets to put in a CSV yet. Archive one with `/tournament add_sheet`."),
          ),
      );
    } else {
      containers.push(catalogContainer(input.catalog.length));
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

export async function handleTournamentGetSheet(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString("name")?.trim() || undefined;
  const csv = interaction.options.getBoolean("csv") ?? false;

  if (!query && !csv) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Need a name or CSV",
        "Pick a **name** to get that sheet link, or set **csv** to export every stored tournament and its sheet.",
      ),
    );
    return;
  }

  await deferTournament(interaction, true);

  const liveName = (guildId: string, stored: string) =>
    interaction.client.guilds.cache.get(guildId)?.name ?? (stored || "Unknown server");

  let matches: StoredSheetSummary[] = [];
  if (query) {
    const byId = await findStoredSheetById(query);
    matches = byId ? [byId] : await findStoredSheetsByName(query);
  }

  const catalog = csv ? await listStoredSheetSummaries() : [];

  await respondTournament(
    interaction,
    tournamentGetSheetMessage({
      query,
      matches: matches.map((sheet) => withLiveGuildName(sheet, liveName(sheet.guildId, sheet.guildName))),
      catalog: catalog.map((sheet) => withLiveGuildName(sheet, liveName(sheet.guildId, sheet.guildName))),
      csv,
    }),
  );
}
