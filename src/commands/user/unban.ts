import { PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { formatUser } from "../../lib/formatters.js";
import { auditUserUnban } from "./audit.js";
import { deferUser, respondUser } from "./respond.js";
import { deleteTrackedBan, fetchDiscordBan, findTrackedBan, forgetDiscordBan, isSnowflake } from "./store.js";
import { userErrorMessage, userUnbanMessage } from "./view.js";

export async function handleUserUnban(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondUser(interaction, userErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferUser(interaction);

  if (!guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
    await respondUser(
      interaction,
      userErrorMessage("Missing permission", "I need the **Ban Members** permission to unban people.", false),
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

  const discordBan = await fetchDiscordBan(guild, rawId);
  const tracked = await findTrackedBan(guild.id, rawId);

  if (!discordBan && !tracked) {
    await respondUser(
      interaction,
      userErrorMessage("Not banned", `${formatUser(rawId)} is not banned in this server.`, false),
    );
    return;
  }

  if (discordBan) {
    try {
      await guild.bans.remove(rawId, `Unbanned by ${interaction.user.id}`);
    } catch {
      await respondUser(
        interaction,
        userErrorMessage(
          "Could not unban",
          "Discord rejected the unban. Check my **Ban Members** permission and try again.",
          false,
        ),
      );
      return;
    }
    forgetDiscordBan(guild, rawId);
  }

  await deleteTrackedBan(guild.id, rawId);

  const user = discordBan?.user ?? (await guild.client.users.fetch(rawId).catch(() => null));
  await respondUser(
    interaction,
    userUnbanMessage({
      userId: rawId,
      actorId: interaction.user.id,
      thumbnailUrl: user?.displayAvatarURL({ size: 256 }),
      hadDiscordBan: Boolean(discordBan),
    }),
  );
  await auditUserUnban(interaction, guild, rawId);
}
