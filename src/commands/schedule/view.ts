import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { escapeDiscord, roundLabel } from "../room/labels.js";

export type ScheduleFace = {
  tournamentName: string;
  leftName: string;
  rightName: string;
  round: number;
  group: string | null;
  when: Date;
  judgeId: string | null;
  recorderId: string | null;
  remark: string | null;
  matchId: number;
  channelId: string;
  imageUrl?: string;
  captain1Id?: string | null;
  captain2Id?: string | null;
  creatorName?: string | null;
  createdAt?: Date | null;
  alert?: ScheduleAlertFace | null;
};

export type ScheduleAlertFace = {
  raisedAt: Date;
  judgeFailedId: string | null;
  judgeVacant: boolean;
  recorderFailedId: string | null;
  recorderVacant: boolean;
};

const LIVE_PREFIX = "schedule:";

export function claimCustomId(seat: "judge" | "recorder", scheduleId: string): string {
  return `${LIVE_PREFIX}claim:${seat}:${scheduleId}`;
}

export function confirmCustomId(seat: "judge" | "recorder", scheduleId: string): string {
  return `${LIVE_PREFIX}confirm:${seat}:${scheduleId}`;
}

export function parseScheduleButton(customId: string): { action: "claim" | "confirm"; seat: "judge" | "recorder"; scheduleId: string } | null {
  const parts = customId.split(":");
  if (parts.length !== 4 || parts[0] !== "schedule") {
    return null;
  }
  const action = parts[1];
  const seat = parts[2];
  const scheduleId = parts[3];
  if ((action !== "claim" && action !== "confirm") || (seat !== "judge" && seat !== "recorder") || !scheduleId) {
    return null;
  }
  return { action, seat, scheduleId };
}

function utcStamp(when: Date): string {
  const day = String(when.getUTCDate()).padStart(2, "0");
  const month = String(when.getUTCMonth() + 1).padStart(2, "0");
  const hour = String(when.getUTCHours()).padStart(2, "0");
  const minute = String(when.getUTCMinutes()).padStart(2, "0");
  return `${day}-${month}-${when.getUTCFullYear()} ${hour}:${minute} UTC`;
}

function person(id: string | null | undefined): string {
  return id ? formatUser(id) : "*Unassigned*";
}

export function scheduleEmbed(face: ScheduleFace): EmbedBuilder {
  const unix = Math.floor(face.when.getTime() / 1000);
  const lines = [
    `**UTC Time:** ${utcStamp(face.when)}`,
    `**Local Time:** <t:${unix}:F> (<t:${unix}:R>)`,
    "",
    `${emojis.torneo} **Tournament:** ${escapeDiscord(face.tournamentName)}`,
  ];
  if (face.group) {
    lines.push(`${emojis.challonge} **Group:** ${escapeDiscord(face.group)}`);
  }
  lines.push(
    `${emojis.challonge} **Round:** ${roundLabel(face.round)}`,
    "",
    `${emojis.textChannel} **Channel:** ${formatChannel(null, face.channelId)}`,
    "",
    `**Captain 1:** ${person(face.captain1Id)}`,
    `**Captain 2:** ${person(face.captain2Id)}`,
    "",
    "**Staffs:**",
    `${emojis.judge} **Judge:** ${face.judgeId ? formatUser(face.judgeId) : ""}`,
    `${emojis.recorder} **Recorder:** ${face.recorderId ? formatUser(face.recorderId) : ""}`,
  );
  if (face.remark) {
    lines.push("", `**Remark:** ${escapeDiscord(face.remark)}`);
  }
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`${emojis.torneo} ${face.leftName.toUpperCase()} ${emojis.vs} ${face.rightName.toUpperCase()}`)
    .setDescription(lines.join("\n"));
  if (face.creatorName) {
    embed.setFooter({ text: `Created by ${face.creatorName}` });
    if (face.createdAt) {
      embed.setTimestamp(face.createdAt);
    }
  } else if (face.createdAt) {
    embed.setTimestamp(face.createdAt);
  }
  if (face.imageUrl) {
    embed.setImage(face.imageUrl);
  }
  return embed;
}

function seatButton(scheduleId: string, seat: "judge" | "recorder", userId: string | null, emoji: string, unlocked: boolean): ButtonBuilder {
  const open = !userId && unlocked;
  return new ButtonBuilder()
    .setCustomId(claimCustomId(seat, scheduleId))
    .setLabel(userId ? "Assigned" : "Assign")
    .setEmoji(customEmoji(emoji))
    .setStyle(ButtonStyle.Success)
    .setDisabled(!open);
}

export function claimRow(scheduleId: string, judgeId: string | null, recorderId: string | null, unlocked: boolean): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    seatButton(scheduleId, "judge", judgeId, emojis.judge, unlocked),
    seatButton(scheduleId, "recorder", recorderId, emojis.recorder, unlocked),
  );
}

export function claimsAreOpen(until: Date | null | undefined, now = new Date()): boolean {
  return Boolean(until && until.getTime() > now.getTime());
}

export function confirmRow(scheduleId: string, judgeId: string | null, recorderId: string | null, judgeConfirmed: boolean, recorderConfirmed: boolean): ActionRowBuilder<ButtonBuilder> | null {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (judgeId) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(confirmCustomId("judge", scheduleId))
        .setLabel(judgeConfirmed ? "Confirmed" : "Present")
        .setEmoji(customEmoji(emojis.judge))
        .setStyle(judgeConfirmed ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(judgeConfirmed),
    );
  }
  if (recorderId) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(confirmCustomId("recorder", scheduleId))
        .setLabel(recorderConfirmed ? "Confirmed" : "Present")
        .setEmoji(customEmoji(emojis.recorder))
        .setStyle(recorderConfirmed ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(recorderConfirmed),
    );
  }
  return row.components.length > 0 ? row : null;
}

export function urgentScheduleEmbed(face: ScheduleFace): EmbedBuilder {
  const embed = scheduleEmbed(face).setColor(embedColors.error);
  if (!face.alert) {
    return embed;
  }
  const lines = embed.data.description?.split("\n") ?? [];
  const urgent = ["", `${emojis.alert} **URGENT: Staff Replacement Needed!**`, "", "Match starts in 2 minutes!", ""];
  if (face.alert.judgeFailedId) {
    urgent.push(`${emojis.judge} ${formatUser(face.alert.judgeFailedId)} Failed to confirm presence.`);
  } else if (face.alert.judgeVacant) {
    urgent.push(`${emojis.judge} Failed to confirm presence.`);
  }
  if (face.alert.recorderFailedId) {
    urgent.push(`${emojis.recorder} ${formatUser(face.alert.recorderFailedId)} Failed to confirm presence.`);
  } else if (face.alert.recorderVacant) {
    urgent.push(`${emojis.recorder} Failed to confirm presence.`);
  }
  urgent.push("");
  const staffAt = lines.findIndex((line) => line === "**Staffs:**");
  if (staffAt >= 0) {
    lines.splice(staffAt, 0, ...urgent);
  } else {
    lines.push(...urgent);
  }
  return embed
    .setDescription(lines.join("\n"))
    .setFooter({ text: "IMMEDIATE ACTION REQUIRED - Match starts in 2 minutes" })
    .setTimestamp(face.alert.raisedAt);
}

export function reminderScheduleEmbed(face: ScheduleFace, postedAt = new Date()): EmbedBuilder {
  return scheduleEmbed(face)
    .setFooter({ text: "Staff Confirmation Required | Confirm before the 2-minute staff check" })
    .setTimestamp(postedAt);
}

export function resultsEmbed(input: {
  face: ScheduleFace;
  team1Score: number;
  team2Score: number;
  notes: string | null;
  links: string[];
  declaredAt: Date;
  uploadedBy: string;
  transcriptUrl?: string | null;
}): EmbedBuilder {
  const card = scheduleEmbed({ ...input.face, when: input.declaredAt, remark: null, creatorName: null, createdAt: null });
  const description = (card.data.description ?? "")
    .replace("**UTC Time:**", "**Result UTC Time:**")
    .replace("**Local Time:**", "**Result Local Time:**");
  const lines = [description, "", "**Results:**", resultLine(input.face, input.team1Score, input.team2Score)];
  if (input.notes) {
    lines.push("", `**Remarks:** ${escapeDiscord(input.notes)}`);
  }
  const links = linkLine(input.links);
  if (links) {
    lines.push("", "**Links:**", links);
  }
  const embed = card
    .setColor(embedColors.success)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `Uploaded by ${input.uploadedBy}` })
    .setTimestamp(input.declaredAt);
  if (input.transcriptUrl) {
    embed.setURL(input.transcriptUrl);
  }
  return embed;
}

function resultLine(face: ScheduleFace, team1Score: number, team2Score: number): string {
  const left = `**${escapeDiscord(face.leftName.toUpperCase())}**`;
  const right = `**${escapeDiscord(face.rightName.toUpperCase())}**`;
  const leftName = team1Score > team2Score ? `${emojis.torneo} ${left}` : left;
  const rightName = team2Score > team1Score ? `${emojis.torneo} ${right}` : right;
  return `${leftName} \`${team1Score}\` ${emojis.vs} \`${team2Score}\` ${rightName}`;
}

function linkLine(links: string[]): string | null {
  const usable = links.map((link) => link.trim()).filter((link) => /^https?:\/\//i.test(link));
  if (usable.length === 0) {
    return null;
  }
  return usable.map((link, index) => `[Link ${index + 1}](${link})`).join(" ");
}
