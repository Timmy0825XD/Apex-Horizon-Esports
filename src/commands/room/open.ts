import { Prisma } from "@prisma/client";
import { ChannelType, type Guild, type GuildMember, type TextChannel } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import type { SheetPlayer, SheetTeam } from "../../lib/sheet.js";
import type { TournamentRecord } from "../tournament/fields.js";
import {
  captainOf,
  loadTicketQueue,
  type CaptainIssue,
  type ReadyMatch,
  type TicketQueue,
} from "./bracket.js";
import { categoryLoads, freeSlots, nextOpenCategory } from "./categories.js";
import { escapeDiscord, matchLabel, ticketTopic } from "./labels.js";
import { channelOverwrites, publishBattleTicket, ticketChannelName } from "./view.js";

export type CreatedTicket = {
  channelId: string;
  matchId: number;
  label: string;
};

export type TicketFailureCode = "sheet" | "identity" | "capacity" | "discord" | "duplicate";

export type TicketFailure = {
  matchId: number;
  label: string;
  reason: string;
  code: TicketFailureCode;
  issues: CaptainIssue[];
  sheetMiss: boolean;
};

export type RoomCapacity = {
  categories: number;
  slotsBefore: number;
  slotsAfter: number;
  overflow: number;
};

export type OpenTicketsResult = {
  queue: TicketQueue;
  created: CreatedTicket[];
  failed: TicketFailure[];
  capacity: RoomCapacity;
  welcomeFailed: number;
};

class TicketBuildError extends Error {
  readonly code: TicketFailureCode;
  readonly issues: CaptainIssue[];

  constructor(message: string, code: TicketFailureCode, issues: CaptainIssue[] = []) {
    super(message);
    this.name = "TicketBuildError";
    this.code = code;
    this.issues = issues;
  }
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function snowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim());
}

function missingCaptainIssue(team: SheetTeam, fallback: string): CaptainIssue {
  const captain = captainOf(team);
  const teamName = team.teamName.trim() || fallback;
  return {
    kind: "invalid",
    discordId: null,
    rawId: captain?.discordId.trim() ?? "",
    discordTag: captain?.discordTag.trim() || fallback,
    teamName,
  };
}

async function captainMember(guild: Guild, teamName: string, captain: SheetPlayer): Promise<GuildMember> {
  const name = teamName.trim() || captain.discordTag.trim() || "Unknown";
  const tag = captain.discordTag.trim() || name;
  const rawId = captain.discordId.trim();
  if (!snowflake(rawId)) {
    throw new TicketBuildError(
      rawId
        ? `Captain of **${escapeDiscord(name)}** has an invalid Discord ID.`
        : `Captain of **${escapeDiscord(name)}** has no Discord ID on the sheet.`,
      "identity",
      [{ kind: "invalid", discordId: null, rawId, discordTag: tag, teamName: name }],
    );
  }
  const member = await guild.members.fetch(rawId).catch(() => null);
  if (!member) {
    throw new TicketBuildError(
      `Captain of **${escapeDiscord(name)}** is not in this server.`,
      "identity",
      [{ kind: "absent", discordId: rawId, rawId, discordTag: tag, teamName: name }],
    );
  }
  return member;
}

async function openOne(
  guild: Guild,
  tournament: TournamentRecord,
  match: ReadyMatch,
  categoryId: string,
): Promise<{ channelId: string; welcomeOk: boolean }> {
  const leftCaptain = captainOf(match.left);
  const rightCaptain = captainOf(match.right);
  if (!leftCaptain || !rightCaptain) {
    throw new TicketBuildError(
      "A captain is missing from the stored sheet.",
      "identity",
      [
        leftCaptain ? null : missingCaptainIssue(match.left, match.leftName),
        rightCaptain ? null : missingCaptainIssue(match.right, match.rightName),
      ].filter((issue): issue is CaptainIssue => Boolean(issue)),
    );
  }

  const issues: CaptainIssue[] = [];
  let left: GuildMember | null = null;
  let right: GuildMember | null = null;
  try {
    left = await captainMember(guild, match.left.teamName || match.leftName, leftCaptain);
  } catch (error) {
    if (!(error instanceof TicketBuildError)) {
      throw error;
    }
    issues.push(...error.issues);
  }
  try {
    right = await captainMember(guild, match.right.teamName || match.rightName, rightCaptain);
  } catch (error) {
    if (!(error instanceof TicketBuildError)) {
      throw error;
    }
    issues.push(...error.issues);
  }
  if (!left || !right) {
    throw new TicketBuildError(
      issues.length === 1
        ? "A captain could not be added to the ticket."
        : "Captains could not be added to the ticket.",
      "identity",
      issues,
    );
  }
  const name = ticketChannelName(guild, match);
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: ticketTopic(tournament.challongeId, match.id),
    permissionOverwrites: channelOverwrites(guild.id, tournament.adminRoleId, tournament.helperRoleId, [
      left.id,
      right.id,
    ]),
    reason: `Battle ticket for match ${match.id}`,
  });

  if (channel.type !== ChannelType.GuildText) {
    throw new TicketBuildError("Discord did not create a text channel.", "discord");
  }

  try {
    await prisma.room.create({
      data: {
        guildId: tournament.guildId,
        tournamentId: tournament.id,
        challongeMatchId: match.id,
        channelId: channel.id,
        categoryId,
        status: "open",
      },
    });
  } catch (error) {
    await channel.delete("Battle ticket was not stored").catch(() => undefined);
    if (isUniqueConflict(error)) {
      throw new TicketBuildError("That match already has a battle ticket.", "duplicate");
    }
    throw error;
  }

  let welcomeOk = true;
  try {
    await publishBattleTicket(
      channel as TextChannel,
      guild,
      tournament.name,
      tournament.format,
      tournament.helperRoleId,
      tournament.rulesChannelId,
      tournament.deadlineChannelId,
      match,
      { left, right },
    );
  } catch (error) {
    welcomeOk = false;
    console.error(`Battle ticket welcome failed for match ${match.id}`, error);
  }

  return { channelId: channel.id, welcomeOk };
}

export async function openPendingTickets(guild: Guild, tournament: TournamentRecord): Promise<OpenTicketsResult> {
  const queue = await loadTicketQueue(tournament);
  const failed: TicketFailure[] = queue.blocked.map((match) => ({
    matchId: match.id,
    label: matchLabel(match),
    reason: match.reason,
    code: match.issues.length > 0 ? "identity" : "sheet",
    issues: match.issues,
    sheetMiss: match.sheetMiss,
  }));
  const created: CreatedTicket[] = [];
  const loads = await categoryLoads(guild, tournament.ticketOpenCategoryIds);
  const slotsBefore = freeSlots(loads);
  let overflow = 0;
  let welcomeFailed = 0;
  let categoriesFull = false;

  for (const match of queue.ready) {
    const label = matchLabel(match);
    const categoryId = categoriesFull ? null : nextOpenCategory(loads);
    if (!categoryId) {
      categoriesFull = true;
      overflow += 1;
      failed.push({
        matchId: match.id,
        label,
        reason:
          loads.size === 0
            ? "Open-ticket categories are missing."
            : "Every open-ticket category is full (**50** channels).",
        code: "capacity",
        issues: [],
        sheetMiss: false,
      });
      continue;
    }

    try {
      const opened = await openOne(guild, tournament, match, categoryId);
      loads.set(categoryId, (loads.get(categoryId) ?? 0) + 1);
      created.push({ channelId: opened.channelId, matchId: match.id, label });
      if (!opened.welcomeOk) {
        welcomeFailed += 1;
      }
    } catch (error) {
      if (error instanceof TicketBuildError) {
        failed.push({
          matchId: match.id,
          label,
          reason: error.message,
          code: error.code,
          issues: error.issues,
          sheetMiss: false,
        });
        continue;
      }
      failed.push({
        matchId: match.id,
        label,
        reason:
          "Discord could not create that channel. Check that the bot can manage channels in the open-ticket categories.",
        code: "discord",
        issues: [],
        sheetMiss: false,
      });
    }
  }

  return {
    queue,
    created,
    failed,
    capacity: {
      categories: loads.size,
      slotsBefore,
      slotsAfter: freeSlots(loads),
      overflow,
    },
    welcomeFailed,
  };
}
