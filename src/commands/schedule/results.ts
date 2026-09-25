import { AttachmentBuilder, type ChatInputCommandInteraction, type Guild, type Message } from "discord.js";
import type { Schedule, ScheduleResults } from "@prisma/client";
import { emojis } from "../../emojis.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { loadGuildSettings } from "../settings/store.js";
import { findTournamentById } from "../tournament/store.js";
import { isJudge } from "./access.js";
import { auditSchedule, ticketLine } from "./audit.js";
import { textChannel } from "./channel.js";
import { deleteTracked, thumbnailImageUrl } from "./messages.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import { findMatch, findScheduleForMatch, presentFace } from "./store.js";
import type { TicketBundle } from "./ticket.js";
import { resultsEmbed, type ScheduleFace } from "./view.js";

function proofFiles(interaction: ChatInputCommandInteraction): AttachmentBuilder[] {
  const files: AttachmentBuilder[] = [];
  for (let index = 1; index <= 10; index += 1) {
    const attachment = interaction.options.getAttachment(`image${index}`);
    if (attachment) {
      files.push(new AttachmentBuilder(attachment.url, { name: attachment.name ?? `proof-${index}.png` }));
    }
  }
  return files;
}

function resultsIntro(face: ScheduleFace): { content: string; users: string[] } {
  const users = [...new Set([face.captain1Id, face.captain2Id].filter((id): id is string => Boolean(id)))];
  const mentions = users.map((id) => formatUser(id)).join(" ");
  const content = mentions ? `${emojis.torneo} **Match Complete!**\n${mentions}` : `${emojis.torneo} **Match Complete!**`;
  return { content, users };
}

function storedResults(results: ScheduleResults, patch: { links?: string[]; transcriptUrl?: string | null } = {}): ScheduleResults {
  return {
    team1Score: results.team1Score,
    team2Score: results.team2Score,
    notes: results.notes,
    imageUrls: results.imageUrls,
    links: patch.links ?? results.links ?? [],
    messageId: results.messageId,
    ticketMessageId: results.ticketMessageId ?? null,
    transcriptUrl: patch.transcriptUrl === undefined ? results.transcriptUrl ?? null : patch.transcriptUrl,
    uploadedBy: results.uploadedBy ?? null,
    declaredAt: results.declaredAt,
  };
}

async function editResultsPost(guild: Guild, channelId: string, messageId: string | null | undefined, embed: ReturnType<typeof resultsEmbed>): Promise<void> {
  if (!messageId) {
    return;
  }
  const channel = await textChannel(guild, channelId);
  const message = await channel?.messages.fetch(messageId).catch(() => null);
  await message?.edit({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function repaintResults(guild: Guild, schedule: Schedule, results: ScheduleResults): Promise<void> {
  const tournament = await findTournamentById(guild.id, schedule.tournamentId);
  const match = await findMatch(schedule.tournamentId, schedule.challongeMatchId);
  const settings = await loadGuildSettings(guild.id);
  if (!tournament || !match || !settings) {
    return;
  }
  const imageUrl = await thumbnailImageUrl(guild, settings.thumbnailChannelId, schedule.messages.thumbnailMessageId);
  const face = await presentFace(guild, tournament, match, schedule, imageUrl);
  const uploaded = results.uploadedBy ? await guild.client.users.fetch(results.uploadedBy).catch(() => null) : null;
  const embed = resultsEmbed({
    face,
    team1Score: results.team1Score,
    team2Score: results.team2Score,
    notes: results.notes,
    links: results.links ?? [],
    declaredAt: results.declaredAt,
    uploadedBy: uploaded?.username ?? "Unknown",
    transcriptUrl: results.transcriptUrl,
  });
  await editResultsPost(guild, schedule.channelId, results.ticketMessageId, embed);
  await editResultsPost(guild, tournament.resultChannelId, results.messageId, embed);
}

async function patchResults(
  guild: Guild,
  tournamentId: string,
  challongeMatchId: number,
  patch: { links?: string[]; transcriptUrl?: string | null },
): Promise<void> {
  const schedule = await findScheduleForMatch(tournamentId, challongeMatchId);
  if (!schedule?.results || schedule.guildId !== guild.id) {
    return;
  }
  const results = storedResults(schedule.results, patch);
  await prisma.schedule.update({ where: { id: schedule.id }, data: { results: { set: results } } });
  await repaintResults(guild, schedule, results);
}

export async function attachResultsLinks(guild: Guild, tournamentId: string, challongeMatchId: number, links: string[]): Promise<void> {
  await patchResults(guild, tournamentId, challongeMatchId, { links });
}

export async function attachResultsTranscript(guild: Guild, tournamentId: string, challongeMatchId: number, transcriptUrl: string): Promise<void> {
  await patchResults(guild, tournamentId, challongeMatchId, { transcriptUrl });
}

export async function runResults(interaction: ChatInputCommandInteraction, bundle: TicketBundle): Promise<void> {
  const guild = interaction.guild;
  const schedule = bundle.schedule;
  if (!guild || !schedule || !bundle.staff) {
    await replySchedule(interaction, scheduleNotice("error", bundle.staff ? "No schedule" : "Staff not configured", bundle.staff ? "Create a schedule in this ticket first." : "Staff roles are not configured yet."));
    return;
  }
  if (!isJudge(interaction, bundle.staff)) {
    await replySchedule(interaction, scheduleNotice("error", "Judge required", "Only members with the **judge** role can declare a result."));
    return;
  }
  if (schedule.scheduledAt.getTime() > Date.now()) {
    await replySchedule(interaction, scheduleNotice("error", "Match has not started", "Results open after the scheduled time."));
    return;
  }
  if (schedule.results) {
    await replySchedule(interaction, scheduleNotice("error", "Result already posted", "Delete the current declaration before posting another."));
    return;
  }
  const team1 = interaction.options.getInteger("team_1", true);
  const team2 = interaction.options.getInteger("team_2", true);
  if (team1 === team2 && team1 !== 0) {
    await replySchedule(interaction, scheduleNotice("error", "Tie not allowed", "The only tie is **0** - **0**. Any other tie has to pick a winner."));
    return;
  }
  const notes = interaction.options.getString("notes")?.trim() || null;
  const resultChannel = await textChannel(guild, bundle.tournament.resultChannelId);
  if (!resultChannel) {
    await replySchedule(interaction, scheduleNotice("error", "Result channel missing", "The tournament result channel is not available."));
    return;
  }
  const declaredAt = new Date();
  const imageUrl = await thumbnailImageUrl(guild, bundle.settings.thumbnailChannelId, schedule.messages.thumbnailMessageId);
  const face = await presentFace(guild, bundle.tournament, bundle.match, schedule, imageUrl);
  const intro = resultsIntro(face);
  const embed = resultsEmbed({
    face,
    team1Score: team1,
    team2Score: team2,
    notes,
    links: [],
    declaredAt,
    uploadedBy: interaction.user.username,
    transcriptUrl: null,
  });
  const allowedMentions = { users: intro.users, parse: [] as const };
  let ticketPost: Message | null = null;
  let channelPost: Message | null = null;
  try {
    ticketPost = await bundle.channel.send({
      content: intro.content,
      embeds: [embed],
      files: proofFiles(interaction),
      allowedMentions,
    });
    channelPost = await resultChannel.send({
      embeds: [embed],
      files: proofFiles(interaction),
      allowedMentions: { parse: [] },
    });
    const imageUrls = [...channelPost.attachments.values()].map((file) => file.url);
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        results: {
          set: {
            team1Score: team1,
            team2Score: team2,
            notes,
            imageUrls,
            links: [],
            messageId: channelPost.id,
            ticketMessageId: ticketPost.id,
            transcriptUrl: null,
            uploadedBy: interaction.user.id,
            declaredAt,
          },
        },
      },
    });
  } catch (error) {
    await ticketPost?.delete().catch(() => undefined);
    await channelPost?.delete().catch(() => undefined);
    throw error;
  }
  await replySchedule(
    interaction,
    scheduleNotice("success", "Result posted", `The declaration is in this ticket and in ${formatChannel(guild, resultChannel.id)}. The bracket was not updated.`),
  );
  await auditSchedule({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    description: `A schedule result was declared for **${bundle.tournament.name}**.`,
    details: [ticketLine(guild, bundle.channel.id), `**Score:** \`${team1}\` - \`${team2}\``],
  });
}

export async function runResultsDelete(interaction: ChatInputCommandInteraction, bundle: TicketBundle): Promise<void> {
  const guild = interaction.guild;
  const schedule = bundle.schedule;
  if (!guild || !schedule || !bundle.staff) {
    await replySchedule(interaction, scheduleNotice("error", bundle.staff ? "No schedule" : "Staff not configured", bundle.staff ? "This ticket does not have a schedule." : "Staff roles are not configured yet."));
    return;
  }
  if (!isJudge(interaction, bundle.staff)) {
    await replySchedule(interaction, scheduleNotice("error", "Judge required", "Only members with the **judge** role can delete a result."));
    return;
  }
  if (!interaction.options.getBoolean("confirm", true)) {
    await replySchedule(interaction, scheduleNotice("info", "Delete cancelled", "The public result is still up."));
    return;
  }
  if (!schedule.results) {
    await replySchedule(interaction, scheduleNotice("error", "No result", "This schedule does not have a public result."));
    return;
  }
  const reason = interaction.options.getString("reason")?.trim() || null;
  await deleteTracked(guild, schedule.channelId, schedule.results.ticketMessageId);
  await deleteTracked(guild, bundle.tournament.resultChannelId, schedule.results.messageId);
  await prisma.schedule.update({ where: { id: schedule.id }, data: { results: { set: null } } });
  await replySchedule(interaction, scheduleNotice("success", "Result removed", "The declaration is gone from the ticket and the result channel. The schedule itself is still active."));
  const details = [ticketLine(guild, bundle.channel.id)];
  if (reason) {
    details.push(`**Reason:** ${reason}`);
  }
  await auditSchedule({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    description: `A schedule result was removed for **${bundle.tournament.name}**.`,
    details,
  });
}
