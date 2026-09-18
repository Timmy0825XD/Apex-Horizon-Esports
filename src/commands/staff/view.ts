import {
  ContainerBuilder,
  MessageFlags,
  type Guild,
  type GuildMember,
  type InteractionReplyOptions,
  type MessageCreateOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatChannel, formatHelpEntry, formatMember, formatRole, formatUser } from "../../lib/formatters.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { channelFields, roleFields, type StaffInput } from "./fields.js";

export type StaffPanelKind = "set" | "edit" | "view";

function roleLine(guild: Guild, id: string | null, label: string): string {
  if (!id) {
    return `> **${label}:** *Not configured*`;
  }
  const mention = formatRole(guild, id);
  if (guild.roles.cache.has(id)) {
    return `> **${label}:** ${mention}`;
  }
  return `${emojis.error} **${label}:** ${mention} *Missing from this server*`;
}

function channelLine(guild: Guild, id: string, label: string): string {
  const mention = formatChannel(guild, id);
  if (guild.channels.cache.has(id)) {
    return `> **${label}:** ${mention}`;
  }
  return `${emojis.error} **${label}:** ${mention} *Missing from this server*`;
}

function staffBody(guild: Guild, staff: StaffInput): string[] {
  const roles = roleFields.map((field) => roleLine(guild, staff[field.key], field.label));
  const channels = channelFields.map((field) => channelLine(guild, staff[field.key], field.label));
  return [
    `## ${emojis.members} Roles`,
    roles.join("\n"),
    `## ${emojis.textChannel} Channels`,
    channels.join("\n"),
  ];
}

function panelCopy(
  kind: StaffPanelKind,
  commandId?: string,
): { title: string; note: string; color: number } {
  if (kind === "set") {
    return {
      title: `${emojis.success} Staff hierarchy saved`,
      note: `Recruit, fire, and organiser checks now use these roles. The public schedules channel stays in ${formatHelpEntry("settings show", commandId)}.`,
      color: embedColors.success,
    };
  }
  if (kind === "edit") {
    return {
      title: `${emojis.success} Staff hierarchy updated`,
      note: `Only the values you changed were rewritten. Recruit packages and organiser access follow this config.`,
      color: embedColors.success,
    };
  }
  return {
    title: `${emojis.members} Current staff configuration`,
    note: `Use ${formatHelpEntry("staff config edit", commandId)} to change a role or channel.`,
    color: embedColors.info,
  };
}

export function buildStaffContainer(
  kind: StaffPanelKind,
  guild: Guild,
  staff: StaffInput,
  commandId?: string,
  settingsCommandId?: string,
  thumbnailUrl?: string,
): ContainerBuilder {
  const copy = panelCopy(kind, kind === "set" ? settingsCommandId : commandId);
  const container = new ContainerBuilder().setAccentColor(copy.color);

  if (thumbnailUrl && (kind === "set" || kind === "edit")) {
    container.addSectionComponents(headingWithThumbnail(`# ${copy.title}`, thumbnailUrl, copy.note));
  } else {
    container.addTextDisplayComponents(textBlock(`# ${copy.title}`), textBlock(copy.note));
  }

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(staffBody(guild, staff).join("\n\n")));
}

export function staffConfigMessage(
  kind: StaffPanelKind,
  guild: Guild,
  staff: StaffInput,
  commandId?: string,
  settingsCommandId?: string,
  thumbnailUrl?: string,
): InteractionReplyOptions {
  return {
    flags: v2Flags,
    components: [buildStaffContainer(kind, guild, staff, commandId, settingsCommandId, thumbnailUrl)],
  };
}

export function staffErrorMessage(
  title: string,
  description: string,
  ephemeral = true,
): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(textBlock(`# ${emojis.error} ${title}`), textBlock(description)),
    ],
  };
}

export function staffMembershipMessage(input: {
  kind: "recruit" | "fire";
  targetId: string;
  actorName: string;
  position: string;
  roles: string;
  thumbnailUrl?: string;
  note?: string;
}): InteractionReplyOptions {
  const recruit = input.kind === "recruit";
  const title = recruit ? "Staff Recruitment Updated" : "Staff Removal Updated";
  const positionLabel = recruit ? "Granted Position" : "Removed Position";
  const rolesLabel = recruit ? "Roles Granted" : "Roles Removed";
  const body = [
    `**Target**\n${formatUser(input.targetId)}`,
    `**${positionLabel}**\n${input.position}`,
    `**${rolesLabel}**\n${input.roles}`,
  ];
  if (input.note) {
    body.push(`*${input.note}*`);
  }

  const container = new ContainerBuilder().setAccentColor(recruit ? embedColors.success : embedColors.error);
  if (input.thumbnailUrl) {
    container.addSectionComponents(headingWithThumbnail(`# ${emojis.success} ${title}`, input.thumbnailUrl));
  } else {
    container.addTextDisplayComponents(textBlock(`# ${emojis.success} ${title}`));
  }

  return {
    flags: v2Flags,
    allowedMentions: { parse: [], users: [input.targetId], roles: [] },
    components: [
      container
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(body.join("\n\n")))
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(`-# Action by ${input.actorName}`)),
    ],
  };
}

export function staffWelcomeMessage(input: {
  guild: Guild;
  staff: StaffInput;
  target: GuildMember;
  postLabel: string;
  roleIds: string[];
}): MessageCreateOptions {
  const roles = input.roleIds.map((id) => formatRole(input.guild, id)).join("\n");
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(
      textBlock(`${emojis.party} Welcome to the family ${formatMember(input.target)}.`),
    )
    .addSeparatorComponents(divider())
    .addSectionComponents(
      headingWithThumbnail(
        `# ${emojis.members} New ${input.postLabel}`,
        input.target.displayAvatarURL({ size: 256 }),
      ),
    )
    .addTextDisplayComponents(
      textBlock(
        [
          `**Roles granted:**\n${roles}`,
          `**Announcements:** ${formatChannel(input.guild, input.staff.staffAnnouncementChannelId)}`,
          `**Rules:** ${formatChannel(input.guild, input.staff.staffRulesChannelId)}`,
          `**Details:** ${formatChannel(input.guild, input.staff.staffDetailsChannelId)}`,
        ].join("\n\n"),
      ),
    );

  return {
    flags: v2Flags,
    allowedMentions: { parse: [], users: [input.target.id] },
    components: [container],
  };
}
