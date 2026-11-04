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
import { channelFields, roleFields, type StaffFieldKey, type StaffInput } from "./fields.js";

export type StaffPanelKind = "set" | "edit" | "view";

function stamp(): string {
  return `<t:${Math.floor(Date.now() / 1000)}:F>`;
}

/** `Judge Role` reads as `Judge` under the Roles heading; `Staff Announcements` as `Announcements` under Channels. */
function shortLabel(label: string): string {
  return label.replace(/ Role$/, "").replace(/^Staff (?!Chat)/, "");
}

function roleLine(guild: Guild, id: string | null, label: string, updated: boolean): string {
  const tag = updated ? " · *updated*" : "";
  if (!id) {
    return `**${label}** *not configured*${tag}`;
  }
  const mention = formatRole(guild, id);
  if (guild.roles.cache.has(id)) {
    return `**${label}** ${mention}${tag}`;
  }
  return `${emojis.error} **${label}** ${mention}${tag} · *missing from this server*`;
}

function channelLine(guild: Guild, id: string, label: string, updated: boolean): string {
  const tag = updated ? " · *updated*" : "";
  const mention = formatChannel(guild, id);
  if (guild.channels.cache.has(id)) {
    return `**${label}** ${mention}${tag}`;
  }
  return `${emojis.error} **${label}** ${mention}${tag} · *missing from this server*`;
}

function missingCount(guild: Guild, staff: StaffInput): number {
  const roles = roleFields.filter((field) => {
    const id = staff[field.key];
    return id != null && !guild.roles.cache.has(id);
  }).length;
  const channels = channelFields.filter((field) => !guild.channels.cache.has(staff[field.key])).length;
  return roles + channels;
}

type StaffPanelInput = {
  kind: StaffPanelKind;
  guild: Guild;
  staff: StaffInput;
  commandId?: string;
  settingsCommandId?: string;
  thumbnailUrl?: string;
  /** Keys `edit` rewrote; they get an *updated* tag. */
  changed?: readonly StaffFieldKey[];
  actorId: string;
};

function panelCopy(input: StaffPanelInput): { title: string; note: string; color: number } {
  if (input.kind === "set") {
    return {
      title: `${emojis.success} Staff Config Saved`,
      note: `Recruit, fire, and organiser checks now use these roles. The public schedules channel stays in ${formatHelpEntry("settings show", input.settingsCommandId)}.`,
      color: embedColors.success,
    };
  }
  if (input.kind === "edit") {
    const count = input.changed?.length ?? 0;
    return {
      title: `${emojis.success} Staff Config Updated`,
      note: `\`${count}\` ${count === 1 ? "value" : "values"} changed. The rest stayed as they were.`,
      color: embedColors.success,
    };
  }
  return {
    title: `${emojis.members} Current Staff Config`,
    note: "The staff roles and channels the bot uses in this server.",
    color: embedColors.info,
  };
}

export function buildStaffContainer(input: StaffPanelInput): ContainerBuilder {
  const { guild, staff } = input;
  const copy = panelCopy(input);
  const changed = new Set<string>(input.changed ?? []);
  const container = new ContainerBuilder().setAccentColor(copy.color);
  const heading = `## ${copy.title}`;

  if (input.thumbnailUrl && input.kind !== "view") {
    container.addSectionComponents(headingWithThumbnail(heading, input.thumbnailUrl, copy.note));
  } else {
    container.addTextDisplayComponents(textBlock(`${heading}\n${copy.note}`));
  }
  const missing = missingCount(guild, staff);
  if (missing > 0) {
    container.addTextDisplayComponents(
      textBlock(
        `${emojis.alert} **${missing}** ${missing === 1 ? "value points" : "values point"} to something that is no longer in this server.`,
      ),
    );
  }

  const roles = roleFields.map((field) =>
    roleLine(guild, staff[field.key], shortLabel(field.label), changed.has(field.key)),
  );
  const channels = channelFields.map((field) =>
    channelLine(guild, staff[field.key], shortLabel(field.label), changed.has(field.key)),
  );
  const footer =
    input.kind === "view"
      ? `-# Change a role or channel with ${formatHelpEntry("staff config edit", input.commandId)}`
      : `-# ${input.kind === "set" ? "Saved" : "Updated"} by ${formatUser(input.actorId)} · ${stamp()}`;

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock([`### ${emojis.gem} Roles`, ...roles].join("\n")),
      textBlock([`### ${emojis.textChannel} Channels`, ...channels].join("\n")),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(footer));
}

export function staffConfigMessage(input: StaffPanelInput): InteractionReplyOptions {
  return {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [buildStaffContainer(input)],
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
  actorId: string;
  /** `Judge`, `Recorder`…; null when every staff role was removed. */
  position: string | null;
  roleIds: string[];
  guild: Guild;
  thumbnailUrl?: string;
  /** Recruit only: where the welcome went, or why it did not. */
  welcome?: { channelId: string } | { problem: string };
}): InteractionReplyOptions {
  const recruit = input.kind === "recruit";
  const who = formatUser(input.targetId);
  const title = recruit ? `## ${emojis.success} Staff Recruited` : `## ${emojis.error} Staff Removed`;
  const summary = recruit
    ? `${who} is now **${input.position}**.`
    : input.position
      ? `${who} is no longer **${input.position}**.`
      : `${who} is no longer on the staff.`;
  const roles = input.roleIds.map((id) => formatRole(input.guild, id)).join(" ");
  const details = [`${emojis.gem} **${recruit ? "Roles granted" : "Roles removed"}** ${roles}`];
  if (input.welcome && "channelId" in input.welcome) {
    details.push(`${emojis.party} Welcome posted in ${formatChannel(input.guild, input.welcome.channelId)}`);
  } else if (input.welcome) {
    details.push(`${emojis.alert} *${input.welcome.problem}*`);
  }

  const container = new ContainerBuilder().setAccentColor(recruit ? embedColors.success : embedColors.error);
  const head = `${title}\n${summary}`;
  if (input.thumbnailUrl) {
    container.addSectionComponents(headingWithThumbnail(head, input.thumbnailUrl, details.join("\n")));
  } else {
    container.addTextDisplayComponents(textBlock(head), textBlock(details.join("\n")));
  }

  return {
    flags: v2Flags,
    allowedMentions: { parse: [], users: [input.targetId], roles: [] },
    components: [
      container
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(
          textBlock(`-# ${recruit ? "Recruited" : "Removed"} by ${formatUser(input.actorId)} · ${stamp()}`),
        ),
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
  const roles = input.roleIds.map((id) => formatRole(input.guild, id)).join(" ");
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addSectionComponents(
      headingWithThumbnail(
        `## ${emojis.party} Welcome to the Family\n${formatMember(input.target)} joins the staff as **${input.postLabel}**.`,
        input.target.displayAvatarURL({ size: 256 }),
        `${emojis.gem} **Roles** ${roles}`,
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [
          "**Start here**",
          `${emojis.textChannel} **Announcements** ${formatChannel(input.guild, input.staff.staffAnnouncementChannelId)}`,
          `${emojis.rules} **Rules** ${formatChannel(input.guild, input.staff.staffRulesChannelId)}`,
          `${emojis.info} **Details** ${formatChannel(input.guild, input.staff.staffDetailsChannelId)}`,
        ].join("\n"),
      ),
    );

  return {
    flags: v2Flags,
    allowedMentions: { parse: [], users: [input.target.id] },
    components: [container],
  };
}
