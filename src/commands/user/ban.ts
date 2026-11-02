import {
  GuildMember,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type User,
} from "discord.js";
import { formatUser } from "../../lib/formatters.js";
import { expiresAtFor, isBanDuration, type BanDuration } from "./durations.js";
import { deferUser, respondUser } from "./respond.js";
import { fetchDiscordBan, flattenReason, isSnowflake, saveTrackedBan } from "./store.js";
import { userBanMessage, userErrorMessage } from "./view.js";
import { auditUserBan } from "./audit.js";

function actorCanBanMember(actor: GuildMember, target: GuildMember): boolean {
  if (actor.id === actor.guild.ownerId) {
    return true;
  }
  if (target.id === target.guild.ownerId) {
    return false;
  }
  return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

export type BanOutcome =
  | { ok: true; user: User; expiresAt: Date | null; tracked: boolean }
  | { ok: false; title: string; body: string };

/**
 * The whole ban rule set shared by `/user ban` and the ban-announcement buttons:
 * permission, self/owner/bot guards, already banned, hierarchy, then ban and track the expiry.
 */
export async function applyBan(input: {
  guild: Guild;
  actor: GuildMember;
  targetId: string;
  duration: BanDuration;
  reason: string | null;
}): Promise<BanOutcome> {
  const { guild, actor, targetId } = input;
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
    return { ok: false, title: "Missing permission", body: "I need the **Ban Members** permission to ban people." };
  }
  if (targetId === actor.id) {
    return { ok: false, title: "Cannot ban yourself", body: "Pick someone else to ban." };
  }
  if (targetId === guild.ownerId) {
    return { ok: false, title: "Cannot ban the owner", body: `${formatUser(targetId)} owns this server.` };
  }
  if (targetId === guild.client.user.id) {
    return { ok: false, title: "Cannot ban me", body: "I cannot ban myself." };
  }

  const user: User | null = await guild.client.users.fetch(targetId).catch(() => null);
  if (!user) {
    return { ok: false, title: "Unknown user", body: `\`${targetId}\` is not a Discord user I can resolve.` };
  }
  if (user.bot) {
    return { ok: false, title: "Cannot ban bots", body: `${formatUser(user.id)} is a bot. Ban humans only.` };
  }
  if (await fetchDiscordBan(guild, targetId)) {
    return { ok: false, title: "Already banned", body: `${formatUser(user.id)} is already banned in this server.` };
  }

  const member = await guild.members.fetch(targetId).catch(() => null);
  if (member) {
    if (!actorCanBanMember(actor, member)) {
      return {
        ok: false,
        title: "Hierarchy blocked",
        body: `You cannot ban ${formatUser(member.id)} because their highest role is equal or above yours.`,
      };
    }
    if (!member.bannable) {
      return {
        ok: false,
        title: "Hierarchy blocked",
        body: `I cannot ban ${formatUser(member.id)}. Move my role above theirs and try again.`,
      };
    }
  }

  const expiresAt = expiresAtFor(input.duration, new Date());
  try {
    await guild.members.ban(user, { reason: input.reason ?? `Banned by ${actor.id} (${input.duration})` });
  } catch {
    return {
      ok: false,
      title: "Could not ban",
      body: "Discord rejected the ban. Check my **Ban Members** permission and role position.",
    };
  }

  const tracked = await saveTrackedBan({
    guildId: guild.id,
    userId: user.id,
    duration: input.duration,
    expiresAt,
    reason: input.reason,
    createdBy: actor.id,
  });
  return { ok: true, user, expiresAt, tracked };
}

export async function fetchActor(guild: Guild, interaction: { member: unknown; user: User }): Promise<GuildMember> {
  if (interaction.member instanceof GuildMember) {
    return interaction.member;
  }
  return guild.members.fetch(interaction.user.id);
}

export async function handleUserBan(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondUser(interaction, userErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferUser(interaction);

  const rawId = interaction.options.getString("discord_id", true).trim();
  if (!isSnowflake(rawId)) {
    await respondUser(
      interaction,
      userErrorMessage("Invalid Discord ID", "Paste a Discord user ID (`17`–`20` digits), not a mention or tag.", false),
    );
    return;
  }

  const durationRaw = interaction.options.getString("time", true);
  if (!isBanDuration(durationRaw)) {
    await respondUser(interaction, userErrorMessage("Invalid duration", "Pick a duration from the list.", false));
    return;
  }

  const reason = flattenReason(interaction.options.getString("reason"));
  const outcome = await applyBan({
    guild,
    actor: await fetchActor(guild, interaction),
    targetId: rawId,
    duration: durationRaw,
    reason,
  });
  if (!outcome.ok) {
    await respondUser(interaction, userErrorMessage(outcome.title, outcome.body, false));
    return;
  }

  await respondUser(
    interaction,
    userBanMessage({
      userId: outcome.user.id,
      duration: durationRaw,
      expiresAt: outcome.expiresAt,
      reason,
      actorId: interaction.user.id,
      thumbnailUrl: outcome.user.displayAvatarURL({ size: 256 }),
      note: outcome.tracked
        ? undefined
        : "The Discord ban is in place, but I could not store the expiry. Review it in the ban list.",
    }),
  );
  await auditUserBan(interaction, guild, outcome.user.id, durationRaw, outcome.expiresAt, reason);
}
