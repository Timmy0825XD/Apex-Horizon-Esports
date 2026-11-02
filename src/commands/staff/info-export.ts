import {
  AttachmentBuilder,
  ContainerBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { Workbook } from "exceljs";
import { emojis } from "../../emojis.js";
import { actorMatches } from "../../lib/command-access.js";
import { embedColors } from "../../lib/embeds.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { staffCommandIdFor } from "../../lib/register-slash.js";
import { attachedFile, textBlock, v2Flags } from "../../lib/v2.js";
import { roleFields } from "./fields.js";
import { loadGuildStaffState } from "./store.js";
import { staffErrorMessage } from "./view.js";

type Status = "Active" | "No staff role" | "Left server";

const STATUS_ORDER: Record<Status, number> = { Active: 0, "No staff role": 1, "Left server": 2 };

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `/staff info export`: Organiser only, read-only, no audit. */
export async function handleStaffInfoExport(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply(staffErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }
  if (!(await actorMatches(interaction, { organiser: true }))) {
    await interaction.reply(
      staffErrorMessage("Organiser only", "You need the **Organiser** role or Administrator to export staff info."),
    );
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { staff } = await loadGuildStaffState(guild.id);
  const rows = await prisma.staffInfo.findMany({ where: { guildId: guild.id } });
  if (rows.length === 0) {
    await interaction.editReply({
      flags: v2Flags,
      components: [
        new ContainerBuilder()
          .setAccentColor(embedColors.info)
          .addTextDisplayComponents(
            textBlock(`# ${emojis.info} No staff info yet`),
            textBlock(
              `Nobody has registered. Staff members add theirs with ${formatHelpEntry("staff info add", staffCommandIdFor(guild.id))}.`,
            ),
          ),
      ],
    });
    return;
  }

  const fetched = await guild.members.fetch({ user: rows.map((row) => row.userId) }).catch(() => null);
  const members = new Map<string, GuildMember>(fetched ? [...fetched.entries()] : []);
  await guild.roles.fetch().catch(() => undefined);

  const records = rows.map((row) => {
    const member = members.get(row.userId) ?? null;
    const roleNames = member && staff
      ? roleFields
          .map((field) => staff[field.key])
          .filter((id): id is string => Boolean(id) && member.roles.cache.has(id as string))
          .map((id) => guild.roles.cache.get(id)?.name ?? id)
      : [];
    const hasStaffRole = Boolean(member && staff && member.roles.cache.has(staff.staffRoleId));
    const status: Status = !member ? "Left server" : hasStaffRole ? "Active" : "No staff role";
    return {
      tag: member?.user.username ?? row.discordTag,
      row,
      roles: roleNames.join(", "),
      status,
    };
  });
  records.sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.tag.localeCompare(b.tag),
  );

  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Staff Info", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "#", width: 5 },
    { header: "Discord Tag", width: 24 },
    { header: "Discord ID", width: 22 },
    { header: "Game Name", width: 22 },
    { header: "Game ID", width: 20 },
    { header: "Staff Roles", width: 40 },
    { header: "Status", width: 15 },
    { header: "Registered", width: 12 },
    { header: "Updated", width: 12 },
  ];
  records.forEach((record, index) => {
    sheet.addRow([
      index + 1,
      record.tag,
      record.row.userId,
      record.row.gameName,
      record.row.gameId,
      record.roles,
      record.status,
      day(record.row.createdAt),
      day(record.row.updatedAt),
    ]);
  });
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  const filename = `staff-info-${day(new Date())}.xlsx`;
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const active = records.filter((record) => record.status === "Active").length;

  await interaction.editReply({
    flags: v2Flags,
    files: [new AttachmentBuilder(buffer, { name: filename })],
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.members} Staff info export`),
          textBlock(
            `**${records.length}** registered · **${active}** still hold the staff role. Tags and roles were read from Discord just now.`,
          ),
        )
        .addFileComponents(attachedFile(filename)),
    ],
  });
}
