import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { requireRoleOrganiser } from "./access.js";
import { handleRoleList } from "./list.js";
import { handleRoleMass } from "./mass.js";
import { handleRoleUser } from "./toggle.js";
import { respondRole } from "./respond.js";
import { roleErrorMessage } from "./view.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleRoleSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  if (!interaction.guild) {
    await respondRole(interaction, roleErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  if (!(await requireRoleOrganiser(interaction, "manage Discord roles"))) {
    return;
  }

  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  if (group === "add" && sub === "all") {
    await handleRoleMass(interaction, "add");
    return;
  }
  if (group === "remove" && sub === "all") {
    await handleRoleMass(interaction, "remove");
    return;
  }
  if (sub === "user") {
    await handleRoleUser(interaction);
    return;
  }
  if (sub === "list") {
    await handleRoleList(interaction);
  }
}
