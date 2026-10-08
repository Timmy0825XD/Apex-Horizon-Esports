import type { Attendance, GuildSettings, Match, Tournament } from "@prisma/client";
import type { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { loadGuildStaffState } from "../staff/store.js";
import type { StaffInput } from "../staff/fields.js";
import { attendanceError } from "../attendance/view.js";
import { findActiveAttendance, findGuildTournament, findMatchFace, isObjectId } from "../attendance/store.js";

export type LinkedMatch =
  | {
      ok: true;
      tournament: Tournament;
      match: Match;
      attendance: Attendance;
      settings: GuildSettings | null;
      staff: StaffInput | null;
    }
  | { ok: false; embed: EmbedBuilder };

export async function loadLinkedMatch(interaction: ChatInputCommandInteraction): Promise<LinkedMatch> {
  const guild = interaction.guild;
  if (!guild) {
    return { ok: false, embed: attendanceError("Guild only", "This command can only be used in a server.") };
  }
  const tournamentId = interaction.options.getString("tournament", true);
  if (!isObjectId(tournamentId)) {
    return { ok: false, embed: attendanceError("Unknown tournament", "Pick a tournament from the autocomplete list.") };
  }
  const matchId = Number(interaction.options.getString("match", true));
  if (!Number.isInteger(matchId)) {
    return { ok: false, embed: attendanceError("Unknown match", "Pick a match from the autocomplete list.") };
  }
  const tournament = await findGuildTournament(guild.id, tournamentId);
  const attendance = tournament ? await findActiveAttendance(guild.id, tournament.id, matchId) : null;
  const match = tournament ? await findMatchFace(tournament.id, matchId) : null;
  if (!tournament || !attendance || !match) {
    return { ok: false, embed: attendanceError("No attendance", "That match does not have an active attendance record.") };
  }
  const { settings, staff } = await loadGuildStaffState(guild.id);
  return { ok: true, tournament, match, attendance, settings, staff };
}
