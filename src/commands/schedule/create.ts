import type { ChatInputCommandInteraction } from "discord.js";
import { emojis } from "../../emojis.js";
import { formatRole } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { isTournamentAdminOrHelper, memberHasRole } from "./access.js";
import { auditSchedule, peopleLine, ticketLine } from "./audit.js";
import { takeNextBackground } from "./backgrounds.js";
import { isAtLeastTenMinutesAhead, utcFromParts } from "./clock.js";
import { grantTicket, markTicket, revokeTicket, unmarkTicket } from "./channel.js";
import { within } from "./deadline.js";
import { attachmentUrl, clearScheduleMessages, publishThumbnail, syncPosts } from "./messages.js";
import { textChannel } from "./channel.js";
import { loadGuildStaffState } from "../staff/store.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import { createScheduleEvent, deleteScheduleEvent, syncScheduleEvent } from "./event.js";
import { postSeatLine, seatAssignedLine } from "./seat.js";
import { presentFace } from "./store.js";
import { loadThumbnailFace, renderScheduleThumbnail } from "./thumbnail.js";
import type { TicketBundle } from "./ticket.js";

export async function runCreate(interaction: ChatInputCommandInteraction, bundle: TicketBundle): Promise<void> {
  const { guild } = interaction;
  if (!guild) {
    return;
  }
  if (!isTournamentAdminOrHelper(interaction, bundle.tournament)) {
    await replySchedule(interaction, scheduleNotice("error","Tournament admin or helper required", "Only that tournament's **admin** or **helper** can create a schedule."));
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
  const judge = interaction.options.getUser("judge");
  const recorder = interaction.options.getUser("recorder");
  if ((judge || recorder) && !bundle.staff) {
    await replySchedule(interaction, scheduleNotice("error", "Staff not configured", "Staff roles are not configured yet."));
    return;
  }
  if (judge && bundle.staff && !(await memberHasRole(guild, judge.id, bundle.staff.judgeRoleId))) {
    await replySchedule(interaction, scheduleNotice("error", "Judge role required", "That user does not have the **judge** role."));
    return;
  }
  if (recorder && bundle.staff && !(await memberHasRole(guild, recorder.id, bundle.staff.recorderRoleId))) {
    await replySchedule(interaction, scheduleNotice("error", "Recorder role required", "That user does not have the **recorder** role."));
    return;
  }
  const backgroundIndex = await takeNextBackground(guild.id);
  const thumbnailFace = await loadThumbnailFace(guild, bundle.tournament, bundle.match, when);
  const image = await renderScheduleThumbnail(thumbnailFace, backgroundIndex);
  const thumbnail = await publishThumbnail(guild, bundle.settings.thumbnailChannelId, backgroundIndex, image);
  const imageUrl = attachmentUrl(thumbnail);
  const created = await prisma.schedule.create({
    data: {
      guildId: guild.id,
      tournamentId: bundle.room.tournamentId,
      challongeMatchId: bundle.room.challongeMatchId,
      channelId: bundle.channel.id,
      scheduledAt: when,
      backgroundIndex,
      judgeId: null,
      recorderId: null,
      remark,
      createdBy: interaction.user.id,
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
  let posted = created;
  let eventId: string | null = null;
  let marked = false;
  const granted: string[] = [];
  const announced: string[] = [];
  try {
    let face = await within(8_000, presentFace(guild, bundle.tournament, bundle.match, { ...created, judgeId: null, recorderId: null }, imageUrl), "Schedule details");
    let messages = await within(15_000, syncPosts(guild, bundle.channel, bundle.settings.schedulesChannelId, created, face), "Schedule posts");
    if (judge) {
      await grantTicket(bundle.channel, judge.id);
      granted.push(judge.id);
    }
    if (recorder && recorder.id !== judge?.id) {
      await grantTicket(bundle.channel, recorder.id);
      granted.push(recorder.id);
    }
    const seated = await prisma.schedule.update({
      where: { id: created.id },
      data: {
        judgeId: judge?.id ?? null,
        recorderId: recorder?.id ?? null,
        messages,
      },
    });
    face = await within(8_000, presentFace(guild, bundle.tournament, bundle.match, seated, imageUrl), "Schedule details");
    messages = await within(15_000, syncPosts(guild, bundle.channel, bundle.settings.schedulesChannelId, { ...seated, messages }, face), "Schedule posts");
    posted = { ...seated, messages };
    await prisma.schedule.update({ where: { id: seated.id }, data: { messages } });
    await within(8_000, markTicket(bundle.channel), "Channel mark");
    marked = true;
    eventId = await within(10_000, createScheduleEvent(guild, face), "Server event");
    await within(20_000, syncScheduleEvent(guild, eventId, face, image), "Event image");
    await prisma.schedule.update({ where: { id: seated.id }, data: { eventId } });
    if (judge) {
      announced.push(await within(8_000, postSeatLine(bundle.channel, seatAssignedLine("judge", judge.id), judge.id), "Judge notice"));
    }
    if (recorder) {
      announced.push(await within(8_000, postSeatLine(bundle.channel, seatAssignedLine("recorder", recorder.id), recorder.id), "Recorder notice"));
    }
    await replySchedule(interaction, {
      content: `${emojis.success} Match scheduled successfully. Thumbnail generated.`,
    });
    await pingStaffChat(guild, bundle.settings.schedulesChannelId, messages.scheduleChannelMessageId, when, Boolean(judge), Boolean(recorder)).catch((error) => {
      console.error("Schedule staff ping failed", error);
    });
    await auditSchedule({
      guild,
      settings: bundle.settings,
      actor: interaction.user,
      description: `A schedule was created for **${bundle.tournament.name}**.`,
      details: [`**Match:** \`${bundle.match.challongeMatchId}\``, ticketLine(guild, bundle.channel.id), peopleLine(judge?.id ?? null, recorder?.id ?? null)],
    });
  } catch (error) {
    await deleteScheduleEvent(guild, eventId);
    if (marked) {
      await unmarkTicket(bundle.channel).catch(() => undefined);
    }
    for (const userId of granted) {
      await revokeTicket(bundle.channel, userId, false);
    }
    for (const messageId of announced) {
      await bundle.channel.messages.delete(messageId).catch(() => undefined);
    }
    await clearScheduleMessages(guild, posted, bundle.settings.schedulesChannelId, bundle.settings.thumbnailChannelId);
    await prisma.schedule.delete({ where: { id: created.id } }).catch(() => undefined);
    throw error;
  }
}

const NEW_SCHEDULE_GIF = "https://tenor.com/view/check-schedule-f1livegp-gif-25992214";

async function pingStaffChat(
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  schedulesChannelId: string,
  messageId: string,
  when: Date,
  judgeAssigned: boolean,
  recorderAssigned: boolean,
): Promise<void> {
  if (judgeAssigned && recorderAssigned) {
    return;
  }
  const { staff } = await loadGuildStaffState(guild.id);
  if (!staff?.staffchatChannelId) {
    return;
  }
  const chat = await textChannel(guild, staff.staffchatChannelId);
  if (!chat) {
    return;
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
