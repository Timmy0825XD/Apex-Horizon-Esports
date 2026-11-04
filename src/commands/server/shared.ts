import { Workbook } from "exceljs";
import {
  AttachmentBuilder,
  ContainerBuilder,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import { isOrganiser } from "../../lib/permissions.js";
import { attachedFile, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";
import { serverErrorMessage } from "./view.js";
import { loadGuildConfig } from "../../lib/guild-config.js";

export function fileSlug(guild: Guild): string {
  const slug = guild.name
    .replace(/[^\w]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || guild.id;
}

export function formatUtc(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function tsvBuffer(headers: string[], rows: string[][]): Buffer {
  const lines = [headers.join("\t"), ...rows.map((row) => row.join("\t"))];
  return Buffer.from(`\uFEFF${lines.join("\n")}\n`, "utf8");
}

export function textBuffer(content: string): Buffer {
  return Buffer.from(`\uFEFF${content.trimEnd()}\n`, "utf8");
}

export async function xlsxBuffer(
  sheetName: string,
  columns: Array<{ header: string; key: string; width: number }>,
  rows: Array<Record<string, string>>,
): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((column) => ({ ...column }));
  for (const column of columns) {
    sheet.getColumn(column.key).numFmt = "@";
  }
  for (const row of rows) {
    sheet.addRow(row);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function loadStaff(guildId: string) {
  try {
    return (await loadGuildConfig(guildId)).staff;
  } catch {
    return null;
  }
}

export async function requireOrganiser(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  action: string,
): Promise<boolean> {
  const staff = await loadStaff(guild.id);
  if (isOrganiser(interaction, staff)) {
    return true;
  }

  await interaction.reply(
    serverErrorMessage(
      "Organiser required",
      `Only an **Organiser** (manager role) or a Discord **Administrator** can ${action}.`,
    ),
  );
  return false;
}

export async function replyExport(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  input: {
    /** Emoji for this export: `banned`, `link`, `channels`. */
    emoji: string;
    title: string;
    /** One line of counts, e.g. `**Bans** \`23\` · **With reason** \`18\``. */
    summary: string;
    excel: boolean;
    filename: string;
    data: Buffer;
  },
): Promise<void> {
  const { filename, data } = input;
  const icon = guild.iconURL({ size: 256 });
  const heading = `## ${input.emoji} ${input.title}\n-# ${escapeDiscord(guild.name)} · ${input.excel ? "Excel" : "Text"}`;
  const container = new ContainerBuilder().setAccentColor(embedColors.success);

  if (icon) {
    container.addSectionComponents(headingWithThumbnail(heading, icon, input.summary));
  } else {
    container.addTextDisplayComponents(textBlock(heading), textBlock(input.summary));
  }

  container
    .addFileComponents(attachedFile(filename))
    .addTextDisplayComponents(
      textBlock(`-# Exported by ${formatUser(interaction.user.id)} · <t:${Math.floor(Date.now() / 1000)}:F>`),
    );

  await interaction.editReply({
    components: [container],
    files: [new AttachmentBuilder(data, { name: filename })],
    flags: v2Flags,
  });
}
