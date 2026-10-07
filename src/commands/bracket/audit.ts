import type { ChatInputCommandInteraction, Guild, User } from "discord.js";
import type { GuildSettings } from "@prisma/client";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatChannel } from "../../lib/formatters.js";

export async function auditScoreUpload(
  actor: ChatInputCommandInteraction | { user: User },
  guild: Guild,
  settings: GuildSettings,
  input: {
    action: "uploaded" | "corrected";
    tournamentName: string;
    matchId: number;
    leftName: string;
    rightName: string;
    score1: number;
    score2: number;
    winnerName: string;
    oldScore1?: number | null;
    oldScore2?: number | null;
    channelId?: string;
    note?: string | null;
    rebuilt?: number;
  },
): Promise<void> {
  const details = [
    `**Tournament:** **${input.tournamentName}**`,
    `**Match ID:** \`${input.matchId}\``,
    `**Match:** ${input.leftName} vs ${input.rightName}`,
    `**Score:** \`${input.score1} - ${input.score2}\``,
    `**Winner:** ${input.winnerName}`,
  ];
  if (input.action === "corrected" && input.oldScore1 != null && input.oldScore2 != null) {
    details.splice(3, 0, `**Previous score:** \`${input.oldScore1} - ${input.oldScore2}\``);
  }
  if (input.channelId) {
    details.push(`**Ticket:** ${formatChannel(guild, input.channelId)}`);
  }
  if (input.note?.trim()) {
    details.push(`**Note:** ${input.note.trim()}`);
  }
  if (input.rebuilt != null && input.rebuilt > 0) {
    details.push(`**Rooms rebuilt:** **${input.rebuilt}**`);
  }

  await publishAudit({
    guild,
    channelId: settings.challongeLogsChannelId,
    title: auditLogTitles.scoreUpload,
    description:
      input.action === "uploaded"
        ? `Official score uploaded for **${input.tournamentName}**.`
        : `Bracket score corrected for **${input.tournamentName}**.`,
    details,
    actor: actor.user,
  });
}
