import { Workbook } from "exceljs";
import {
  AttachmentBuilder,
  ContainerBuilder,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { isOrganiser } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { attachedFile, divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { serverErrorMessage } from "./view.js";

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
    const guild = await prisma.guild.findUnique({
      where: { guildId },
      select: { staff: true },
    });
    return guild?.staff ?? null;
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
  title: string,
  summary: string,
  filename: string,
  data: Buffer,
): Promise<void> {
  const icon = guild.iconURL({ size: 256 });
  const heading = `# ${emojis.success} ${title}`;
  const container = new ContainerBuilder().setAccentColor(embedColors.success);

  if (icon) {
    container.addSectionComponents(headingWithThumbnail(heading, icon, summary));
  } else {
    container.addTextDisplayComponents(textBlock(heading), textBlock(summary));
  }

  container.addSeparatorComponents(divider()).addFileComponents(attachedFile(filename));

  await interaction.editReply({
    components: [container],
    files: [new AttachmentBuilder(data, { name: filename })],
    flags: v2Flags,
  });
}
