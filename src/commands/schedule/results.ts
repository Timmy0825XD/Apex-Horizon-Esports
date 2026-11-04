import { AttachmentBuilder, MessageFlags, type ChatInputCommandInteraction, type Guild, type Message } from "discord.js";
import type { Schedule, ScheduleResults } from "@prisma/client";
import { formatChannel } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { loadGuildSettings } from "../settings/store.js";
import { findTournamentById } from "../tournament/store.js";
import { isJudge } from "./access.js";
import { auditSchedule, ticketLine } from "./audit.js";
import { textChannel } from "./channel.js";
import { paintSchedule } from "./live.js";
import { deleteTracked, thumbnailImageUrl } from "./messages.js";
import { slashMention } from "../../lib/register-slash.js";
import { scoreLine } from "../room/labels.js";
import { cardPayload, matchEyebrow, quote, replySchedule, scheduleCard, scheduleNotice, stampFooter } from "./respond.js";
import { findMatch, findScheduleForMatch, presentFace } from "./store.js";
import type { TicketBundle } from "./ticket.js";
import { postMentionIds, resultsEmbed, resultsPayload } from "./view.js";

type ProofFile = { data: Buffer; name: string };

/** `proof-3.png`: unique names, so the gallery can point at each attachment. */
function proofName(index: number, original: string | null | undefined): string {
  const extension = original?.match(/\.(png|jpe?g|gif|webp)$/i)?.[1]?.toLowerCase() ?? "png";
  return `proof-${index}.${extension}`;
}

/** Download each proof once; the ticket and the result channel both upload from these bytes. */
async function proofFiles(interaction: ChatInputCommandInteraction): Promise<ProofFile[]> {
  const picked: { url: string; name: string }[] = [];
  for (let index = 1; index <= 10; index += 1) {
    const attachment = interaction.options.getAttachment(`image${index}`);
    if (attachment) {
      picked.push({ url: attachment.url, name: proofName(index, attachment.name) });
    }
  }
  return Promise.all(
    picked.map(async ({ url, name }) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) {
        throw new Error(`Could not download proof image ${name} (HTTP ${response.status}).`);
      }
      return { data: Buffer.from(await response.arrayBuffer()), name };
    }),
  );
}

function proofAttachments(files: ProofFile[]): AttachmentBuilder[] {
  return files.map((file) => new AttachmentBuilder(file.data, { name: file.name }));
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

/**
 * Repaint one result post after its links or transcript changed. The message keeps its own attachments,
 * so the gallery points at them by name. Posts from before the V2 redesign keep their embed.
 */
async function editResultsPost(
  guild: Guild,
  channelId: string,
  messageId: string | null | undefined,
  render: { v2: (proofNames: string[]) => ReturnType<typeof resultsPayload>; legacy: () => Promise<ReturnType<typeof resultsEmbed>> },
): Promise<void> {
  if (!messageId) {
    return;
  }
  const channel = await textChannel(guild, channelId);
  const message = await channel?.messages.fetch(messageId).catch(() => null);
  if (!message) {
    return;
  }
  if (message.flags.has(MessageFlags.IsComponentsV2)) {
    const names = [...message.attachments.values()].map((file) => file.name);
    await message.edit({ ...render.v2(names), allowedMentions: { parse: [] } });
    return;
  }
  await message.edit({ embeds: [await render.legacy()], allowedMentions: { parse: [] } });
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
  const card = {
    face,
    team1Score: results.team1Score,
    team2Score: results.team2Score,
    notes: results.notes,
    links: results.links ?? [],
    declaredAt: results.declaredAt,
    uploadedById: results.uploadedBy ?? null,
    transcriptUrl: results.transcriptUrl ?? null,
  };
  const legacy = async () => {
    const uploaded = results.uploadedBy ? await guild.client.users.fetch(results.uploadedBy).catch(() => null) : null;
    return resultsEmbed({ ...card, uploadedBy: uploaded?.username ?? "Unknown" });
  };
  await editResultsPost(guild, schedule.channelId, results.ticketMessageId, {
    v2: (proofNames) => resultsPayload({ ...card, proofNames, intro: true }),
    legacy,
  });
  await editResultsPost(guild, tournament.resultChannelId, results.messageId, {
    v2: (proofNames) => resultsPayload({ ...card, proofNames, intro: false }),
    legacy,
  });
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
  const captains = postMentionIds(face, false);
  const allowedMentions = { users: captains, parse: [] as [] };
  let proofs: ProofFile[];
  try {
    proofs = await proofFiles(interaction);
  } catch (error) {
    console.error("Schedule results proof download failed", error);
    await replySchedule(interaction, scheduleNotice("error", "Images not loaded", "The proof images could not be downloaded. Upload them again."));
    return;
  }
  let ticketPost: Message | null = null;
  let channelPost: Message | null = null;
  try {
    const card = {
      face,
      team1Score: team1,
      team2Score: team2,
      notes,
      links: [],
      declaredAt,
      uploadedById: interaction.user.id,
      transcriptUrl: null,
      proofNames: proofs.map((file) => file.name),
    };
    ticketPost = await bundle.channel.send({
      ...resultsPayload({ ...card, intro: true }),
      files: proofAttachments(proofs),
      allowedMentions,
    });
    channelPost = await resultChannel.send({
      ...resultsPayload({ ...card, intro: false }),
      files: proofAttachments(proofs),
      allowedMentions: { parse: [] },
    });
    const imageUrls = [...channelPost.attachments.values()].map((file) => file.url);
    // Store only if no other judge declared meanwhile; the loser's posts are removed below.
    const stored = await prisma.schedule.updateMany({
      where: { id: schedule.id, OR: [{ results: null }, { results: { isSet: false } }] },
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
    if (stored.count === 0) {
      await ticketPost.delete().catch(() => undefined);
      await channelPost.delete().catch(() => undefined);
      await replySchedule(interaction, scheduleNotice("error", "Result already posted", "Another judge declared this match a moment ago."));
      return;
    }
    const next = await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
    await paintSchedule(guild, bundle.channel, bundle.settings, bundle.tournament, bundle.match, next, false).catch((error) => {
      console.error("Schedule seat lock failed", error);
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
    action: "created",
    title: "Result declared",
    summary: `A schedule result was declared for **${bundle.tournament.name}**.`,
    details: [ticketLine(guild, bundle.channel.id), `**Score** \`${team1} - ${team2}\``],
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
    await replySchedule(interaction, scheduleNotice("info", "Delete cancelled", "The public result is still up in this ticket and the result channel."));
    return;
  }
  if (!schedule.results) {
    await replySchedule(interaction, scheduleNotice("error", "No result", "This schedule does not have a public result."));
    return;
  }
  const reason = interaction.options.getString("reason")?.trim() || null;
  await deleteTracked(guild, schedule.channelId, schedule.results.ticketMessageId);
  await deleteTracked(guild, bundle.tournament.resultChannelId, schedule.results.messageId);
  const next = await prisma.schedule.update({ where: { id: schedule.id }, data: { results: { set: null } } });
  await paintSchedule(guild, bundle.channel, bundle.settings, bundle.tournament, bundle.match, next, false).catch((error) => {
    console.error("Schedule seat lock failed", error);
  });
  const removed = schedule.results;
  const blocks = [
    `${scoreLine(bundle.match.player1Name, bundle.match.player2Name, removed.team1Score, removed.team2Score)} was taken off this ticket and ${formatChannel(guild, bundle.tournament.resultChannelId)}.`,
  ];
  if (reason) {
    blocks.push(quote(reason));
  }
  blocks.push(`-# The schedule is still active and the bracket did not change. A judge can declare again with ${slashMention(guild.id, "schedule results add")}.`);
  await replySchedule(
    interaction,
    cardPayload(
      scheduleCard({
        tone: "danger",
        eyebrow: matchEyebrow(bundle.tournament.name, bundle.match),
        title: "Result removed",
        blocks,
        footer: stampFooter("Removed", interaction.user.id),
      }),
    ),
  );
  const details = [ticketLine(guild, bundle.channel.id)];
  if (reason) {
    details.push(`**Reason** ${reason}`);
  }
  await auditSchedule({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    action: "deleted",
    title: "Result removed",
    summary: `A schedule result was removed for **${bundle.tournament.name}**.`,
    details,
  });
}
