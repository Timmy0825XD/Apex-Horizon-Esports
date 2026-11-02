import { PermissionFlagsBits, type ChatInputCommandInteraction, type Guild, type User } from "discord.js";
import { formatUser } from "../../lib/formatters.js";
import { auditUserUnban } from "./audit.js";
import { deferUser, respondUser } from "./respond.js";
import { deleteTrackedBan, fetchDiscordBan, findTrackedBan, forgetDiscordBan, isSnowflake } from "./store.js";
import { userErrorMessage, userUnbanMessage } from "./view.js";

export type UnbanOutcome =
  | { ok: true; user: User | null; hadDiscordBan: boolean }
  | { ok: false; title: string; body: string };

/** Lift the Discord ban and forget the tracked expiry. Shared by `/user unban` and the announcement buttons. */
export async function applyUnban(input: { guild: Guild; actorId: string; targetId: string }): Promise<UnbanOutcome> {
  const { guild, targetId } = input;
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
    return { ok: false, title: "Missing permission", body: "I need the **Ban Members** permission to unban people." };
  }

  const discordBan = await fetchDiscordBan(guild, targetId);
  const tracked = await findTrackedBan(guild.id, targetId);
  if (!discordBan && !tracked) {
    return { ok: false, title: "Not banned", body: `${formatUser(targetId)} is not banned in this server.` };
  }

  if (discordBan) {
    try {
      await guild.bans.remove(targetId, `Unbanned by ${input.actorId}`);
    } catch {
      return {
        ok: false,
        title: "Could not unban",
        body: "Discord rejected the unban. Check my **Ban Members** permission and try again.",
      };
    }
    forgetDiscordBan(guild, targetId);
  }

  await deleteTrackedBan(guild.id, targetId);
  const user = discordBan?.user ?? (await guild.client.users.fetch(targetId).catch(() => null));
  return { ok: true, user, hadDiscordBan: Boolean(discordBan) };
}

export async function handleUserUnban(interaction: ChatInputCommandInteraction): Promise<void> {
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

  const outcome = await applyUnban({ guild, actorId: interaction.user.id, targetId: rawId });
  if (!outcome.ok) {
    await respondUser(interaction, userErrorMessage(outcome.title, outcome.body, false));
    return;
  }

  await respondUser(
    interaction,
    userUnbanMessage({
      userId: rawId,
      actorId: interaction.user.id,
      thumbnailUrl: outcome.user?.displayAvatarURL({ size: 256 }),
      hadDiscordBan: outcome.hadDiscordBan,
    }),
  );
  await auditUserUnban(interaction, guild, rawId);
}
