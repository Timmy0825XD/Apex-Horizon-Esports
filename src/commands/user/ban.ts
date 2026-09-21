import {
  GuildMember,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type User,
} from "discord.js";
import { formatUser } from "../../lib/formatters.js";
import { expiresAtFor, isBanDuration } from "./durations.js";
import { deferUser, respondUser } from "./respond.js";
import { flattenReason, isSnowflake, saveTrackedBan } from "./store.js";
import { userBanMessage, userErrorMessage } from "./view.js";
import { auditUserBan } from "./audit.js";

async function fetchActor(guild: Guild, interaction: ChatInputCommandInteraction): Promise<GuildMember> {
  if (interaction.member instanceof GuildMember) {
    return interaction.member;
  }
  return guild.members.fetch(interaction.user.id);
}

function actorCanBanMember(actor: GuildMember, target: GuildMember): boolean {
  if (actor.id === actor.guild.ownerId) {
    return true;
  }
  if (target.id === target.guild.ownerId) {
    return false;
  }
  return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

export async function handleUserBan(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondUser(interaction, userErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferUser(interaction);

  if (!guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
    await respondUser(
      interaction,
      userErrorMessage("Missing permission", "I need the **Ban Members** permission to ban people.", false),
    );
    return;
  }

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

  if (rawId === interaction.user.id) {
    await respondUser(interaction, userErrorMessage("Cannot ban yourself", "Pick someone else to ban.", false));
    return;
  }

  if (rawId === guild.ownerId) {
    await respondUser(
      interaction,
      userErrorMessage("Cannot ban the owner", `${formatUser(rawId)} owns this server.`, false),
    );
    return;
  }

  if (rawId === guild.client.user.id) {
    await respondUser(interaction, userErrorMessage("Cannot ban me", "I cannot ban myself.", false));
    return;
  }

  const user: User | null = await guild.client.users.fetch(rawId).catch(() => null);
  if (!user) {
    await respondUser(
      interaction,
      userErrorMessage("Unknown user", `\`${rawId}\` is not a Discord user I can resolve.`, false),
    );
    return;
  }

  if (user.bot) {
    await respondUser(
      interaction,
      userErrorMessage("Cannot ban bots", `${formatUser(user.id)} is a bot. Ban humans only.`, false),
    );
    return;
  }

  const existing = await guild.bans.fetch(rawId).catch(() => null);
  if (existing) {
    await respondUser(
      interaction,
      userErrorMessage("Already banned", `${formatUser(user.id)} is already banned in this server.`, false),
    );
    return;
  }

  const member = await guild.members.fetch(rawId).catch(() => null);
  if (member) {
    const actor = await fetchActor(guild, interaction);
    if (!actorCanBanMember(actor, member)) {
      await respondUser(
        interaction,
        userErrorMessage(
          "Hierarchy blocked",
          `You cannot ban ${formatUser(member.id)} because their highest role is equal or above yours.`,
          false,
        ),
      );
      return;
    }
    if (!member.bannable) {
      await respondUser(
        interaction,
        userErrorMessage(
          "Hierarchy blocked",
          `I cannot ban ${formatUser(member.id)}. Move my role above theirs and try again.`,
          false,
        ),
      );
      return;
    }
  }

  const reason = flattenReason(interaction.options.getString("reason"));
  const bannedAt = new Date();
  const expiresAt = expiresAtFor(durationRaw, bannedAt);
  const auditReason = reason ?? `Banned by ${interaction.user.id} (${durationRaw})`;

  try {
    await guild.members.ban(user, { reason: auditReason });
  } catch {
    await respondUser(
      interaction,
      userErrorMessage("Could not ban", "Discord rejected the ban. Check my **Ban Members** permission and role position.", false),
    );
    return;
  }

  const tracked = await saveTrackedBan({
    guildId: guild.id,
    userId: user.id,
    duration: durationRaw,
    expiresAt,
    reason,
    createdBy: interaction.user.id,
  });

  await respondUser(
    interaction,
    userBanMessage({
      userId: user.id,
      duration: durationRaw,
      expiresAt,
      reason,
      actorId: interaction.user.id,
      thumbnailUrl: user.displayAvatarURL({ size: 256 }),
      note: tracked
        ? undefined
        : "The Discord ban is in place, but I could not store the expiry. Review it in the ban list.",
    }),
  );
  await auditUserBan(interaction, guild, user.id, durationRaw, expiresAt, reason);
}
