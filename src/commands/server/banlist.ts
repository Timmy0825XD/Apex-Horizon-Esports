import {
  AuditLogEvent,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { v2Flags } from "../../lib/v2.js";
import {
  fileSlug,
  formatUtc,
  replyExport,
  requireOrganiser,
  tsvBuffer,
  xlsxBuffer,
} from "./shared.js";
import { serverErrorMessage, serverInfoMessage } from "./view.js";

type BanRow = {
  id: string;
  date: string;
  reason: string;
};

type TrackedBan = {
  createdAt: Date;
  reason: string | null;
};

function flattenReason(reason: string | null | undefined): string | undefined {
  const text = reason?.replace(/\s+/g, " ").trim();
  return text ? text : undefined;
}

async function loadBanDatesFromAudit(guild: Guild): Promise<Map<string, Date>> {
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 100 });
    const dates = new Map<string, Date>();
    for (const entry of logs.entries.values()) {
      const targetId = entry.targetId;
      if (targetId && !dates.has(targetId)) {
        dates.set(targetId, entry.createdAt);
      }
    }
    return dates;
  } catch {
    return new Map();
  }
}

async function loadTrackedBans(guildId: string): Promise<Map<string, TrackedBan>> {
  try {
    const tracked = await prisma.ban.findMany({
      where: { guildId },
      select: { userId: true, createdAt: true, reason: true },
    });
    return new Map(tracked.map((ban) => [ban.userId, { createdAt: ban.createdAt, reason: ban.reason }]));
  } catch {
    return new Map();
  }
}

function sortRows(rows: BanRow[]): BanRow[] {
  return [...rows].sort((a, b) => {
    if (a.date === "Unknown" && b.date !== "Unknown") {
      return 1;
    }
    if (a.date !== "Unknown" && b.date === "Unknown") {
      return -1;
    }
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    return a.id.localeCompare(b.id);
  });
}

export async function handleServerBanlist(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!(await requireOrganiser(interaction, guild, "export the ban list"))) {
    return;
  }

  if (!guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
    await interaction.reply(
      serverErrorMessage(
        "Missing permission",
        "I need the **Ban Members** permission to read this server's ban list.",
      ),
    );
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let bans;
  try {
    bans = await guild.bans.fetch();
  } catch {
    const payload = serverErrorMessage("Ban list unavailable", "Discord did not return this server's bans.", false);
    await interaction.editReply({
      components: payload.components,
      flags: v2Flags,
    });
    return;
  }

  if (bans.size === 0) {
    const payload = serverInfoMessage("No bans", "This server has no Discord bans to export.", false);
    await interaction.editReply({
      components: payload.components,
      flags: v2Flags,
    });
    return;
  }

  const tracked = await loadTrackedBans(guild.id);
  const auditDates = await loadBanDatesFromAudit(guild);
  const rows = sortRows(
    [...bans.values()].map((ban) => {
      const saved = tracked.get(ban.user.id);
      const bannedAt = saved?.createdAt ?? auditDates.get(ban.user.id);
      return {
        id: ban.user.id,
        date: bannedAt ? formatUtc(bannedAt) : "Unknown",
        reason: flattenReason(ban.reason) ?? flattenReason(saved?.reason) ?? "No reason provided",
      };
    }),
  );

  const asExcel = interaction.options.getBoolean("excel") ?? false;
  const base = `banlist-${fileSlug(guild)}`;
  const filename = asExcel ? `${base}.xlsx` : `${base}.txt`;
  const data = asExcel
    ? await xlsxBuffer(
        "Bans",
        [
          { header: "ID", key: "id", width: 22 },
          { header: "Date", key: "date", width: 24 },
          { header: "Reason", key: "reason", width: 60 },
        ],
        rows,
      )
    : tsvBuffer(
        ["ID", "Date", "Reason"],
        rows.map((row) => [row.id, row.date, row.reason]),
      );

  await replyExport(
    interaction,
    guild,
    "Ban list exported",
    `**${rows.length}** ${rows.length === 1 ? "ban" : "bans"} in \`${filename}\`.`,
    filename,
    data,
  );
}
