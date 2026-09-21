import { type ChatInputCommandInteraction } from "discord.js";
import { formatMember, formatUser } from "../../lib/formatters.js";
import { auditRoleToggle } from "./audit.js";
import { actorCanManageMember, botCanManageRoles, fetchActor, unmanageableRoleReason } from "./hierarchy.js";
import { deferRole, respondRole } from "./respond.js";
import { roleErrorMessage, roleToggleMessage } from "./view.js";

export async function handleRoleUser(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondRole(interaction, roleErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferRole(interaction);
  await guild.roles.fetch().catch(() => undefined);

  const user = interaction.options.getUser("target", true);
  const picked = interaction.options.getRole("role", true);
  const role = guild.roles.cache.get(picked.id);
  if (!role) {
    await respondRole(interaction, roleErrorMessage("Role missing", "That role is no longer in this server.", false));
    return;
  }

  const target = await guild.members.fetch(user.id).catch(() => null);
  if (!target) {
    await respondRole(
      interaction,
      roleErrorMessage("Member not found", `${formatUser(user.id)} is not in this server.`, false),
    );
    return;
  }

  const actor = await fetchActor(guild, interaction.user.id, interaction.member);
  const botMember = await guild.members.fetchMe();
  if (!botCanManageRoles(botMember)) {
    await respondRole(
      interaction,
      roleErrorMessage("Missing permission", "I need **Manage Roles** to change member roles.", false),
    );
    return;
  }

  const roleReason = unmanageableRoleReason(role, actor, botMember);
  if (roleReason) {
    await respondRole(interaction, roleErrorMessage("Hierarchy blocked", roleReason, false));
    return;
  }

  if (!actorCanManageMember(actor, target) && actor.id !== target.id) {
    await respondRole(
      interaction,
      roleErrorMessage(
        "Hierarchy blocked",
        `You cannot manage ${formatMember(target)} because their highest role is equal or above yours.`,
        false,
      ),
    );
    return;
  }

  const added = !target.roles.cache.has(role.id);
  try {
    if (added) {
      await target.roles.add(role, `Role toggle by ${interaction.user.id}`);
    } else {
      await target.roles.remove(role, `Role toggle by ${interaction.user.id}`);
    }
  } catch {
    await respondRole(
      interaction,
      roleErrorMessage(
        "Could not update roles",
        "Discord rejected the role update. Check my role position and try again.",
        false,
      ),
    );
    return;
  }

  await respondRole(
    interaction,
    roleToggleMessage({
      added,
      role,
      targetId: target.id,
      actorId: interaction.user.id,
    }),
  );
  await auditRoleToggle(interaction, guild, role.id, target.id, added);
}
