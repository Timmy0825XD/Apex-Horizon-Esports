import {
  ContainerBuilder,
  MessageFlags,
  type Guild,
  type InteractionReplyOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatChannel, formatHelpEntry, formatRole } from "../../lib/formatters.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { channelFields, roleFields, type SettingsInput } from "./fields.js";

export type SettingsPanelKind = "set" | "edit" | "show";

function entityLine(
  guild: Guild,
  kind: "role" | "channel",
  id: string,
  label: string,
): string {
  const exists = kind === "role" ? guild.roles.cache.has(id) : guild.channels.cache.has(id);
  const mention = kind === "role" ? formatRole(guild, id) : formatChannel(guild, id);
  if (exists) {
    return `${emojis.info} **${label}:** ${mention}`;
  }
  return `${emojis.error} **${label}:** ${mention} *Missing from this server*`;
}

function settingsBody(guild: Guild, settings: SettingsInput): string[] {
  const roles = roleFields.map((field) => entityLine(guild, "role", settings[field.key], field.label));
  const channels = channelFields.map((field) =>
    entityLine(guild, "channel", settings[field.key], field.label),
  );
  return [
    `## ${emojis.settings} Roles`,
    roles.join("\n"),
    `## ${emojis.settings} Channels`,
    channels.join("\n"),
  ];
}

function panelCopy(
  kind: SettingsPanelKind,
  commandId?: string,
): { title: string; note: string; color: number } {
  if (kind === "set") {
    return {
      title: `${emojis.success} Server settings saved`,
      note: `Audit, schedules, thumbnails, and bans now point at these roles and channels.`,
      color: embedColors.success,
    };
  }
  if (kind === "edit") {
    return {
      title: `${emojis.success} Server settings updated`,
      note: `Only the values you changed were rewritten. The rest stayed as they were.`,
      color: embedColors.success,
    };
  }
  return {
    title: `${emojis.settings} Current bot settings`,
    note: `Use ${formatHelpEntry("settings edit", commandId)} to change a role or channel.`,
    color: embedColors.info,
  };
}

export function buildSettingsContainer(
  kind: SettingsPanelKind,
  guild: Guild,
  settings: SettingsInput,
  commandId?: string,
): ContainerBuilder {
  const copy = panelCopy(kind, commandId);
  return new ContainerBuilder()
    .setAccentColor(copy.color)
    .addTextDisplayComponents(textBlock(`# ${copy.title}`), textBlock(copy.note))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(settingsBody(guild, settings).join("\n\n")));
}

export function settingsMessage(
  kind: SettingsPanelKind,
  guild: Guild,
  settings: SettingsInput,
  commandId?: string,
): InteractionReplyOptions {
  return {
    flags: v2Flags,
    components: [buildSettingsContainer(kind, guild, settings, commandId)],
  };
}

export function settingsErrorMessage(
  title: string,
  description: string,
  ephemeral = true,
): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.error} ${title}`),
          textBlock(description),
        ),
    ],
  };
}
