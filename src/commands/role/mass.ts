import { type ChatInputCommandInteraction, type Guild, type GuildMember, type Role } from "discord.js";
import { formatRoleFromRole } from "../../lib/formatters.js";
import { auditRoleMass } from "./audit.js";
import { botCanManageRoles, fetchActor, unmanageableRoleReason } from "./hierarchy.js";
import { deferRole, respondRole } from "./respond.js";
import { roleErrorMessage, roleInfoMessage, roleMassMessage, type MassBuckets } from "./view.js";

async function hydrateMembers(guild: Guild): Promise<void> {
  if (guild.members.cache.size >= guild.memberCount) {
    return;
  }
  await guild.members.fetch().catch(() => undefined);
}

async function applyMass(
  members: GuildMember[],
  role: Role,
  action: "add" | "remove",
  reason: string,
): Promise<MassBuckets> {
  const buckets: MassBuckets = { changed: [], skipped: [], failed: [] };

  for (const member of members) {
    const hasRole = member.roles.cache.has(role.id);
    const alreadyDone = action === "add" ? hasRole : !hasRole;
    if (alreadyDone) {
      buckets.skipped.push(member);
      continue;
    }

    try {
      if (action === "add") {
        await member.roles.add(role, reason);
      } else {
        await member.roles.remove(role, reason);
      }
      buckets.changed.push(member);
    } catch {
      buckets.failed.push(member);
    }
  }

  return buckets;
}

export async function handleRoleMass(
  interaction: ChatInputCommandInteraction,
  action: "add" | "remove",
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondRole(interaction, roleErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferRole(interaction);
  await guild.roles.fetch().catch(() => undefined);

  const picked = interaction.options.getRole("role", true);
  const role = guild.roles.cache.get(picked.id);
  if (!role) {
    await respondRole(interaction, roleErrorMessage("Role missing", "That role is no longer in this server.", false));
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

  await hydrateMembers(guild);
  const members = [...guild.members.cache.values()];
  if (members.length === 0) {
    await respondRole(
      interaction,
      roleErrorMessage("Members unavailable", "I could not load the member list for this server.", false),
    );
    return;
  }

  const mention = formatRoleFromRole(role);
  if (action === "remove" && !members.some((member) => member.roles.cache.has(role.id))) {
    await respondRole(
      interaction,
      roleInfoMessage("Nobody has that role", `No member currently has ${mention}.`, false),
    );
    return;
  }

  const buckets = await applyMass(
    members,
    role,
    action,
    action === "add" ? `Role add all by ${interaction.user.id}` : `Role remove all by ${interaction.user.id}`,
  );

  await respondRole(interaction, roleMassMessage(action, role, buckets, interaction.user.id));
  await auditRoleMass(interaction, guild, role.id, action, buckets.changed.length);
}
