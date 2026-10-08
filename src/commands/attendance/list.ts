import type { ChatInputCommandInteraction } from "discord.js";
import { loadGuildStaffState } from "../staff/store.js";
import { canUseAttendanceTools, canViewOtherSalary } from "./access.js";
import { v2Flags } from "../../lib/v2.js";
import { watchSalaryButtons } from "./buttons.js";
import { payModeForFormat, salaryFor } from "./payroll.js";
import { deferPublic, editAttendance } from "./respond.js";
import { findGuildTournament, listUserAttendance } from "./store.js";
import { attendanceError, salaryMessage, type SalaryUnit } from "./view.js";

export async function handleAttendanceList(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [attendanceError("Guild only", "This command can only be used in a server.")] });
    return;
  }
  await deferPublic(interaction);
  const { settings, staff } = await loadGuildStaffState(guild.id);
  const target = interaction.options.getUser("user") ?? interaction.user;
  if (target.id === interaction.user.id) {
    if (!canUseAttendanceTools(interaction, settings, staff)) {
      await editAttendance(interaction, {
        embeds: [attendanceError("Staff only", "You need a staff, judge, or recorder role to view your salary.")],
      });
      return;
    }
  } else if (!canViewOtherSalary(interaction, settings, staff)) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Restricted salary", "Only an admin or organiser can open someone else's salary card.")],
    });
    return;
  }

  const tournamentId = interaction.options.getString("tournament", true);
  const tournament = await findGuildTournament(guild.id, tournamentId);
  if (!tournament) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Unknown tournament", "Pick a tournament from the autocomplete list.")],
    });
    return;
  }
  const mode = payModeForFormat(tournament.format);
  const rows = await listUserAttendance(guild.id, tournament.id, target.id);
  const salary = salaryFor(target.id, rows, mode);
  let unit: SalaryUnit = "ac";
  const view = (disabled = false) =>
    salaryMessage({
      username: target.username,
      avatarUrl: target.displayAvatarURL({ extension: "png", size: 256 }),
      tournamentName: tournament.name,
      mode,
      salary,
      unit,
      disabled,
    });
  const opened = view();
  const message = await interaction.editReply({
    components: opened.components,
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });
  await watchSalaryButtons(
    interaction,
    message,
    (customId) => {
      if (customId === "att:unit:gold") {
        unit = "gold";
      }
      if (customId === "att:unit:ac") {
        unit = "ac";
      }
      return view();
    },
    () => view(true),
  );
}
