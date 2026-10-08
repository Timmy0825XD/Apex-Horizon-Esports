import { AttachmentBuilder, type ChatInputCommandInteraction } from "discord.js";
import { Workbook } from "exceljs";
import { prisma } from "../../lib/prisma.js";
import { canExportSheet } from "../attendance/access.js";
import {
  formatArtCoin,
  isDefaultWin,
  payModeForFormat,
  payModeLabel,
  salaryLines,
  workCounts,
  type PayRow,
} from "../attendance/payroll.js";
import { deferHidden, editAttendance } from "../attendance/respond.js";
import { findGuildTournament, matchesById, whereActive } from "../attendance/store.js";
import { attendanceError } from "../attendance/view.js";
import { escapeDiscord } from "../room/labels.js";
import { loadGuildStaffState } from "../staff/store.js";

function slug(name: string): string {
  return name.replace(/[^\w]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "tournament";
}

function stamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export async function handleGetSheet(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [attendanceError("Guild only", "This command can only be used in a server.")] });
    return;
  }
  await deferHidden(interaction);
  const { staff } = await loadGuildStaffState(guild.id);
  if (!canExportSheet(interaction, staff)) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Organiser only", "You need the organiser role or Administrator to export attendance.")],
    });
    return;
  }
  const tournament = await findGuildTournament(guild.id, interaction.options.getString("tournament", true));
  if (!tournament) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Unknown tournament", "Pick a tournament from the autocomplete list.")],
    });
    return;
  }

  const includeDw = interaction.options.getBoolean("include_default_win_salary", true);
  const mode = payModeForFormat(tournament.format);
  const stored = await prisma.attendance.findMany({
    where: whereActive({ guildId: guild.id, tournamentId: tournament.id }),
    orderBy: { createdAt: "asc" },
  });
  const rows = includeDw ? stored : stored.filter((row) => !isDefaultWin(row.remark));
  const faces = await matchesById(
    tournament.id,
    rows.map((row) => row.challongeMatchId),
  );
  const payRows: PayRow[] = rows.map((row) => ({
    judgeId: row.judgeId,
    recorderId: row.recorderId,
    team1Score: row.team1Score,
    team2Score: row.team2Score,
    links: row.links,
    remark: row.remark,
  }));
  const counts = workCounts(payRows);
  const lines = salaryLines(payRows, mode);

  const workbook = new Workbook();
  const records = workbook.addWorksheet("Attendance Records");
  records.addRow(["Round", "Match", "Judge ID", "Recorder ID", "Team 1", "Team 2", "Remark", "Links", "Marked At"]);
  for (const row of rows) {
    const match = faces.get(row.challongeMatchId);
    records.addRow([
      match?.round ?? "",
      match ? `${match.player1Name} vs ${match.player2Name}` : row.challongeMatchId,
      row.judgeId,
      row.recorderId,
      row.team1Score,
      row.team2Score,
      row.remark ?? "",
      row.links.join(" "),
      stamp(row.createdAt),
    ]);
  }

  const work = workbook.addWorksheet("Work Count");
  work.addRow(["Bucket", "User ID", "Rounds", "Matches"]);
  for (const bucket of [
    ["Judges", counts.judges],
    ["Recorders", counts.recorders],
    ["Judge & Recorder", counts.duals],
  ] as const) {
    for (const person of bucket[1]) {
      work.addRow([bucket[0], person.userId, person.rounds, person.matches]);
    }
  }

  const salary = workbook.addWorksheet("Salary Estimate");
  salary.addRow(["User ID", "Category", "Rounds", "Games", "Gold", "ArtCoin", "Match"]);
  let cursor = 0;
  for (const row of rows) {
    const match = faces.get(row.challongeMatchId);
    const label = match ? `${match.player1Name} vs ${match.player2Name}` : String(row.challongeMatchId);
    const count = row.judgeId === row.recorderId ? 1 : 2;
    for (const line of lines.slice(cursor, cursor + count)) {
      salary.addRow([line.userId, line.category, line.rounds, line.games, line.gold, formatArtCoin(line.gold), label]);
    }
    cursor += count;
  }

  const info = workbook.addWorksheet("Tournament Info");
  info.addRow(["Field", "Value"]);
  info.addRows([
    ["Tournament", tournament.name],
    ["Pay table", payModeLabel(mode)],
    ["Detected format", tournament.format || "2vs2"],
    ["Default wins included", includeDw ? "yes" : "no"],
    ["Records", rows.length],
    ["Challonge ID", tournament.challongeId],
    ["Sheet", tournament.sheetLink],
  ]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await editAttendance(interaction, {
    content: `Attendance workbook for **${escapeDiscord(tournament.name)}**. Rates follow the stored format **${tournament.format || "2vs2"}**.`,
    files: [new AttachmentBuilder(buffer, { name: `${slug(tournament.name)}-attendance.xlsx` })],
  });
}
