import { PermissionFlagsBits, type ChatInputCommandInteraction, type Guild } from "discord.js";
import { emojis } from "../../emojis.js";
import { actorMatches } from "../../lib/command-access.js";
import { embedColors } from "../../lib/embeds.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { botHasChannelPermission } from "./access.js";
import { auditUtility } from "./audit.js";
import { currentPostChannel } from "./channels.js";
import { actorFooter, respondUtility, utilityCard, utilityError, utilityInfo } from "./view.js";

const memberAccess = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
] as const;

export async function handleAddMember(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!(await actorMatches(interaction, { admin: true, organiser: true, helper: true }))) {
    await respondUtility(
      interaction,
      utilityError("Access denied", "Only **Admin**, **Organiser** or **Helper** can add members to a channel."),
    );
    return;
  }

  const channel = currentPostChannel(interaction.channel);
  if (!channel) {
    await respondUtility(interaction, utilityError("Not a text channel", "Run it in a text or announcement channel."));
    return;
  }
  if (!botHasChannelPermission(channel, [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles])) {
    await respondUtility(
      interaction,
      utilityError(
        "I cannot change access here",
        "I need **Manage Channels** and **Manage Permissions** in this channel to add someone.",
      ),
    );
    return;
  }

  const user = interaction.options.getUser("user", true);
  if (user.bot) {
    await respondUtility(interaction, utilityError("Bots are not added", "Pick a person, not a bot."));
    return;
  }
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    await respondUtility(interaction, utilityError("Not in this server", `${formatUser(user.id)} is not a member here.`));
    return;
  }

  if (channel.permissionsFor(member)?.has(memberAccess)) {
    await respondUtility(
      interaction,
      utilityInfo("Already has access", `${formatUser(user.id)} can already see and write in ${formatChannel(guild, channel.id)}.`),
    );
    return;
  }

  try {
    await channel.permissionOverwrites.edit(
      member.id,
      { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true },
      { reason: `Added by ${interaction.user.id}` },
    );
  } catch {
    await respondUtility(
      interaction,
      utilityError("Could not add member", "Discord refused the permission change. Check my role and permissions here."),
    );
    return;
  }

  await respondUtility(
    interaction,
    utilityCard({
      color: embedColors.success,
      heading: `## ${emojis.success} Member Added\n${formatUser(user.id)} can now see and write in ${formatChannel(guild, channel.id)}.`,
      footer: actorFooter("Added", interaction.user.id),
      ephemeral: false,
    }),
  );

  await auditUtility(interaction, guild, {
    action: "updated",
    title: "Member added to channel",
    summary: `${formatUser(user.id)} was given access to ${formatChannel(guild, channel.id)}.`,
    groups: [{ lines: ["**Access** View · Send · History · Attach files"] }],
  });
}
