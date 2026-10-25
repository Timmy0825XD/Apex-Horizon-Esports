import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { actorMatches } from "../../lib/command-access.js";
import { v2Flags } from "../../lib/v2.js";
import { handleServerBanlist } from "./banlist.js";
import { buildServerInfoContainer } from "./info.js";
import { handleServerInvites } from "./invites.js";
import { handleServerTree } from "./tree.js";
import { serverErrorMessage } from "./view.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleServerSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply(
      serverErrorMessage("Guild only", "This command can only be used in a server."),
    );
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub === "banlist") {
    await handleServerBanlist(interaction, guild);
    return;
  }
  if (sub === "tree") {
    await handleServerTree(interaction, guild);
    return;
  }
  if (sub === "invites") {
    await handleServerInvites(interaction, guild);
    return;
  }
  if (sub !== "info") {
    return;
  }

  if (!(await actorMatches(interaction, { admin: true, organiser: true }))) {
    await interaction.reply(
      serverErrorMessage("Admin or organiser required", "You need **Admin** or **Organiser** to view server info."),
    );
    return;
  }

  await interaction.deferReply();
  const container = await buildServerInfoContainer(guild, interaction.user.id, interaction.createdAt);
  await interaction.editReply({
    components: [container],
    flags: v2Flags,
  });
}
