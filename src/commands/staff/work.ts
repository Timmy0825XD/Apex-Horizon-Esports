import { AttachmentBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import { isGuildAdmin } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { deferStaff, respondStaff } from "./respond.js";
import { loadGuildStaffState } from "./store.js";
import { staffErrorMessage } from "./view.js";

const EVENT_RATES = {
  judge: 450,
  recorder: 450,
  dual: 575,
} as const;

type Bucket = "judge" | "recorder" | "dual";

type PersonStats = {
  userId: string;
  rounds: number;
  matches: number;
  gold: number;
};

type Degradation = {
  userId: string;
  matchId: number;
};

function isDefaultWin(remark: string | null): boolean {
  return remark?.trim().toLowerCase() === "dw";
}

function hasRecordingLink(links: string[]): boolean {
  return links.some((link) => link.trim().length > 0);
}

function objectIdLike(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

function addStat(map: Map<string, PersonStats>, userId: string, bucket: Bucket, matches: number): void {
  const current = map.get(userId) ?? { userId, rounds: 0, matches: 0, gold: 0 };
  current.rounds += 1;
  current.matches += matches;
  current.gold += EVENT_RATES[bucket];
  map.set(userId, current);
}

function ranked(map: Map<string, PersonStats>): PersonStats[] {
  return [...map.values()].sort((a, b) => {
    if (b.rounds !== a.rounds) {
      return b.rounds - a.rounds;
    }
    if (b.matches !== a.matches) {
      return b.matches - a.matches;
    }
    return a.userId.localeCompare(b.userId);
  });
}

function clip(lines: string[], limit = 3900): string {
  const out: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (size + line.length + 1 > limit) {
      out.push(`*…and more staff not shown.*`);
      break;
    }
    out.push(line);
    size += line.length + 1;
  }
  return out.join("\n");
}

function personLine(row: PersonStats): string {
  return `${formatUser(row.userId)} — **${row.rounds}** rounds · \`${row.matches}\` matches · \`${row.gold}\` gold`;
}

function bucketEmbed(
  title: string,
  emptyCopy: string,
  filledLead: string,
  footer: string,
  rows: PersonStats[],
): EmbedBuilder {
  const body =
    rows.length === 0
      ? emptyCopy
      : clip([filledLead, ...rows.map(personLine)]);

  return new EmbedBuilder()
    .setColor(embedColors.info)
    .setTitle(title)
    .setDescription(body)
    .setFooter({ text: footer });
}

function degradationsFile(tournamentName: string, rows: Degradation[]): AttachmentBuilder | null {
  if (rows.length === 0) {
    return null;
  }

  const slug = tournamentName
    .replace(/[^\w]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "tournament";

  const lines = [
    `Staff work degradations — ${tournamentName}`,
    `Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
    "",
    "user_id\tmatch_id\treason",
    ...rows.map(
      (row) =>
        `${row.userId}\t${row.matchId}\tSame person judged and recorded with no recording link; counted as Judge only.`,
    ),
  ];

  return new AttachmentBuilder(Buffer.from(`${lines.join("\n")}\n`, "utf8"), {
    name: `staff-degradations-${slug}.txt`,
  });
}

export async function handleStaffWork(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondStaff(interaction, staffErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferStaff(interaction, true);

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
    where: {
      guildId: guild.id,
      tournamentId: tournament.id,
      deletedAt: null,
    },
    select: {
      judgeId: true,
      recorderId: true,
      team1Score: true,
      team2Score: true,
      remark: true,
      links: true,
      challongeMatchId: true,
    },
  });

  const judges = new Map<string, PersonStats>();
  const recorders = new Map<string, PersonStats>();
  const duals = new Map<string, PersonStats>();
  const degradations: Degradation[] = [];

  for (const row of records) {
    if (!includeDw && isDefaultWin(row.remark)) {
      continue;
    }

    const matches = row.team1Score + row.team2Score;
    if (row.judgeId !== row.recorderId) {
      addStat(judges, row.judgeId, "judge", matches);
      addStat(recorders, row.recorderId, "recorder", matches);
      continue;
    }

    if (hasRecordingLink(row.links)) {
      addStat(duals, row.judgeId, "dual", matches);
      continue;
    }

    addStat(judges, row.judgeId, "judge", matches);
    degradations.push({ userId: row.judgeId, matchId: row.challongeMatchId });
  }

  const file = degradationsFile(tournament.name, degradations);
  const dw = includeDw ? "Default wins included." : "Default wins excluded.";
  const judgeRows = ranked(judges);
  const recorderRows = ranked(recorders);
  const dualRows = ranked(duals);
  const embeds = [
    bucketEmbed(
      `${emojis.members} Judges`,
      `No judge-only attendance for **${tournament.name}**.`,
      `**${judgeRows.length}** judges in **${tournament.name}**. ${dw}`,
      "Judge-only credit. 450 gold per event (1v1–3v3 rates).",
      judgeRows,
    ),
    bucketEmbed(
      `${emojis.members} Recorders`,
      `No recorder-only attendance for **${tournament.name}**.`,
      `**${recorderRows.length}** recorders in **${tournament.name}**.`,
      "Recorder-only credit. 450 gold per event (1v1–3v3 rates).",
      recorderRows,
    ),
    bucketEmbed(
      `${emojis.gem} Dual (Judge & Recorder)`,
      `No dual attendance (same person with a recording link) for **${tournament.name}**.`,
      `**${dualRows.length}** dual staff in **${tournament.name}**.`,
      "Same person with a recording link. 575 gold per event (1v1–3v3 rates).",
      dualRows,
    ),
  ];

  await interaction.editReply({
    embeds,
    files: file ? [file] : [],
  });
}
