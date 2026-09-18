import {
  ChannelType,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
} from "discord.js";
import type { StaffInput } from "./fields.js";
import { formatHelpEntry, formatMember, formatRole, formatUser } from "../../lib/formatters.js";
import { isDiscordAdministrator } from "../../lib/permissions.js";
import { auditStaffMembership } from "./audit.js";
import {
  actorCanManageMember,
  botCanManageRoles,
  fetchActor,
  unmanageableRoleReason,
} from "./hierarchy.js";
import { isRecruitPost, recruitLabel, roleIdsForRecruit } from "./packages.js";
import { deferStaff, respondStaff } from "./respond.js";
import { loadGuildStaffState } from "./store.js";
import { staffErrorMessage, staffMembershipMessage, staffWelcomeMessage } from "./view.js";

async function postWelcome(
  guild: Guild,
  staff: StaffInput,
  target: GuildMember,
  postLabel: string,
  roleIds: string[],
): Promise<string | null> {
  const channel = await guild.channels.fetch(staff.staffchatChannelId).catch(() => null);
  if (
    !channel ||
    (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)
  ) {
    return "Roles were granted, but the staff chat channel is missing so no welcome was posted.";
  }

  try {
    await channel.send(staffWelcomeMessage({ guild, staff, target, postLabel, roleIds }));
    return null;
  } catch {
    return "Roles were granted, but I could not post the welcome in staff chat.";
  }
}

export async function handleStaffRecruit(
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
      staffErrorMessage(
        "Administrator required",
        "Only a Discord **Administrator** can recruit staff.",
      ),
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
        `Run ${formatHelpEntry("staff config set", commandId)} before recruiting.`,
        false,
      ),
    );
    return;
  }

  const post = interaction.options.getString("role", true);
  if (!isRecruitPost(post)) {
    await respondStaff(interaction, staffErrorMessage("Unknown post", "That staff post is not in the recruit list.", false));
    return;
  }

  const user = interaction.options.getUser("user", true);
  if (user.bot) {
    await respondStaff(interaction, staffErrorMessage("Bots cannot be staff", "Pick a human member to recruit.", false));
    return;
  }

  const { missing, roleIds } = roleIdsForRecruit(staff, post);
  if (missing.length > 0 || roleIds.length === 0) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Post not configured",
        `**${recruitLabel(post)}** needs a role that is not set. Use ${formatHelpEntry("staff config edit", commandId)} to add it.`,
        false,
      ),
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
      staffErrorMessage("Missing permission", "I need **Manage Roles** to grant staff roles.", false),
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

  const roles = roleIds
    .map((id) => guild.roles.cache.get(id) ?? null)
    .filter((role): role is NonNullable<typeof role> => role != null);

  if (roles.length !== roleIds.length) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Role missing",
        "A role in that package no longer exists in this server. Update staff config first.",
        false,
      ),
    );
    return;
  }

  for (const role of roles) {
    const reason = unmanageableRoleReason(role, actor, botMember);
    if (reason) {
      await respondStaff(interaction, staffErrorMessage("Hierarchy blocked", reason, false));
      return;
    }
  }

  const toAdd = roles.filter((role) => !target.roles.cache.has(role.id));
  if (toAdd.length === 0) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Already holds that post",
        `${formatMember(target)} already has every role in the **${recruitLabel(post)}** package.`,
        false,
      ),
    );
    return;
  }

  try {
    await target.roles.add(
      toAdd.map((role) => role.id),
      `Staff recruit: ${recruitLabel(post)} by ${interaction.user.id}`,
    );
  } catch {
    await respondStaff(
      interaction,
      staffErrorMessage("Could not grant roles", "Discord rejected the role update. Check my role position and try again.", false),
    );
    return;
  }

  const welcomeNote = await postWelcome(guild, staff, target, recruitLabel(post), toAdd.map((role) => role.id));
  await respondStaff(
    interaction,
    staffMembershipMessage({
      kind: "recruit",
      targetId: target.id,
      actorName: interaction.user.username,
      position: recruitLabel(post),
      roles: toAdd.map((role) => formatRole(guild, role.id)).join("\n"),
      thumbnailUrl: target.displayAvatarURL({ size: 256 }),
      note: welcomeNote ?? undefined,
    }),
  );
  await auditStaffMembership(
    interaction,
    guild,
    settings,
    "recruit",
    target.id,
    recruitLabel(post),
    toAdd.map((role) => role.id),
  );
}
