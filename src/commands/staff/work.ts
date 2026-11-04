import { ContainerBuilder, type ChatInputCommandInteraction } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatHelpEntry, formatUser } from "../../lib/formatters.js";
import { actorMatches } from "../../lib/command-access.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { prisma } from "../../lib/prisma.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";
import { whereActive } from "../attendance/store.js";
import { deferStaff, respondStaff } from "./respond.js";
import { loadGuildStaffState } from "./store.js";
import { staffErrorMessage } from "./view.js";

/** `matches` counts attendance records; `games` adds up both scores of each one. */
const ROSTER_CHARS = 1200;

type PersonStats = {
  userId: string;
  matches: number;
  games: number;
};

function isDefaultWin(remark: string | null): boolean {
  return remark?.trim().toLowerCase() === "dw";
}

function objectIdLike(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

function addStat(map: Map<string, PersonStats>, userId: string, games: number): void {
  const current = map.get(userId) ?? { userId, matches: 0, games: 0 };
  current.matches += 1;
  current.games += games;
  map.set(userId, current);
}

function ranked(map: Map<string, PersonStats>): PersonStats[] {
  return [...map.values()].sort((a, b) => {
    if (b.games !== a.games) {
      return b.games - a.games;
    }
    if (b.matches !== a.matches) {
      return b.matches - a.matches;
    }
    return a.userId.localeCompare(b.userId);
  });
}

function roster(title: string, emoji: string, rows: PersonStats[], empty: string): string {
  const heading = `### ${emoji} ${title} · ${rows.length}`;
  if (rows.length === 0) {
    return `${heading}\n*${empty}*`;
  }
  const lines = rows.map((row, index) => {
    const matches = row.matches === 1 ? "match" : "matches";
    const games = row.games === 1 ? "game" : "games";
    return `**${index + 1}.** ${formatUser(row.userId)} · \`${row.matches}\` ${matches} · \`${row.games}\` ${games}`;
  });
  const shown: string[] = [];
  let size = heading.length + 1;
  for (const line of lines) {
    // A V2 message holds 4000 characters in total, and three rosters share it.
    if (size + line.length + 1 > ROSTER_CHARS) {
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
  if (!settings) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Settings not configured",
        `Run ${formatHelpEntry("settings set", settingsCommandIdFor(guild.id))} before opening the payroll board.`,
        false,
      ),
    );
    return;
  }
  if (!(await actorMatches(interaction, { admin: true, organiser: true, helper: true, staff: true }))) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Payroll restricted",
        "You need **Admin**, **Organiser**, a tournament **helper** role, or the **staff** role to view the payroll board.",
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

    const games = row.team1Score + row.team2Score;
    if (row.judgeId !== row.recorderId) {
      addStat(judges, row.judgeId, games);
      addStat(recorders, row.recorderId, games);
      continue;
    }

    addStat(duals, row.judgeId, games);
  }
  const header = [
    `## ${emojis.stats} Staff Work Count`,
    `${emojis.torneo} **${escapeDiscord(tournament.name)}** · default wins ${includeDw ? "included" : "excluded"}`,
  ].join("\n");
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(textBlock(header))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(roster("Judges", emojis.judge, ranked(judges), "Nobody judged a match yet.")),
      textBlock(roster("Recorders", emojis.recorder, ranked(recorders), "Nobody recorded a match yet.")),
      textBlock(roster("Judge & Recorder", emojis.judge_recorder, ranked(duals), "Nobody worked both roles.")),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`-# Requested by ${formatUser(interaction.user.id)} · <t:${Math.floor(Date.now() / 1000)}:F>`),
    );

  await interaction.editReply({
    content: null,
    embeds: [],
    components: [container],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });
}
