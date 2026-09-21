import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { requireUserOrganiser } from "./access.js";
import { handleUserBan } from "./ban.js";
import { handleUserUnban } from "./unban.js";
import { respondUser } from "./respond.js";
import { userErrorMessage } from "./view.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleUserSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  if (!interaction.guild) {
    await respondUser(interaction, userErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  if (!(await requireUserOrganiser(interaction, "ban or unban users"))) {
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub === "ban") {
    await handleUserBan(interaction);
    return;
  }
  if (sub === "unban") {
    await handleUserUnban(interaction);
  }
}
