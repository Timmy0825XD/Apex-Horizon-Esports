import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { escapeDiscord, roundLabel, scoreLine } from "../room/labels.js";
import { textBlock, v2Flags } from "../../lib/v2.js";
import {
  channelUrl,
  linkButton,
  matchEyebrow,
  matchName,
  quote,
  scheduleCard,
  seatEmoji,
  seatName,
  shortUtc,
  stampFooter,
  toneColor,
  type CardBlock,
} from "./respond.js";

/** Yellow accent of the schedule post, kept from the embed it replaced. */
const SCHEDULE_YELLOW = 0xf1c40f;

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
  creatorId?: string | null;
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

/** Who holds a seat in a staff block: the member and whether they confirmed. */
function staffState(seat: "judge" | "recorder", userId: string | null, state: "confirmed" | "waiting" | "failed" | null): string {
  const holder = userId ? formatUser(userId) : "*Open*";
  const note = state === "confirmed" ? " · confirmed" : state === "waiting" ? " · *waiting*" : state === "failed" ? " · **did not confirm**" : "";
  return `${seatEmoji(seat)} ${seatName(seat)} · ${holder}${note}`;
}

/** Captains and assigned staff, pinged by the T-10 reminder. */
export function reminderMentions(face: ScheduleFace, seats: { judgeId: string | null; recorderId: string | null }): string[] {
  return [...new Set([face.captain1Id, face.captain2Id, seats.judgeId, seats.recorderId].filter((id): id is string => Boolean(id)))];
}

type CardMessage = { components: (TextDisplayBuilder | ContainerBuilder)[]; flags: typeof v2Flags };

/**
 * T-10 reminder in the ticket: mentions outside the card (so they ping), then a short match summary,
 * the rules channel and a staff check with the Present buttons.
 */
export function reminderPayload(input: {
  face: ScheduleFace;
  scheduleId: string;
  confirmations: { judge: boolean; recorder: boolean };
  rulesChannelId: string;
  mentionIds: string[];
}): CardMessage {
  const { face, confirmations } = input;
  const unix = Math.floor(face.when.getTime() / 1000);
  const staff = ["### Staff check"];
  if (face.judgeId) staff.push(staffState("judge", face.judgeId, confirmations.judge ? "confirmed" : "waiting"));
  if (face.recorderId) staff.push(staffState("recorder", face.recorderId, confirmations.recorder ? "confirmed" : "waiting"));
  const blocks: CardBlock[] = [
    `${matchName(face.leftName, face.rightName)} · \`${shortUtc(face.when)}\` · <t:${unix}:t> your time`,
    `Read and follow the rules in ${formatChannel(null, input.rulesChannelId)} before you start.`,
    "divider",
    staff.join("\n"),
  ];
  const row = confirmRow(input.scheduleId, face.judgeId, face.recorderId, confirmations.judge, confirmations.recorder);
  if (row) blocks.push(row);
  const card = scheduleCard({
    tone: "pending",
    emoji: emojis.uptime,
    eyebrow: matchEyebrow(face.tournamentName, face),
    title: `Match starts <t:${unix}:R>`,
    blocks,
    footer: "Confirm before the 2-minute staff check, or the seat opens for someone else.",
  });
  const mentions = input.mentionIds.map((id) => formatUser(id)).join(" ");
  return { components: mentions ? [textBlock(mentions), card] : [card], flags: v2Flags };
}

/** T-2 urgent post in the schedules channel: role pings outside the card, the missing seats and Assign. */
export function urgentPayload(input: { face: ScheduleFace; scheduleId: string; unlocked: boolean; roleIds: string[] }): CardMessage {
  const { face } = input;
  const unix = Math.floor(face.when.getTime() / 1000);
  const alert = face.alert;
  const judge = alert?.judgeFailedId
    ? staffState("judge", alert.judgeFailedId, "failed")
    : staffState("judge", face.judgeId, face.judgeId ? "confirmed" : null);
  const recorder = alert?.recorderFailedId
    ? staffState("recorder", alert.recorderFailedId, "failed")
    : staffState("recorder", face.recorderId, face.recorderId ? "confirmed" : null);
  const raisedAt = Math.floor((alert?.raisedAt ?? new Date()).getTime() / 1000);
  const card = scheduleCard({
    tone: "danger",
    emoji: emojis.alert,
    eyebrow: matchEyebrow(face.tournamentName, face),
    title: "Urgent Staff Replacement",
    blocks: [
      `${matchName(face.leftName, face.rightName)} starts **<t:${unix}:R>** · ${formatChannel(null, face.channelId)}`,
      "divider",
      ["### Missing", judge, recorder].join("\n"),
      claimRow(input.scheduleId, face.judgeId, face.recorderId, input.unlocked),
    ],
    footer: `Assign stays open for 10 minutes · raised <t:${raisedAt}:f>`,
  });
  const mentions = input.roleIds.map((id) => `<@&${id}>`).join(" ");
  return { components: mentions ? [textBlock(mentions), card] : [card], flags: v2Flags };
}

function isHttps(url: string | null | undefined): url is string {
  return Boolean(url && /^https:\/\//i.test(url.trim()));
}

function timeLine(when: Date, prefix = ""): string {
  const unix = Math.floor(when.getTime() / 1000);
  return `${prefix}**${utcStamp(when).replace(/-/g, "/")}** · <t:${unix}:F> (<t:${unix}:R>)`;
}

function postTitle(face: ScheduleFace, trophy: boolean): string {
  return `${trophy ? `${emojis.torneo} ` : ""}${escapeDiscord(face.leftName)} ${emojis.vs} ${escapeDiscord(face.rightName)}`;
}

function staffBlock(face: ScheduleFace): string {
  return [
    "### Staff",
    `${seatEmoji("judge")} Judge · ${face.judgeId ? formatUser(face.judgeId) : "*Open*"}`,
    `${seatEmoji("recorder")} Recorder · ${face.recorderId ? formatUser(face.recorderId) : "*Open*"}`,
  ].join("\n");
}

function creatorFooter(face: ScheduleFace): string | null {
  if (!face.creatorId) {
    return null;
  }
  const at = face.createdAt ? ` · <t:${Math.floor(face.createdAt.getTime() / 1000)}:f>` : "";
  return `Created by ${formatUser(face.creatorId)}${at}`;
}

/** Users named on the first line of a schedule post: the captains, plus the staff when asked. */
export function postMentionIds(face: ScheduleFace, includeStaff: boolean): string[] {
  const ids = [face.captain1Id, face.captain2Id, ...(includeStaff ? [face.judgeId, face.recorderId] : [])];
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/**
 * The schedule post in the battle ticket. The first line names the captains (and the staff on an update)
 * so the ping works; the card repeats the captains next to their team.
 */
export function ticketPostPayload(face: ScheduleFace, mentionIds: string[]): CardMessage {
  const captain = (id: string | null | undefined, team: string) =>
    `${emojis.captains} ${id ? formatUser(id) : "*Unknown*"} · **${escapeDiscord(team)}**`;
  const blocks: CardBlock[] = [timeLine(face.when), { gallery: isHttps(face.imageUrl) ? [face.imageUrl] : [] }, "divider"];
  blocks.push(["### Captains", captain(face.captain1Id, face.leftName), captain(face.captain2Id, face.rightName)].join("\n"));
  blocks.push(staffBlock(face));
  if (face.remark) {
    blocks.push(quote(face.remark));
  }
  const card = scheduleCard({
    tone: "pending",
    emoji: "",
    eyebrow: matchEyebrow(face.tournamentName, face),
    title: postTitle(face, true),
    blocks,
    footer: creatorFooter(face),
  });
  card.setAccentColor(SCHEDULE_YELLOW);
  const mentions = mentionIds.map((id) => formatUser(id)).join(" ");
  return { components: mentions ? [textBlock(mentions), card] : [card], flags: v2Flags };
}

/** The schedule post in the schedules channel: captains named without a ping, Assign and the ticket link inside. */
export function boardPostPayload(input: {
  face: ScheduleFace;
  guildId: string;
  scheduleId: string;
  unlocked: boolean;
  openUntil: Date | null;
}): CardMessage {
  const { face } = input;
  const row = claimRow(input.scheduleId, face.judgeId, face.recorderId, input.unlocked).addComponents(
    linkButton("Open ticket", channelUrl(input.guildId, face.channelId)),
  );
  const footer = [
    input.unlocked && input.openUntil ? `Assign is open until <t:${Math.floor(input.openUntil.getTime() / 1000)}:t>` : null,
    creatorFooter(face),
  ].filter(Boolean);
  const blocks: CardBlock[] = [timeLine(face.when), { gallery: isHttps(face.imageUrl) ? [face.imageUrl] : [] }, "divider", staffBlock(face)];
  if (face.remark) {
    blocks.push(quote(face.remark));
  }
  blocks.push(row);
  const card = scheduleCard({
    tone: "pending",
    emoji: "",
    eyebrow: matchEyebrow(face.tournamentName, face),
    title: postTitle(face, true),
    blocks,
    footer: footer.length ? footer.join(" · ") : null,
  });
  card.setAccentColor(SCHEDULE_YELLOW);
  const mentions = postMentionIds(face, false).map((id) => formatUser(id)).join(" ");
  return { components: mentions ? [textBlock(mentions), card] : [card], flags: v2Flags };
}

/**
 * The result declaration. In the ticket the first line is **Match Complete!** with the captains (it pings);
 * the result channel gets the same card without that line. Proofs are attachments shown in a gallery.
 */
export function resultsPayload(input: {
  face: ScheduleFace;
  team1Score: number;
  team2Score: number;
  notes: string | null;
  links: string[];
  declaredAt: Date;
  uploadedById: string | null;
  transcriptUrl: string | null;
  /** Gallery sources: `attachment://proof-1.png` for files in the same request. */
  gallery: string[];
  intro: boolean;
}): CardMessage {
  const { face } = input;
  const blocks: CardBlock[] = [
    timeLine(input.declaredAt, "Result "),
    "divider",
    `### Result\n${scoreLine(face.leftName, face.rightName, input.team1Score, input.team2Score)}`,
  ];
  if (input.notes) {
    blocks.push(quote(input.notes));
  }
  blocks.push("divider", staffBlock(face), { gallery: input.gallery });
  const buttons = input.links.filter(isHttps).map((url, index) => linkButton(`Recording ${index + 1}`, url.trim()));
  for (let index = 0; index < buttons.length; index += 5) {
    blocks.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(index, index + 5)));
  }
  const card = scheduleCard({
    tone: "success",
    emoji: "",
    eyebrow: matchEyebrow(face.tournamentName, face),
    // The transcript has no button: the title itself links to the transcript message.
    title: isHttps(input.transcriptUrl)
      ? `[${postTitle(face, false).replace(/[[\]]/g, "\\$&")}](${input.transcriptUrl.trim()})`
      : postTitle(face, false),
    blocks,
    footer: input.uploadedById ? stampFooter("Uploaded", input.uploadedById, input.declaredAt) : null,
  });
  if (!input.intro) {
    return { components: [card], flags: v2Flags };
  }
  const captains = postMentionIds(face, false).map((id) => formatUser(id)).join(" ");
  return { components: [textBlock(`${emojis.torneo} **Match Complete!**${captains ? ` ${captains}` : ""}`), card], flags: v2Flags };
}

/** Direct GIF of the New Schedule alert (a Tenor page link cannot be a thumbnail). */
const NEW_SCHEDULE_GIF = "https://media.tenor.com/a7v_DiKrkeoAAAAC/check-schedule.gif";

/** New Schedule alert in the staff chat: pings the roles of the open seats above the card. */
export function newSchedulePayload(input: { face: ScheduleFace; roleIds: string[]; openSeats: ("judge" | "recorder")[]; boardUrl: string }): CardMessage {
  const { face } = input;
  const unix = Math.floor(face.when.getTime() / 1000);
  const seats = input.openSeats.map((seat) => `**${seatName(seat)}**`).join(" and a ");
  const intro = new SectionBuilder()
    .addTextDisplayComponents(
      textBlock(`-# ${matchEyebrow(face.tournamentName, face)}\n## ${emojis.calendar} New Schedule`),
      textBlock(`${matchName(face.leftName, face.rightName)} needs a ${seats}.\n\`${shortUtc(face.when)}\` · <t:${unix}:F> (<t:${unix}:R>)`),
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(NEW_SCHEDULE_GIF));
  const card = new ContainerBuilder()
    .setAccentColor(toneColor.pending)
    .addSectionComponents(intro)
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        linkButton("Go to Assign", input.boardUrl).setEmoji(customEmoji(seatEmoji(input.openSeats[0] ?? "judge"))),
      ),
    );
  const footer = creatorFooter(face);
  if (footer) {
    card.addTextDisplayComponents(textBlock(`-# ${footer}`));
  }
  const mentions = input.roleIds.map((id) => `<@&${id}>`).join(" ");
  return { components: mentions ? [textBlock(mentions), card] : [card], flags: v2Flags };
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
  const leftName = team1Score > team2Score ? `${emojis.winner} ${left}` : left;
  const rightName = team2Score > team1Score ? `${emojis.winner} ${right}` : right;
  return `${emojis.scoreboard} ${leftName} \`${team1Score}\` ${emojis.vs} \`${team2Score}\` ${rightName}`;
}

function linkLine(links: string[]): string | null {
  const usable = links.map((link) => link.trim()).filter((link) => /^https?:\/\//i.test(link));
  if (usable.length === 0) {
    return null;
  }
  return usable.map((link, index) => `${emojis.link} [Link ${index + 1}](${link})`).join("\n");
}
