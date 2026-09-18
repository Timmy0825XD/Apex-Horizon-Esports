import type { Attachment, ChatInputCommandInteraction, Guild } from "discord.js";
import type { GuildSettings } from "@prisma/client";
import { formatSheetLink } from "../../lib/formatters.js";
import { isAdminContext, requireAdmin } from "./access.js";
import { auditAddSheet } from "./audit.js";
import { deferTournament, respondTournament } from "./respond.js";
import { SheetError, detectCsvDelimiter, loadParsedSheet, parseCsv, parseSheetUrl } from "./sheet.js";
import { createManualSheet, findStoredSheetByLink } from "./store.js";
import {
  tournamentErrorMessage,
  tournamentSheetArchiveResultMessage,
  type SheetArchiveFail,
  type SheetArchiveOk,
  type SheetArchiveSkip,
} from "./view.js";

const MAX_CSV_BYTES = 512 * 1024;
const MAX_CSV_ROWS = 40;

type ManifestRow = {
  name: string;
  sheetLink: string;
};

function usageError() {
  return tournamentErrorMessage(
    "Need a sheet to archive",
    "For **one** sheet, fill **link** and **name**. To archive several, attach a **CSV** (column 1 = tournament name, column 2 = Google Sheet URL, no header row). Do not mix CSV with link/name.",
    false,
  );
}

function parseManifest(text: string): { rows: ManifestRow[]; invalid: number } {
  const rows: ManifestRow[] = [];
  let invalid = 0;
  for (const cells of parseCsv(text, detectCsvDelimiter(text))) {
    const name = cells[0]?.trim() ?? "";
    const sheetLink = cells[1]?.trim() ?? "";
    if (!name && !sheetLink) {
      continue;
    }
    if (!name || !sheetLink) {
      invalid += 1;
      continue;
    }
    rows.push({ name, sheetLink });
  }
  return { rows, invalid };
}

function isCsvAttachment(file: Attachment): boolean {
  const name = file.name.toLowerCase();
  const type = (file.contentType ?? "").toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".txt") || type.includes("csv") || type === "text/plain";
}

async function readAttachmentText(file: Attachment): Promise<string> {
  const response = await fetch(file.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error("Could not download that CSV.");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length);
    for (let i = 0; i + 1 < buffer.length; i += 2) {
      swapped[i] = buffer[i + 1] ?? 0;
      swapped[i + 1] = buffer[i] ?? 0;
    }
    return swapped.toString("utf16le");
  }
  return buffer.toString("utf8");
}

async function archiveOne(
  guild: Guild,
  row: ManifestRow,
  seen: Set<string>,
): Promise<{ ok: SheetArchiveOk } | { skip: SheetArchiveSkip } | { fail: SheetArchiveFail }> {
  if (seen.has(row.sheetLink)) {
    return { skip: { name: row.name, sheetLink: row.sheetLink, reason: "Repeated in this CSV." } };
  }
  seen.add(row.sheetLink);

  if (!parseSheetUrl(row.sheetLink)) {
    return {
      fail: {
        name: row.name,
        sheetLink: row.sheetLink,
        reason: "That is not a Google Sheet URL.",
      },
    };
  }

  if (await findStoredSheetByLink(row.sheetLink)) {
    return {
      skip: {
        name: row.name,
        sheetLink: row.sheetLink,
        reason: "Already in the global archive.",
      },
    };
  }

  try {
    const parsed = await loadParsedSheet(row.sheetLink);
    const saved = await createManualSheet(guild.id, guild.name, row.sheetLink, row.name, parsed);
    return {
      ok: {
        name: saved.tournamentName ?? row.name,
        sheetLink: saved.sheetLink,
        format: saved.format,
        teams: saved.teams.length,
        extraColumns: saved.additionalFieldCount,
        guildName: guild.name,
      },
    };
  } catch (error) {
    const reason = error instanceof SheetError ? error.message : "Unexpected error while reading that sheet.";
    return { fail: { name: row.name, sheetLink: row.sheetLink, reason } };
  }
}

export async function handleTournamentAddSheet(
  interaction: ChatInputCommandInteraction,
  commandId?: string,
): Promise<void> {
  await deferTournament(interaction);

  const access = await requireAdmin(interaction, "archive a sheet");
  if (!isAdminContext(access)) {
    await respondTournament(interaction, access.error);
    return;
  }

  const { guild, settings } = access;
  const link = interaction.options.getString("link")?.trim() || undefined;
  const name = interaction.options.getString("name")?.trim() || undefined;
  const csv = interaction.options.getAttachment("csv");

  if (csv && (link || name)) {
    await respondTournament(interaction, usageError());
    return;
  }

  if (csv) {
    await archiveFromCsv(interaction, guild, settings, csv, commandId);
    return;
  }

  if (!link || !name) {
    await respondTournament(interaction, usageError());
    return;
  }

  const result = await archiveOne(guild, { name, sheetLink: link }, new Set());
  if ("skip" in result) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Sheet already stored", "That Google Sheet is already in the global archive. `find_player` can already search it.", false),
    );
    return;
  }
  if ("fail" in result) {
    await respondTournament(interaction, tournamentErrorMessage("Could not archive sheet", result.fail.reason, false));
    return;
  }

  await respondTournament(
    interaction,
    tournamentSheetArchiveResultMessage(guild.name, [result.ok], [], [], commandId),
  );
  await auditAddSheet(interaction, guild, settings, [
    `**${result.ok.name}** · \`${result.ok.format}\` · **${result.ok.teams}** teams`,
    `**Sheet:** ${formatSheetLink(result.ok.sheetLink)}`,
  ]);
}

async function archiveFromCsv(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  file: Attachment,
  commandId?: string,
): Promise<void> {
  if (file.size > MAX_CSV_BYTES) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("CSV too large", `Keep the CSV under **${MAX_CSV_BYTES / 1024} KB**.`, false),
    );
    return;
  }
  if (!isCsvAttachment(file)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Need a CSV", "Attach a `.csv` with **name,link** on every row and **no header**.", false),
    );
    return;
  }

  let text: string;
  try {
    text = await readAttachmentText(file);
  } catch {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Could not read CSV", "Discord did not return that attachment. Try uploading it again.", false),
    );
    return;
  }

  const manifest = parseManifest(text);
  if (manifest.rows.length === 0) {
    const note =
      manifest.invalid > 0
        ? `Read **${manifest.invalid}** incomplete row${manifest.invalid === 1 ? "" : "s"} (need both a name and a link).`
        : "The CSV was empty. Put **tournament name** in column 1 and the **Google Sheet URL** in column 2, starting on row 1.";
    await respondTournament(interaction, tournamentErrorMessage("CSV had no sheets", note, false));
    return;
  }
  if (manifest.rows.length > MAX_CSV_ROWS) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Too many rows",
        `This CSV has **${manifest.rows.length}** sheets. Archive at most **${MAX_CSV_ROWS}** per command.`,
        false,
      ),
    );
    return;
  }

  const seen = new Set<string>();
  const archived: SheetArchiveOk[] = [];
  const skipped: SheetArchiveSkip[] = [];
  const failed: SheetArchiveFail[] = [];

  if (manifest.invalid > 0) {
    failed.push({
      name: "Incomplete rows",
      sheetLink: "",
      reason: `**${manifest.invalid}** row${manifest.invalid === 1 ? "" : "s"} missing a name or a link.`,
    });
  }

  for (const row of manifest.rows) {
    const result = await archiveOne(guild, row, seen);
    if ("ok" in result) {
      archived.push(result.ok);
    } else if ("skip" in result) {
      skipped.push(result.skip);
    } else {
      failed.push(result.fail);
    }
  }

  await respondTournament(
    interaction,
    tournamentSheetArchiveResultMessage(guild.name, archived, skipped, failed, commandId),
  );

  if (archived.length > 0) {
    await auditAddSheet(
      interaction,
      guild,
      settings,
      archived.map((row) => `**${row.name}** · \`${row.format}\` · **${row.teams}** teams · ${formatSheetLink(row.sheetLink)}`),
    );
  }
}
