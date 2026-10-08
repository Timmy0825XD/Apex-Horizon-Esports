import { ContainerBuilder, type ChatInputCommandInteraction } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import { isGuildAdmin } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";
import { whereActive } from "../attendance/store.js";
import { deferStaff, respondStaff } from "./respond.js";
import { loadGuildStaffState } from "./store.js";
import { staffErrorMessage } from "./view.js";

type PersonStats = {
  userId: string;
  rounds: number;
  matches: number;
};

function isDefaultWin(remark: string | null): boolean {
  return remark?.trim().toLowerCase() === "dw";
}

function objectIdLike(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

function addStat(map: Map<string, PersonStats>, userId: string, matches: number): void {
  const current = map.get(userId) ?? { userId, rounds: 0, matches: 0 };
  current.rounds += 1;
  current.matches += matches;
  map.set(userId, current);
}

function ranked(map: Map<string, PersonStats>): PersonStats[] {
  return [...map.values()].sort((a, b) => {
    if (b.matches !== a.matches) {
      return b.matches - a.matches;
    }
    if (b.rounds !== a.rounds) {
      return b.rounds - a.rounds;
    }
    return a.userId.localeCompare(b.userId);
  });
}

function roster(title: string, emoji: string, rows: PersonStats[], tags: Map<string, string>): string {
  const heading = `## ${emoji} ${title}`;
  if (rows.length === 0) {
    return `${heading}\n*None.*`;
  }
  const lines = rows.map((row, index) => {
    const rounds = row.rounds === 1 ? "1 round" : `${row.rounds} rounds`;
    const tag = tags.get(row.userId);
    const who = tag ? `${formatUser(row.userId)} ${escapeDiscord(tag)}` : formatUser(row.userId);
    return `${index + 1}. ${who} — **${row.matches}** matches (**${rounds}**)`;
  });
  const shown: string[] = [];
  let size = heading.length + 1;
  for (const line of lines) {
    if (size + line.length + 1 > 3500) {
      shown.push("*And more staff not shown.*");
      break;
    }
    shown.push(line);
    size += line.length + 1;
  }
  return [heading, ...shown].join("\n");
}

export async function handleStaffWork(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondStaff(interaction, staffErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferStaff(interaction);

  const { settings } = await loadGuildStaffState(guild.id);
  if (!isGuildAdmin(interaction, settings)) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Admin only",
        "You need the Discord **Administrator** permission or the configured **Admin Role** to view the payroll board.",
        false,
      ),
    );
    return;
  }

  const tournamentId = interaction.options.getString("tournament", true);
  if (!objectIdLike(tournamentId)) {
    await respondStaff(
      interaction,
      staffErrorMessage("Unknown tournament", "Pick a tournament from the autocomplete list.", false),
    );
    return;
  }

  const tournament = await prisma.tournament
    .findFirst({
      where: { id: tournamentId, guildId: guild.id },
      select: { id: true, name: true },
    })
    .catch(() => null);

  if (!tournament) {
    await respondStaff(
      interaction,
      staffErrorMessage("Unknown tournament", "That tournament is not registered in this server.", false),
    );
    return;
  }

  const includeDw = interaction.options.getBoolean("include_default_wins") ?? false;
  const records = await prisma.attendance.findMany({
    where: whereActive({
      guildId: guild.id,
      tournamentId: tournament.id,
    }),
    select: {
      judgeId: true,
      recorderId: true,
      team1Score: true,
      team2Score: true,
      remark: true,
    },
  });

  const judges = new Map<string, PersonStats>();
  const recorders = new Map<string, PersonStats>();
  const duals = new Map<string, PersonStats>();

  for (const row of records) {
    if (!includeDw && isDefaultWin(row.remark)) {
      continue;
    }

    const matches = row.team1Score + row.team2Score;
    if (row.judgeId !== row.recorderId) {
      addStat(judges, row.judgeId, matches);
      addStat(recorders, row.recorderId, matches);
      continue;
    }

    addStat(duals, row.judgeId, matches);
  }
  const tags = new Map<string, string>();
  const ids = [...new Set([...judges.keys(), ...recorders.keys(), ...duals.keys()])];
  if (ids.length > 0) {
    const members = await guild.members.fetch({ user: ids }).catch(() => null);
    for (const id of ids) {
      const username = members?.get(id)?.user.username;
      if (username) {
        tags.set(id, username);
      }
    }
  }
  const dw = includeDw ? "Including" : "Excluding";
  const header = [
    `# ${emojis.stats} Staff Work Count`,
    `${emojis.torneo} **Tournament:** **${escapeDiscord(tournament.name)}**`,
    `**Default wins:** ${dw}`,
    `${emojis.owner} **Requested by:** ${formatUser(interaction.user.id)}`,
  ].join("\n");
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(textBlock(header))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(roster("Judges", emojis.judge, ranked(judges), tags)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(roster("Recorders", emojis.recorder, ranked(recorders), tags)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(roster("Judge & Recorder", emojis.judge_recorder, ranked(duals), tags)));

  await interaction.editReply({
    content: null,
    embeds: [],
    components: [container],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });
}
