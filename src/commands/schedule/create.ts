import { MessageFlags, type ChatInputCommandInteraction, type Guild, type Message } from "discord.js";
import { formatRole, formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { memberIsOrganiser } from "../../lib/organiser.js";
import type { StaffInput } from "../staff/fields.js";
import { isTournamentAdminOrHelper, memberHasRole } from "./access.js";
import { auditSchedule, peopleLine, ticketLine } from "./audit.js";
import { takeNextBackground } from "./backgrounds.js";
import { isAtLeastTenMinutesAhead, utcFromParts } from "./clock.js";
import { bookedAround, fullMinuteBody, fullMinuteTitle, minuteIsFull, staffBusyBody, staffBusyTitle, staffClash } from "./conflicts.js";
import { grantTicket, markTicket, revokeTicket, textChannel } from "./channel.js";
import { within } from "./deadline.js";
import { attachmentUrl, deleteTracked, postBoardSchedule, postTicketSchedule, publishThumbnail } from "./messages.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import { createScheduleEvent } from "./event.js";
import { bothSeatsAssignedLine, postSeatLine, seatAssignedLine } from "./seat.js";
import { presentFace } from "./store.js";
import { loadThumbnailFace, renderScheduleThumbnail } from "./thumbnail.js";
import type { TicketBundle } from "./ticket.js";
import type { ScheduleFace } from "./view.js";

export async function runCreate(interaction: ChatInputCommandInteraction, bundle: TicketBundle): Promise<void> {
  const { guild } = interaction;
  if (!guild) {
    return;
  }
  if (!isTournamentAdminOrHelper(interaction, bundle.tournament) && !(await memberIsOrganiser(interaction))) {
    await replySchedule(
      interaction,
      scheduleNotice(
        "error",
        "Tournament admin, helper, or organiser required",
        "Only that tournament's **admin** or **helper**, or an **Organiser**, can create a schedule.",
      ),
    );
    return;
  }
  if (bundle.schedule) {
    await replySchedule(interaction, scheduleNotice("error","Schedule already exists", "This match already has an active schedule."));
    return;
  }
  const when = utcFromParts({
    hour: interaction.options.getInteger("hour", true),
    minute: interaction.options.getInteger("minute", true),
    day: interaction.options.getInteger("day", true),
    month: interaction.options.getInteger("month", true),
    year: interaction.options.getInteger("year", true),
  });
  if (!when) {
    await replySchedule(interaction, scheduleNotice("error","Invalid UTC time", "That day does not exist on the calendar."));
    return;
  }
  if (!isAtLeastTenMinutesAhead(when)) {
    await replySchedule(interaction, scheduleNotice("error","Too soon", "The schedule must be at least **10 minutes** in the future."));
    return;
  }
  const remark = interaction.options.getString("remark")?.trim() || null;
  const notify = interaction.options.getBoolean("notify") ?? true;
  const judge = interaction.options.getUser("judge");
  const recorder = interaction.options.getUser("recorder");
  if ((judge || recorder) && !bundle.staff) {
    await replySchedule(interaction, scheduleNotice("error", "Staff not configured", "Staff roles are not configured yet."));
    return;
  }
  const [judgeOk, recorderOk] = await Promise.all([
    judge && bundle.staff ? memberHasRole(guild, judge.id, bundle.staff.judgeRoleId) : true,
    recorder && bundle.staff ? memberHasRole(guild, recorder.id, bundle.staff.recorderRoleId) : true,
  ]);
  if (!judgeOk) {
    await replySchedule(interaction, scheduleNotice("error", "Judge role required", "That user does not have the **judge** role."));
    return;
  }
  if (!recorderOk) {
    await replySchedule(interaction, scheduleNotice("error", "Recorder role required", "That user does not have the **recorder** role."));
    return;
  }
  const judgeId = judge?.id ?? null;
  const recorderId = recorder?.id ?? null;
  const staffIds = [...new Set([judgeId, recorderId].filter((id): id is string => Boolean(id)))];
  const booked = await bookedAround(guild.id, when);
  if (minuteIsFull(booked, when)) {
    await replySchedule(interaction, scheduleNotice("error", fullMinuteTitle, fullMinuteBody(when)));
    return;
  }
  for (const userId of staffIds) {
    const clash = staffClash(booked, userId, when);
    if (clash) {
      await replySchedule(interaction, scheduleNotice("error", staffBusyTitle, staffBusyBody(userId, clash)));
      return;
    }
  }
  const createdAt = new Date();
  const draft = {
    scheduledAt: when,
    judgeId,
    recorderId,
    remark,
    channelId: bundle.channel.id,
    createdBy: interaction.user.id,
    createdAt,
    alert: null,
  };

  // Blocking steps: thumbnail, staff access, ticket post and schedules post.
  // Any failure here undoes everything already published.
  const published: Published = { thumbnailId: null, ticketMessageId: null, boardMessageId: null, scheduleId: null, granted: [], announced: [] };
  const warnings: string[] = [];
  let face: ScheduleFace;
  let image: Buffer;
  let scheduleId: string;
  let boardMessageId: string;
  try {
    const backgroundIndex = await takeNextBackground(guild.id);
    const [thumbnailFace, details] = await Promise.all([
      loadThumbnailFace(guild, bundle.tournament, bundle.match, when),
      within(8_000, presentFace(guild, bundle.tournament, bundle.match, draft), "Schedule details"),
    ]);
    image = await renderScheduleThumbnail(thumbnailFace, backgroundIndex);
    const thumbnail = await within(15_000, publishThumbnail(guild, bundle.settings.thumbnailChannelId, backgroundIndex, image), "Thumbnail", deleteLate);
    published.thumbnailId = thumbnail.id;
    face = { ...details, imageUrl: attachmentUrl(thumbnail) };

    const grants = await Promise.allSettled(
      staffIds.map(async (userId) => {
        await within(8_000, grantTicket(bundle.channel, userId), "Staff access", () => revokeTicket(bundle.channel, userId, false));
        published.granted.push(userId);
      }),
    );
    const refused = grants.find((grant): grant is PromiseRejectedResult => grant.status === "rejected");
    if (refused) {
      throw refused.reason;
    }

    const created = await prisma.schedule.create({
      data: {
        guildId: guild.id,
        tournamentId: bundle.room.tournamentId,
        challongeMatchId: bundle.room.challongeMatchId,
        channelId: bundle.channel.id,
        scheduledAt: when,
        backgroundIndex,
        judgeId,
        recorderId,
        remark,
        createdBy: interaction.user.id,
        createdAt,
        reminderPhase: "pending",
        confirmations: { judge: false, recorder: false },
        claimsOpenUntil: new Date(Date.now() + 10 * 60 * 1000),
        messages: {
          ticketMessageId: "pending",
          scheduleChannelMessageId: "pending",
          thumbnailMessageId: thumbnail.id,
        },
      },
    });
    scheduleId = created.id;
    published.scheduleId = created.id;

    const ticketMessageId = await within(15_000, postTicketSchedule(bundle.channel, face), "Ticket post", deleteLate);
    published.ticketMessageId = ticketMessageId;

    for (const line of seatLines(judgeId, recorderId)) {
      try {
        published.announced.push(await within(8_000, postSeatLine(bundle.channel, line.text, line.userId), "Seat notice"));
      } catch {
        warnings.push(`The assignment notice for ${formatUser(line.userId)} was not posted in this ticket.`);
      }
    }

    boardMessageId = await within(
      15_000,
      postBoardSchedule(guild, bundle.settings.schedulesChannelId, created.id, face),
      "Schedules channel post",
      deleteLate,
    );
    published.boardMessageId = boardMessageId;

    await prisma.schedule.update({
      where: { id: created.id },
      data: {
        messages: {
          ticketMessageId,
          scheduleChannelMessageId: boardMessageId,
          thumbnailMessageId: thumbnail.id,
        },
      },
    });
  } catch (error) {
    await rollback(guild, bundle, published);
    throw error;
  }

  // Non-blocking steps: the schedule stands, and failures only reach the creator.
  const [marked, eventId] = await Promise.all([
    within(8_000, markTicket(bundle.channel), "Channel mark").then(
      () => true,
      () => false,
    ),
    within(20_000, createScheduleEvent(guild, face, image), "Server event", (lateId) =>
      prisma.schedule.update({ where: { id: scheduleId }, data: { eventId: lateId } }),
    ).catch(() => null),
  ]);
  if (!marked) {
    warnings.push("The 🔴 mark could not be added to this channel's name. Add it manually.");
  }
  if (eventId) {
    await prisma.schedule.update({ where: { id: scheduleId }, data: { eventId } }).catch(() => {
      warnings.push("The server event was created but could not be linked to this schedule.");
    });
  } else {
    warnings.push("The server event could not be created.");
  }

  const staff = bundle.staff;
  const [pinged, audited] = await Promise.all([
    notify && staff
      ? pingStaffChat(guild, staff, bundle.settings.schedulesChannelId, boardMessageId, when, Boolean(judgeId), Boolean(recorderId)).then(
          () => true,
          (error: unknown) => {
            console.error("Schedule staff ping failed", error);
            return false;
          },
        )
      : true,
    auditSchedule({
      guild,
      settings: bundle.settings,
      actor: interaction.user,
      action: "created",
    title: "Schedule created",
    summary: `A schedule was created for **${bundle.tournament.name}**.`,
      details: [`**Match** \`${bundle.match.challongeMatchId}\``, ticketLine(guild, bundle.channel.id), peopleLine(judgeId, recorderId)],
    }).catch(() => false),
  ]);
  if (!pinged) {
    warnings.push("The **New Schedule** notice could not be posted in the staff chat.");
  }
  if (!audited) {
    warnings.push("The audit log could not be written.");
  }

  await replySchedule(interaction, scheduleNotice("success", "Schedule created", "Match scheduled successfully. Thumbnail generated."));
  if (warnings.length) {
    await interaction
      .followUp({
        ...scheduleNotice("info", "Finish manually", warnings.map((line) => `- ${line}`).join("\n")),
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
      })
      .catch(() => undefined);
  }
}

type SeatLine = { text: string; userId: string };

function seatLines(judgeId: string | null, recorderId: string | null): SeatLine[] {
  if (judgeId && judgeId === recorderId) {
    return [{ text: bothSeatsAssignedLine(judgeId), userId: judgeId }];
  }
  const lines: SeatLine[] = [];
  if (judgeId) {
    lines.push({ text: seatAssignedLine("judge", judgeId), userId: judgeId });
  }
  if (recorderId) {
    lines.push({ text: seatAssignedLine("recorder", recorderId), userId: recorderId });
  }
  return lines;
}

type Published = {
  thumbnailId: string | null;
  ticketMessageId: string | null;
  boardMessageId: string | null;
  scheduleId: string | null;
  granted: string[];
  announced: string[];
};

/** Undoes a late post that arrived after its timeout already rolled the create back. */
function deleteLate(posted: Message | string): unknown {
  return typeof posted === "string" ? undefined : posted.delete();
}

async function rollback(guild: Guild, bundle: TicketBundle, published: Published): Promise<void> {
  await Promise.all([
    ...published.granted.map((userId) => revokeTicket(bundle.channel, userId, false)),
    ...[published.ticketMessageId, ...published.announced].map((id) => deleteTracked(guild, bundle.channel.id, id)),
    deleteTracked(guild, bundle.settings.schedulesChannelId, published.boardMessageId),
    deleteTracked(guild, bundle.settings.thumbnailChannelId, published.thumbnailId),
  ]);
  if (published.scheduleId) {
    await prisma.schedule.delete({ where: { id: published.scheduleId } }).catch(() => undefined);
  }
}

const NEW_SCHEDULE_GIF = "https://tenor.com/view/check-schedule-f1livegp-gif-25992214";

async function pingStaffChat(
  guild: Guild,
  staff: StaffInput,
  schedulesChannelId: string,
  messageId: string,
  when: Date,
  judgeAssigned: boolean,
  recorderAssigned: boolean,
): Promise<void> {
  if ((judgeAssigned && recorderAssigned) || !staff.staffchatChannelId) {
    return;
  }
  const chat = await textChannel(guild, staff.staffchatChannelId);
  if (!chat) {
    throw new Error("The staff chat channel is missing or is not a text channel.");
  }
  const roles = [
    judgeAssigned ? null : staff.judgeRoleId,
    recorderAssigned ? null : staff.recorderRoleId,
  ].filter((id): id is string => Boolean(id));
  const url = `https://discord.com/channels/${guild.id}/${schedulesChannelId}/${messageId}`;
  const day = String(when.getUTCDate()).padStart(2, "0");
  const month = String(when.getUTCMonth() + 1).padStart(2, "0");
  const hour = String(when.getUTCHours()).padStart(2, "0");
  const minute = String(when.getUTCMinutes()).padStart(2, "0");
  await chat.send({
    content: [
      `[New Schedule](${NEW_SCHEDULE_GIF}) Take on role ${roles.map((id) => formatRole(guild, id)).join(" ")}.`,
      `**Details:** ${day}-${month}-${when.getUTCFullYear()} - ${hour}:${minute} UTC`,
      `**Link:** ${url}`,
    ].join("\n"),
    allowedMentions: { roles: [...new Set(roles)], parse: [] },
  });
}
