import type { ChatInputCommandInteraction, Guild, User } from "discord.js";
import type { GuildSettings } from "@prisma/client";
import { fact, publishAudit, type AuditAction, type AuditGroup } from "../../lib/audit.js";
import { formatChannel } from "../../lib/formatters.js";

export async function auditScoreUpload(
  actor: ChatInputCommandInteraction | { user: User },
  guild: Guild,
  settings: GuildSettings,
  input: {
    action: "uploaded" | "corrected" | "disqualified" | "forfeited";
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
  const score = `\`${input.score1} - ${input.score2}\``;
  const corrected = input.action === "corrected" && input.oldScore1 != null && input.oldScore2 != null;
  const match: string[] = [`**${input.leftName} vs ${input.rightName}** · ID \`${input.matchId}\``];
  if (input.channelId) {
    match.push(fact("Ticket", formatChannel(guild, input.channelId)));
  }
  const result: string[] = [
    corrected ? fact("Score", `\`${input.oldScore1} - ${input.oldScore2}\` → ${score}`) : fact("Score", score),
    fact("Winner", `**${input.winnerName}**`),
  ];
  if (input.rebuilt != null && input.rebuilt > 0) {
    result.push(fact("Rooms rebuilt", `\`${input.rebuilt}\``));
  }
  const groups: AuditGroup[] = [
    { label: "Match", lines: match },
    { label: corrected ? "Changes" : "Result", lines: result },
  ];
  if (input.note?.trim()) {
    groups.push({ lines: [fact("Note", `*${input.note.trim()}*`)] });
  }
  const view: Record<typeof input.action, { action: AuditAction; title: string; summary: string }> = {
    uploaded: { action: "created", title: "Score uploaded", summary: `The official score was posted to the bracket of **${input.tournamentName}**.` },
    corrected: { action: "updated", title: "Score corrected", summary: `The bracket score changed in **${input.tournamentName}**.` },
    disqualified: { action: "deleted", title: "Both sides disqualified", summary: `Side 2 was eliminated and side 1 will forfeit its next match in **${input.tournamentName}**.` },
    forfeited: { action: "deleted", title: "Forfeit applied", summary: `A marked side lost its match without a ticket in **${input.tournamentName}**.` },
  };

  await publishAudit({
    guild,
    channelId: settings.challongeLogsChannelId,
    module: "scoreUpload",
    ...view[input.action],
    groups,
    actor: actor.user,
  });
}
