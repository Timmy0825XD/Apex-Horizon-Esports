import { type ChatInputCommandInteraction, type Guild } from "discord.js";
import { formatRoleFromRole } from "../../lib/formatters.js";
import { deferRole, respondRole } from "./respond.js";
import { roleErrorMessage, roleListMessage } from "./view.js";

async function hydrateMembers(guild: Guild): Promise<void> {
  if (guild.members.cache.size >= guild.memberCount) {
    return;
  }
  await guild.members.fetch().catch(() => undefined);
}

export async function handleRoleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondRole(interaction, roleErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferRole(interaction, true);
  await guild.roles.fetch().catch(() => undefined);

  const picked = interaction.options.getRole("role", true);
  const role = guild.roles.cache.get(picked.id);
  if (!role) {
    await respondRole(interaction, roleErrorMessage("Role missing", "That role is no longer in this server.", false));
    return;
  }

  if (role.id === guild.id) {
    await respondRole(
      interaction,
      roleErrorMessage(
        "Everyone role",
        `${formatRoleFromRole(role)} is every member. Use a specific role instead.`,
        false,
      ),
    );
    return;
  }

  await hydrateMembers(guild);
  const members = [...guild.members.cache.values()]
    .filter((member) => member.roles.cache.has(role.id))
    .sort((a, b) => {
      if (a.user.bot !== b.user.bot) {
        return a.user.bot ? 1 : -1;
      }
      return a.id.localeCompare(b.id);
    });

  await respondRole(interaction, roleListMessage(role, members, interaction.user.id));
}
