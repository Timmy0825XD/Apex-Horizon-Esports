import {
  MessageFlags,
  type ButtonInteraction,
  type Guild,
  type Message,
  type StringSelectMenuInteraction,
  type TextBasedChannel,
} from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { memberIsOrganiser } from "../../lib/organiser.js";
import { loadGuildStaffState } from "../staff/store.js";
import { auditUserBan, auditUserUnban } from "../user/audit.js";
import { applyBan, fetchActor } from "../user/ban.js";
import { isBanDuration } from "../user/durations.js";
import { fetchDiscordBan, findTrackedBan } from "../user/store.js";
import { applyUnban } from "../user/unban.js";
import { announcementText, parseAnnouncement } from "./parse.js";
import {
  claimRequest,
  closeRequest,
  createRequests,
  findRequest,
  openRequestsFor,
  releaseRequest,
  rosterHits,
  setCardMessage,
  setDuration,
  setPingMessage,
  type BanRequest,
} from "./store.js";
import { announcementLink, pendingCard, pingContent, resultCard, type Target } from "./view.js";

const v2 = MessageFlags.IsComponentsV2;

async function bannedHere(guild: Guild, userId: string): Promise<string | null> {
  const [discordBan, tracked] = await Promise.all([fetchDiscordBan(guild, userId), findTrackedBan(guild.id, userId)]);
  if (tracked) {
    return tracked.duration;
  }
  return discordBan ? "Discord ban" : null;
}

async function loadTarget(guild: Guild, request: BanRequest, hits?: Target["hits"]): Promise<Target> {
  const [user, member, banned, roster] = await Promise.all([
    guild.client.users.fetch(request.userId).catch(() => null),
    guild.members.fetch(request.userId).catch(() => null),
    bannedHere(guild, request.userId),
    hits ? Promise.resolve(hits) : rosterHits(guild.id, [request.userId]).then((map) => map.get(request.userId) ?? []),
  ]);
  let blocker: string | null = null;
  if (!user) {
    blocker = "Unknown Discord account. There is no one to ban.";
  } else if (user.id === guild.ownerId) {
    blocker = "This account owns the server and cannot be banned.";
  } else if (user.bot) {
    blocker = "This account is a bot. Bans from announcements are for players only.";
  } else if (request.kind === "ban" && banned) {
    blocker = `Already banned here (**${banned}**).`;
  }
  return { user, inServer: Boolean(member), bannedHere: banned, hits: roster, blocker };
}

/** Called for every message in a server. Only the configured bans channel is read. */
export async function handleBanAnnouncement(message: Message): Promise<void> {
  const guild = message.guild;
  const client = message.client;
  if (!guild || !isAllowedGuild(guild.id)) {
    return;
  }
  // Ignore the bot itself, including its own webhooks, so its cards and logs never feed back in.
  if (message.author.id === client.user.id || (message.applicationId && message.applicationId === client.application?.id)) {
    return;
  }
  const { settings, staff } = await loadGuildStaffState(guild.id);
  if (!settings || message.channelId !== settings.bansChannelId) {
    return;
  }

  const announcement = parseAnnouncement(announcementText(message));
  if (announcement.ids.length === 0) {
    return;
  }
  // An unban only matters for people banned here; the rest is left alone.
  const ids =
    announcement.kind === "unban"
      ? (
          await Promise.all(
            announcement.ids.map(async (entry) => ((await bannedHere(guild, entry.userId)) ? entry : null)),
          )
        ).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      : announcement.ids;
  if (ids.length === 0) {
    return;
  }

  const requests = await createRequests({
    guildId: guild.id,
    channelId: message.channelId,
    sourceMessageId: message.id,
    kind: announcement.kind,
    ids,
  });
  if (requests.length === 0) {
    return;
  }

  const channel = message.channel;
  if (!channel.isSendable()) {
    return;
  }
  const hits = await rosterHits(guild.id, requests.map((request) => request.userId));
  for (const request of requests) {
    const target = await loadTarget(guild, request, hits.get(request.userId) ?? []);
    const card = await channel.send({ components: [pendingCard(request, target)], flags: v2, allowedMentions: { parse: [] } });
    await setCardMessage(request.id, card.id);
  }

  const roleId = staff?.managerRoleId;
  if (roleId) {
    const onRoster = requests.filter((request) => (hits.get(request.userId) ?? []).length > 0).length;
    const ping = await channel.send({
      content: pingContent(roleId, announcement.kind, requests.length, onRoster),
      allowedMentions: { roles: [roleId] },
    });
    await setPingMessage(guild.id, message.id, ping.id);
  }
}

async function deleteMessage(channel: TextBasedChannel | null, messageId: string | null): Promise<void> {
  if (!channel || !messageId || !("messages" in channel)) {
    return;
  }
  await channel.messages.delete(messageId).catch(() => undefined);
}

/** When the last card of an announcement is decided, its ping goes away. */
async function dropPingIfDone(channel: TextBasedChannel | null, request: BanRequest): Promise<void> {
  if ((await openRequestsFor(request.guildId, request.sourceMessageId)) === 0) {
    await deleteMessage(channel, request.pingMessageId);
  }
}

type BanWatchInteraction = ButtonInteraction | StringSelectMenuInteraction;

async function privately(interaction: BanWatchInteraction, content: string): Promise<void> {
  const payload = { content, allowedMentions: { parse: [] as const } };
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}

async function guardRequest(interaction: BanWatchInteraction, requestId: string): Promise<{ guild: Guild; request: BanRequest } | null> {
  const guild = interaction.guild;
  const request = await findRequest(requestId);
  if (!guild || !request || request.guildId !== guild.id) {
    await privately(interaction, "This request is no longer available.");
    return null;
  }
  if (!(await memberIsOrganiser(interaction))) {
    await privately(interaction, "Only an **Organiser** can decide ban announcements.");
    return null;
  }
  if (request.status !== "pending" && request.status !== "deciding") {
    await privately(interaction, "Someone already decided this request.");
    return null;
  }
  return { guild, request };
}

async function decide(interaction: ButtonInteraction, guild: Guild, request: BanRequest, action: "confirm" | "cancel"): Promise<void> {
  if (!(await claimRequest(request.id))) {
    await privately(interaction, "Someone already decided this request.");
    return;
  }
  await interaction.deferUpdate();
  const channel = interaction.channel;
  const target = await loadTarget(guild, request);

  if (action === "cancel") {
    await closeRequest(request.id, "dismissed", interaction.user.id);
    await interaction.message.delete().catch(() => undefined);
    if (channel?.isSendable()) {
      await channel.send({
        components: [resultCard({ request, target, outcome: "dismissed", actorId: interaction.user.id })],
        flags: v2,
        allowedMentions: { parse: [] },
      });
    }
    await dropPingIfDone(channel, request);
    return;
  }

  const link = announcementLink(request);
  if (request.kind === "unban") {
    const outcome = await applyUnban({ guild, actorId: interaction.user.id, targetId: request.userId });
    if (!outcome.ok) {
      await releaseRequest(request.id);
      await privately(interaction, `**${outcome.title}.** ${outcome.body}`);
      return;
    }
    await closeRequest(request.id, "applied", interaction.user.id);
    await interaction.message.delete().catch(() => undefined);
    if (channel?.isSendable()) {
      await channel.send({
        components: [resultCard({ request, target, outcome: "unbanned", actorId: interaction.user.id })],
        flags: v2,
        allowedMentions: { parse: [] },
      });
    }
    await dropPingIfDone(channel, request);
    await auditUserUnban(interaction, guild, request.userId, link);
    return;
  }

  const duration = isBanDuration(request.duration) ? request.duration : "Permanent";
  const reason = `Ban announcement${request.reason ? `: ${request.reason}` : ""}`.slice(0, 450);
  const outcome = await applyBan({ guild, actor: await fetchActor(guild, interaction), targetId: request.userId, duration, reason });
  if (!outcome.ok) {
    await releaseRequest(request.id);
    await privately(interaction, `**${outcome.title}.** ${outcome.body}`);
    return;
  }
  await closeRequest(request.id, "applied", interaction.user.id);
  await interaction.message.delete().catch(() => undefined);
  if (channel?.isSendable()) {
    await channel.send({
      components: [
        resultCard({
          request,
          target,
          outcome: "banned",
          actorId: interaction.user.id,
          expiresAt: outcome.expiresAt,
          note: outcome.tracked ? undefined : "The Discord ban is in place, but the expiry was not stored. Review it in the ban list.",
        }),
      ],
      flags: v2,
      allowedMentions: { parse: [] },
    });
  }
  await dropPingIfDone(channel, request);
  await auditUserBan(interaction, guild, request.userId, duration, outcome.expiresAt, request.reason, link);
}

export async function handleBanWatchButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, requestId] = interaction.customId.split(":");
  if (!action || !requestId) {
    return;
  }
  const ready = await guardRequest(interaction, requestId);
  if (!ready) {
    return;
  }
  const { guild, request } = ready;
  if (action === "confirm" || action === "cancel") {
    await decide(interaction, guild, request, action);
    return;
  }
  if (action === "duration" || action === "back") {
    const target = await loadTarget(guild, request);
    await interaction.update({
      components: [pendingCard(request, target, action === "duration" ? "duration" : "buttons")],
      allowedMentions: { parse: [] },
    });
  }
}

export async function handleBanWatchSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const [, , requestId] = interaction.customId.split(":");
  const ready = requestId ? await guardRequest(interaction, requestId) : null;
  if (!ready) {
    return;
  }
  const choice = interaction.values[0] ?? "";
  if (!isBanDuration(choice)) {
    await privately(interaction, "Pick a duration from the list.");
    return;
  }
  const updated = await setDuration(ready.request.id, choice);
  if (!updated) {
    await privately(interaction, "Someone already decided this request.");
    return;
  }
  // Back to the three buttons with the new duration: the ban still needs Confirm.
  const target = await loadTarget(ready.guild, updated);
  await interaction.update({ components: [pendingCard(updated, target)], allowedMentions: { parse: [] } });
}
