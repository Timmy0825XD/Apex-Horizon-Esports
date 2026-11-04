import {
  ContainerBuilder,
  MessageFlags,
  type Guild,
  type InteractionReplyOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatChannel, formatHelpEntry, formatRole, formatUser } from "../../lib/formatters.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { channelFields, roleFields, type SettingFieldKey, type SettingsInput } from "./fields.js";

export type SettingsPanelKind = "set" | "edit" | "show";

type PanelInput = {
  kind: SettingsPanelKind;
  guild: Guild;
  settings: SettingsInput;
  commandId?: string;
  /** Keys `edit` rewrote; they get an *updated* tag. */
  changed?: readonly SettingFieldKey[];
  actorId: string;
};

function entityExists(guild: Guild, kind: "role" | "channel", id: string): boolean {
  return kind === "role" ? guild.roles.cache.has(id) : guild.channels.cache.has(id);
}

function entityLine(guild: Guild, kind: "role" | "channel", id: string, label: string, updated: boolean): string {
  const mention = kind === "role" ? formatRole(guild, id) : formatChannel(guild, id);
  const tag = updated ? " · *updated*" : "";
  if (entityExists(guild, kind, id)) {
    return `**${label}** ${mention}${tag}`;
  }
  return `${emojis.error} **${label}** ${mention}${tag} · *missing from this server*`;
}

/** `Schedules Channel` reads as `Schedules` under the Channels heading. */
function shortLabel(label: string): string {
  return label.replace(/ Channel$/, "");
}

function missingCount(guild: Guild, settings: SettingsInput): number {
  return (
    roleFields.filter((field) => !entityExists(guild, "role", settings[field.key])).length +
    channelFields.filter((field) => !entityExists(guild, "channel", settings[field.key])).length
  );
}

function panelCopy(input: PanelInput): { title: string; note: string; color: number } {
  if (input.kind === "set") {
    return {
      title: `${emojis.success} Server Settings Saved`,
      note: "Audit, schedules, thumbnails, and bans now point at these roles and channels.",
      color: embedColors.success,
    };
  }
  if (input.kind === "edit") {
    const count = input.changed?.length ?? 0;
    return {
      title: `${emojis.success} Server Settings Updated`,
      note: `\`${count}\` ${count === 1 ? "value" : "values"} changed. The rest stayed as they were.`,
      color: embedColors.success,
    };
  }
  return {
    title: `${emojis.settings} Current Settings`,
    note: "The roles and channels the bot uses in this server.",
    color: embedColors.info,
  };
}

export function buildSettingsContainer(input: PanelInput): ContainerBuilder {
  const { guild, settings } = input;
  const copy = panelCopy(input);
  const changed = new Set<string>(input.changed ?? []);
  const header = [`## ${copy.title}\n${copy.note}`];
  const missing = missingCount(guild, settings);
  if (missing > 0) {
    header.push(
      `${emojis.alert} **${missing}** ${missing === 1 ? "value points" : "values point"} to something that is no longer in this server.`,
    );
  }
  const roles = roleFields.map((field) =>
    entityLine(guild, "role", settings[field.key], field.label, changed.has(field.key)),
  );
  const channels = channelFields.map((field) =>
    entityLine(guild, "channel", settings[field.key], shortLabel(field.label), changed.has(field.key)),
  );
  const footer =
    input.kind === "show"
      ? `-# Change a role or channel with ${formatHelpEntry("settings edit", input.commandId)}`
      : `-# ${input.kind === "set" ? "Saved" : "Updated"} by ${formatUser(input.actorId)} · <t:${Math.floor(Date.now() / 1000)}:F>`;

  return new ContainerBuilder()
    .setAccentColor(copy.color)
    .addTextDisplayComponents(...header.map((block) => textBlock(block)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock([`### ${emojis.gem} Roles`, ...roles].join("\n")),
      textBlock([`### ${emojis.textChannel} Channels`, ...channels].join("\n")),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(footer));
}

export function settingsMessage(input: PanelInput): InteractionReplyOptions {
  return {
    flags: v2Flags,
    components: [buildSettingsContainer(input)],
    allowedMentions: { parse: [] },
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
