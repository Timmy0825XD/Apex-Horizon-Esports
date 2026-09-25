import type { Guild } from "discord.js";
import type { Match, Schedule } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { captainOf, findTeam } from "../room/bracket.js";
import { findTournamentRoster } from "../tournament/store.js";
import type { TournamentRecord } from "../tournament/fields.js";
import type { ScheduleAlertFace, ScheduleFace } from "./view.js";

function snowflake(value: string | null | undefined): string | null {
  const id = value?.trim() ?? "";
  return /^\d{17,20}$/.test(id) ? id : null;
}

export async function presentFace(
  guild: Guild,
  tournament: TournamentRecord,
  match: Match,
  schedule: Pick<Schedule, "scheduledAt" | "judgeId" | "recorderId" | "remark" | "channelId" | "createdBy" | "createdAt" | "alert">,
  imageUrl?: string,
): Promise<ScheduleFace> {
  const face = faceOf(tournament, match, schedule, imageUrl);
  const roster = await findTournamentRoster(guild.id, tournament.id);
  if (roster) {
    const left = findTeam(tournament, roster, match.player1Name);
    const right = findTeam(tournament, roster, match.player2Name);
    face.captain1Id = left ? snowflake(captainOf(left)?.discordId) : null;
    face.captain2Id = right ? snowflake(captainOf(right)?.discordId) : null;
  }
  face.createdAt = schedule.createdAt;
  if (schedule.createdBy) {
    const user = await guild.client.users.fetch(schedule.createdBy).catch(() => null);
    face.creatorName = user?.username ?? "Unknown";
  }
  return face;
}

export async function findScheduleForMatch(tournamentId: string, challongeMatchId: number): Promise<Schedule | null> {
  return prisma.schedule.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId, challongeMatchId } },
  });
}

export async function findMatch(tournamentId: string, challongeMatchId: number): Promise<Match | null> {
  return prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId, challongeMatchId } },
  });
}

export function faceOf(
  tournament: TournamentRecord,
  match: Match,
  schedule: Pick<Schedule, "scheduledAt" | "judgeId" | "recorderId" | "remark" | "channelId" | "alert">,
  imageUrl?: string,
): ScheduleFace {
  return {
    tournamentName: tournament.name,
    leftName: match.player1Name,
    rightName: match.player2Name,
    round: match.round,
    group: match.group,
    when: schedule.scheduledAt,
    judgeId: schedule.judgeId,
    recorderId: schedule.recorderId,
    remark: schedule.remark,
    matchId: match.challongeMatchId,
    channelId: schedule.channelId,
    imageUrl,
    alert: alertFace(schedule.alert),
  };
}

function alertFace(alert: Schedule["alert"]): ScheduleAlertFace | null {
  if (!alert) {
    return null;
  }
  return {
    raisedAt: alert.raisedAt,
    judgeFailedId: alert.judgeFailedId,
    judgeVacant: alert.judgeVacant,
    recorderFailedId: alert.recorderFailedId,
    recorderVacant: alert.recorderVacant,
  };
}
