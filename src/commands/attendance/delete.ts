import type { StaffConfig } from "@prisma/client";
import { EmbedBuilder, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { errorEmbed } from "../../lib/embeds.js";
import { isGuildAdmin, isOrganiser } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { escapeDiscord } from "../room/labels.js";
import { textChannel } from "../schedule/channel.js";
import { attachResultsLinks } from "../schedule/results.js";
import { loadTicket } from "../schedule/ticket.js";
import { attendanceAuditDetails, auditAttendance } from "./audit.js";
import { v2Flags } from "../../lib/v2.js";
import { deletedMessage } from "./view.js";
import { deferPublic } from "./respond.js";
import { listActiveAttendance } from "./store.js";

export async function handleAttendanceDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed("Guild only", "This command can only be used in a server.")] });
    return;
  }
  await deferPublic(interaction);
  const fail = async (embed: EmbedBuilder) => {
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    await interaction.deleteReply().catch(() => undefined);
  };
  if (!interaction.options.getBoolean("confirm", true)) {
    await fail(errorEmbed("Confirmation required", "Set **confirm** to true to delete this attendance."));
    return;
  }
  const bundle = await loadTicket(interaction);
  if (typeof bundle === "string") {
    await fail(errorEmbed("Ticket required", bundle));
    return;
  }
  const rows = await listActiveAttendance(guild.id, bundle.tournament.id, bundle.match.challongeMatchId);
  if (rows.length === 0) {
    await fail(errorEmbed("No attendance", "This ticket does not have an active attendance record."));
    return;
  }
  const privileged = isGuildAdmin(interaction, bundle.settings) || isOrganiser(interaction, bundle.staff as StaffConfig | null);
  if (!privileged && rows.some((row) => row.createdBy !== interaction.user.id)) {
    await fail(errorEmbed("Cannot delete", "Only the person who marked this attendance, an admin, or an organiser can delete it."));
    return;
  }

  const reason = interaction.options.getString("reason")?.trim() || null;
  await prisma.attendance.updateMany({
    where: { id: { in: rows.map((row) => row.id) } },
    data: { deletedAt: new Date(), deletedReason: reason },
  });

  const board = await textChannel(guild, bundle.tournament.attendanceChannelId);
  await Promise.all(
    rows.map(async (row) => {
      const ticketMessage = await bundle.channel.messages.fetch(row.ticketMessageId).catch(() => null);
      await ticketMessage?.delete().catch(() => undefined);
      await board?.messages.delete(row.attendanceChannelMessageId).catch(() => undefined);
    }),
  );
  await attachResultsLinks(guild, bundle.tournament.id, bundle.match.challongeMatchId, []).catch(() => undefined);

  await auditAttendance({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    description: "Attendance Deleted",
    details: attendanceAuditDetails({
      tournamentName: bundle.tournament.name,
      channelId: bundle.channel.id,
      judgeId: rows[0].judgeId,
      recorderId: rows[0].recorderId,
      extra: reason ? [`**Reason:** ${escapeDiscord(reason)}`] : [],
    }),
  });

  const removed = deletedMessage({
    tournamentName: bundle.tournament.name,
    channelId: bundle.channel.id,
    reason,
  });
  await interaction.editReply({
    content: null,
    embeds: [],
    components: removed.components,
    flags: v2Flags,
    allowedMentions: removed.allowedMentions,
  });
}
