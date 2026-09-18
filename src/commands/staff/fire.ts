import type { ChatInputCommandInteraction, Guild, GuildMember } from "discord.js";
import { formatHelpEntry, formatMember, formatRole, formatUser } from "../../lib/formatters.js";
import { isDiscordAdministrator } from "../../lib/permissions.js";
import { auditStaffMembership } from "./audit.js";
import {
  actorCanManageMember,
  botCanManageRoles,
  fetchActor,
  unmanageableRoleReason,
} from "./hierarchy.js";
import { fireLabel, isFirePost, roleIdsForFire } from "./packages.js";
import { deferStaff, respondStaff } from "./respond.js";
import { loadGuildStaffState } from "./store.js";
import { staffErrorMessage, staffMembershipMessage } from "./view.js";

export async function handleStaffFire(
  interaction: ChatInputCommandInteraction,
  commandId?: string,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondStaff(interaction, staffErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  if (!isDiscordAdministrator(interaction)) {
    await respondStaff(
      interaction,
      staffErrorMessage("Administrator required", "Only a Discord **Administrator** can fire staff."),
    );
    return;
  }

  await deferStaff(interaction);
  await guild.roles.fetch().catch(() => undefined);

  const { settings, staff } = await loadGuildStaffState(guild.id);
  if (!settings || !staff) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Staff config not set",
        `Run ${formatHelpEntry("staff config set", commandId)} before firing.`,
        false,
      ),
    );
    return;
  }

  const post = interaction.options.getString("role", true);
  if (!isFirePost(post)) {
    await respondStaff(interaction, staffErrorMessage("Unknown post", "That staff post is not in the fire list.", false));
    return;
  }

  const user = interaction.options.getUser("user", true);
  const { missing, roleIds } = roleIdsForFire(staff, post);
  if (post !== "complete" && (missing.length > 0 || roleIds.length === 0)) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Post not configured",
        `**${fireLabel(post)}** needs a role that is not set. Use ${formatHelpEntry("staff config edit", commandId)} to add it.`,
        false,
      ),
    );
    return;
  }

  if (roleIds.length === 0) {
    await respondStaff(
      interaction,
      staffErrorMessage("Nothing to remove", "There are no configured staff roles to strip.", false),
    );
    return;
  }

  const target = await guild.members.fetch(user.id).catch(() => null);
  if (!target) {
    await respondStaff(
      interaction,
      staffErrorMessage("Member not found", `${formatUser(user.id)} is not in this server.`, false),
    );
    return;
  }

  const actor = await fetchActor(guild, interaction.user.id, interaction.member);
  const botMember = await guild.members.fetchMe();
  if (!botCanManageRoles(botMember)) {
    await respondStaff(
      interaction,
      staffErrorMessage("Missing permission", "I need **Manage Roles** to remove staff roles.", false),
    );
    return;
  }

  if (!actorCanManageMember(actor, target) && actor.id !== target.id) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Hierarchy blocked",
        `You cannot manage ${formatMember(target)} because their highest role is equal or above yours.`,
        false,
      ),
    );
    return;
  }

  const held = roleIds.filter((id) => target.roles.cache.has(id));
  if (held.length === 0) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Does not hold that post",
        `${formatMember(target)} does not have the Discord roles for **${fireLabel(post)}**.`,
        false,
      ),
    );
    return;
  }

  const hierarchyError = roleHierarchyError(guild, held, actor, botMember);
  if (hierarchyError) {
    await respondStaff(interaction, staffErrorMessage("Hierarchy blocked", hierarchyError, false));
    return;
  }

  try {
    await target.roles.remove(held, `Staff fire: ${fireLabel(post)} by ${interaction.user.id}`);
  } catch {
    await respondStaff(
      interaction,
      staffErrorMessage("Could not remove roles", "Discord rejected the role update. Check my role position and try again.", false),
    );
    return;
  }

  await respondStaff(
    interaction,
    staffMembershipMessage({
      kind: "fire",
      targetId: target.id,
      actorName: interaction.user.username,
      position: post === "complete" ? "All Staff Roles" : fireLabel(post),
      roles: held.map((id) => formatRole(guild, id)).join("\n"),
      thumbnailUrl: target.displayAvatarURL({ size: 256 }),
    }),
  );
  await auditStaffMembership(interaction, guild, settings, "fire", target.id, fireLabel(post), held);
}

function roleHierarchyError(
  guild: Guild,
  roleIds: string[],
  actor: GuildMember,
  botMember: GuildMember,
): string | null {
  for (const id of roleIds) {
    const role = guild.roles.cache.get(id);
    if (!role) {
      continue;
    }
    const reason = unmanageableRoleReason(role, actor, botMember);
    if (reason) {
      return reason;
    }
  }
  return null;
}
