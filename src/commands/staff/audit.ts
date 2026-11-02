import type { GuildSettings, StaffInfo } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild, ModalSubmitInteraction } from "discord.js";
import { fact, publishAudit } from "../../lib/audit.js";
import { formatChannel, formatRole, formatUser } from "../../lib/formatters.js";
import { escapeDiscord } from "../room/labels.js";
import { staffFields, type StaffInput } from "./fields.js";

function fieldDetail(guild: Guild, staff: StaffInput, key: keyof StaffInput): string {
  const field = staffFields.find((entry) => entry.key === key);
  if (!field) {
    return `\`${key}\``;
  }
  const value = staff[key];
  if (!value) {
    return fact(field.label, "*Not configured*");
  }
  const mention = field.key.endsWith("RoleId") ? formatRole(guild, value) : formatChannel(guild, value);
  return fact(field.label, mention);
}

export async function auditStaffConfigMutation(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  action: "set" | "edit",
  staff: StaffInput,
  changedKeys: Array<keyof StaffInput>,
): Promise<void> {
  const details =
    action === "set"
      ? staffFields.map((field) => fieldDetail(guild, staff, field.key))
      : changedKeys.map((key) => fieldDetail(guild, staff, key));

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "serverConfig",
    action: action === "set" ? "created" : "updated",
    title: action === "set" ? "Staff setup configured" : "Staff setup edited",
    summary:
      action === "set"
        ? "Staff roles and coordination channels were set for the first time."
        : `**${details.length}** staff ${details.length === 1 ? "setting was" : "settings were"} changed.`,
    groups: [{ label: action === "set" ? "Staff setup" : "New values", lines: details }],
    actor: interaction.user,
  });
}

export async function auditStaffMembership(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  action: "recruit" | "fire",
  targetId: string,
  post: string,
  roleIds: string[],
): Promise<void> {
  const roleLines = roleIds.length > 0 ? roleIds.map((roleId) => formatRole(guild, roleId)) : ["*None*"];

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "staff",
    action: action === "recruit" ? "created" : "deleted",
    title: action === "recruit" ? "Staff recruited" : "Staff fired",
    summary:
      action === "recruit"
        ? `${formatUser(targetId)} joined the staff as **${post}**.`
        : `${formatUser(targetId)} was removed from **${post}**.`,
    groups: [{ label: action === "recruit" ? "Roles given" : "Roles removed", lines: roleLines, inline: true }],
    actor: interaction.user,
  });
}

export async function auditStaffInfo(
  interaction: ModalSubmitInteraction,
  guild: Guild,
  settings: GuildSettings,
  before: StaffInfo | null,
  after: StaffInfo,
): Promise<void> {
  const lines = before
    ? [
        before.gameId !== after.gameId ? fact("Game ID", `\`${before.gameId}\` → \`${after.gameId}\``) : "",
        before.gameName !== after.gameName
          ? fact("Game Name", `${escapeDiscord(before.gameName)} → ${escapeDiscord(after.gameName)}`)
          : "",
      ]
    : [fact("Game ID", `\`${after.gameId}\``), fact("Game Name", escapeDiscord(after.gameName))];

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "staff",
    action: before ? "updated" : "created",
    title: before ? "Staff info updated" : "Staff info registered",
    summary: before
      ? `${formatUser(after.userId)} changed their staff info.`
      : `${formatUser(after.userId)} registered their game ID and game name.`,
    groups: [
      { lines: [fact("Discord ID", `\`${after.userId}\``), fact("Discord Tag", escapeDiscord(after.discordTag))] },
      { label: before ? "Changes" : "Game info", lines },
    ],
    actor: interaction.user,
  });
}
