import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type InteractionReplyOptions,
  type TextChannel,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatCategory, formatChannel, formatHelpEntry, formatRole, formatUser } from "../../lib/formatters.js";
import { roomCommandIdFor } from "../../lib/register-slash.js";
import { type SheetTeam, type TeamFormat } from "../../lib/sheet.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { captainOf, gameIdLines, type BlockedMatch, type ReadyMatch } from "./bracket.js";
import { escapeDiscord, matchLabel, roundLabel, stageLabel, ticketTopic } from "./labels.js";

export const AVAILABLE_PAGE_SIZE = 20;
const AVAILABLE_PREFIX = "room:avail";

const CHAT = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis,
];

function snowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim());
}

function sideLabel(team: SheetTeam, format: TeamFormat, fallback: string): string {
  const captain = captainOf(team);
  if (format === "1vs1" && captain && snowflake(captain.discordId)) {
    return formatUser(captain.discordId.trim());
  }
  return `**${escapeDiscord(team.teamName || fallback)}**`;
}

function titleSide(team: SheetTeam, format: TeamFormat, fallback: string): string {
  if (format === "1vs1") {
    const tag = captainOf(team)?.discordTag.trim() || team.teamName.trim() || fallback;
    return `**${escapeDiscord(tag)}**`;
  }
  return `**${escapeDiscord(team.teamName.trim() || fallback)}**`;
}

function teamBlock(index: number, team: SheetTeam, format: TeamFormat, fallback: string, lines: string): string {
  return `**Team ${index}:** ${sideLabel(team, format, fallback)}\n${lines}`;
}

export function battleTicketContainer(
  guild: Guild,
  tournamentName: string,
  format: TeamFormat,
  rulesChannelId: string,
  deadlineChannelId: string,
  match: ReadyMatch,
  avatars: { left?: string; right?: string },
): ContainerBuilder {
  const meta = [
    `${emojis.torneo} **Tournament:** **${escapeDiscord(tournamentName)}**`,
    match.group
      ? `**Round:** \`${roundLabel(match.round)}\` - **Group:** ${match.group}`
      : `**Round:** \`${roundLabel(match.round)}\``,
  ].join("\n");
  const leftBlock = teamBlock(1, match.left, format, match.leftName, gameIdLines(match.left));
  const rightBlock = teamBlock(2, match.right, format, match.rightName, gameIdLines(match.right));
  const details = [
    `${emojis.rules} **Rules:** ${formatChannel(guild, rulesChannelId)}`,
    `${emojis.calendar} **Deadline:** ${formatChannel(guild, deadlineChannelId)}`,
  ].join("\n");

  const title = `# ${titleSide(match.left, format, match.leftName)} ${emojis.vs} ${titleSide(match.right, format, match.rightName)}`;
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(textBlock(title), textBlock(meta))
    .addSeparatorComponents(divider());

  if (avatars.left) {
    container.addSectionComponents(headingWithThumbnail(leftBlock, avatars.left));
  } else {
    container.addTextDisplayComponents(textBlock(leftBlock));
  }

  container.addSeparatorComponents(divider());

  if (avatars.right) {
    container.addSectionComponents(headingWithThumbnail(rightBlock, avatars.right));
  } else {
    container.addTextDisplayComponents(textBlock(rightBlock));
  }

  const endsAt = Math.floor(Date.now() / 1000) + 36 * 60 * 60;
  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(details))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`-# **Match ID:** \`${match.id}\` · <t:${endsAt}:d> <t:${endsAt}:t>`),
    );
}

export function battleTicketPing(captain1Id: string, captain2Id: string, helperRoleId: string): string {
  return [
    `Hello ${formatUser(captain1Id)} and ${formatUser(captain2Id)}. Your Battle Ticket has been created. Please coordinate with your opponent to agree on a Schedule date and time. Once you reach an agreement, ping ${formatRole(null, helperRoleId)} to create the Schedule.`,
    "",
    "> Remember to read the rules, check the deadline, and respond to this ticket within **36 hours**. Failure to respond or coordinate with your opponent will result in **automatic disqualification**.",
  ].join("\n");
}

export async function publishBattleTicket(
  channel: TextChannel,
  guild: Guild,
  tournamentName: string,
  format: TeamFormat,
  helperRoleId: string,
  rulesChannelId: string,
  deadlineChannelId: string,
  match: ReadyMatch,
  captains: { left: GuildMember; right: GuildMember },
): Promise<void> {
  const container = battleTicketContainer(
    guild,
    tournamentName,
    format,
    rulesChannelId,
    deadlineChannelId,
    match,
    {
      left: captains.left.displayAvatarURL({ extension: "png", size: 256 }),
      right: captains.right.displayAvatarURL({ extension: "png", size: 256 }),
    },
  );
  const posted = await channel.send({
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    allowedMentions: { parse: [] },
  });
  await posted.pin("Battle ticket").catch((error) => {
    console.error(`Battle ticket pin failed for match ${match.id}`, error);
  });
  await channel.send({
    content: battleTicketPing(captains.left.id, captains.right.id, helperRoleId),
    allowedMentions: {
      users: [...new Set([captains.left.id, captains.right.id])],
      roles: [helperRoleId],
    },
  });
}

export function channelOverwrites(
  guildId: string,
  adminRoleId: string,
  helperRoleId: string,
  captainIds: string[],
): Array<{ id: string; allow?: typeof CHAT; deny?: bigint[] }> {
  const rows: Array<{ id: string; allow?: typeof CHAT; deny?: bigint[] }> = [
    { id: guildId, deny: [PermissionFlagsBits.ViewChannel] },
  ];
  const seen = new Set<string>([guildId]);
  for (const id of [adminRoleId, helperRoleId, ...captainIds]) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    rows.push({ id, allow: CHAT });
  }
  return rows;
}

export function ticketChannelName(guild: Guild, match: ReadyMatch): string {
  const slug = (value: string) => {
    const cleaned = value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    return cleaned || "team";
  };
  const round = match.round < 0 ? `lr${Math.abs(match.round)}` : `r${match.round}`;
  const prefix = match.group ? `${match.group.toLowerCase()}-${round}` : round;
  const base = `${prefix}-${slug(match.leftName)}-vs-${slug(match.rightName)}`.slice(0, 100).replace(/-+$/g, "");
  const name = base || `match-${match.id}`;
  const taken = guild.channels.cache.some(
    (channel) => channel.type === ChannelType.GuildText && channel.name === name,
  );
  if (!taken) {
    return name;
  }
  const suffixed = `${name}-${match.id}`.slice(0, 100).replace(/-+$/g, "");
  return suffixed || `match-${match.id}`;
}

export { ticketTopic };

type Tone = "success" | "error" | "info";

export function roomPanel(tone: Tone, title: string, lines: string[]): InteractionReplyOptions {
  const color = tone === "success" ? embedColors.success : tone === "error" ? embedColors.error : embedColors.info;
  const emoji = tone === "success" ? emojis.success : tone === "error" ? emojis.error : emojis.info;
  const container = new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(textBlock(`# ${emoji} ${title}`));
  for (const line of lines) {
    if (line.trim()) {
      container.addTextDisplayComponents(textBlock(line));
    }
  }
  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    allowedMentions: { parse: [] },
    components: [container],
  };
}

export function categoryMention(guild: Guild, categoryId: string): string {
  return formatCategory(guild, categoryId);
}

export function blockedSummary(blocked: BlockedMatch[]): string[] {
  return blocked.slice(0, 10).map((match) => `> ${matchLabel(match)}\n> ${match.reason}`);
}

export type AvailableMatch = {
  group: string | null;
  round: number;
  leftName: string;
  rightName: string;
};

export function availableCustomId(tournamentId: string, page: number): string {
  return `${AVAILABLE_PREFIX}:${tournamentId}:${page}`;
}

export function parseAvailableCustomId(customId: string): { tournamentId: string; page: number } | null {
  const parts = customId.split(":");
  if (parts.length !== 4 || parts[0] !== "room" || parts[1] !== "avail") {
    return null;
  }
  const tournamentId = parts[2] ?? "";
  const page = Number(parts[3]);
  if (!/^[a-f0-9]{24}$/i.test(tournamentId) || !Number.isInteger(page) || page < 0) {
    return null;
  }
  return { tournamentId, page };
}

function textChunks(body: string, max = 3500): string[] {
  if (body.length <= max) {
    return [body];
  }
  const chunks: string[] = [];
  let current = "";
  for (const part of body.split("\n\n")) {
    const next = current ? `${current}\n\n${part}` : part;
    if (next.length > max && current) {
      chunks.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

function availableMatchLine(number: number, match: AvailableMatch, hasGroups: boolean): string {
  const stage = stageLabel({ group: hasGroups ? match.group : null, round: match.round });
  const face = `**${number}.** ${emojis.vs} **${escapeDiscord(match.leftName)}** vs **${escapeDiscord(match.rightName)}**`;
  return stage ? `${face} · *${stage}*` : face;
}

function availablePager(tournamentId: string, page: number, pages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(availableCustomId(tournamentId, page - 1))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.back))
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId("room:avail:stay:0")
      .setLabel(`${page + 1}/${pages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(availableCustomId(tournamentId, page + 1))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.next))
      .setDisabled(page >= pages - 1),
  );
}

export function availableRoomsMessage(
  guildId: string,
  tournamentName: string,
  tournamentId: string,
  matches: AvailableMatch[],
  page: number,
  blockedCount: number,
): InteractionReplyOptions {
  const total = matches.length;
  const pages = Math.max(1, Math.ceil(total / AVAILABLE_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), pages - 1);
  const hasGroups = matches.some((match) => Boolean(match.group));
  const start = safePage * AVAILABLE_PAGE_SIZE;
  const slice = matches.slice(start, start + AVAILABLE_PAGE_SIZE);
  const end = start + slice.length;
  const ready = total === 1 ? "match ready for a ticket" : "matches ready for a ticket";
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(
      textBlock(
        `## ${emojis.success} Available Rooms\n${emojis.torneo} **${escapeDiscord(tournamentName)}** · \`${total}\` ${ready}`,
      ),
    )
    .addSeparatorComponents(divider());
  for (const chunk of textChunks(slice.map((match, index) => availableMatchLine(start + index + 1, match, hasGroups)).join("\n"))) {
    container.addTextDisplayComponents(textBlock(chunk));
  }

  if (blockedCount > 0) {
    const note =
      blockedCount === 1
        ? `${emojis.alert} **1** more open match waits until both sides match the sheet.`
        : `${emojis.alert} **${blockedCount}** more open matches wait until both sides match the sheet.`;
    container.addTextDisplayComponents(textBlock(note));
  }

  const create = formatHelpEntry("room create", roomCommandIdFor(guildId));
  const showing = total === 1 ? "Showing 1 of 1" : `Showing ${start + 1}–${end} of ${total}`;
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# ${showing} · open them with ${create}`));
  if (pages > 1) {
    container.addActionRowComponents(availablePager(tournamentId, safePage, pages));
  }

  return {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [container],
  };
}

export type AutoRoomState = "on" | "off" | "already-on" | "already-off";

/** `/room auto` replies that are not a creation report. */
export function autoRoomMessage(input: {
  state: AutoRoomState;
  guildId: string;
  tournamentName: string;
  nextRun: Date;
  actorId: string;
}): InteractionReplyOptions {
  const create = formatHelpEntry("room create", roomCommandIdFor(input.guildId));
  const auto = formatHelpEntry("room auto", roomCommandIdFor(input.guildId));
  const nextRun = `${emojis.uptime} **Next run** <t:${Math.floor(input.nextRun.getTime() / 1000)}:R> · 00:00 and 12:00 UTC`;
  const at = `<t:${Math.floor(Date.now() / 1000)}:F>`;
  const copy = {
    on: {
      color: embedColors.success,
      title: `${emojis.success} Auto-room On`,
      body: [nextRun, `${emojis.channels} No open match was waiting, so nothing was created now.`],
      footer: `Turned on by ${formatUser(input.actorId)} · ${at} · open the queue now with ${create}`,
    },
    off: {
      color: embedColors.error,
      title: `${emojis.error} Auto-room Off`,
      body: [`${emojis.channels} No new battle tickets. Existing tickets stay where they are.`],
      footer: `Turned off by ${formatUser(input.actorId)} · ${at}`,
    },
    "already-on": {
      color: embedColors.info,
      title: `${emojis.info} Auto-room Already On`,
      body: [nextRun],
      footer: `Open the queue now with ${create}`,
    },
    "already-off": {
      color: embedColors.info,
      title: `${emojis.info} Auto-room Already Off`,
      body: [`${emojis.channels} No new battle tickets are being opened.`],
      footer: `Turn it on with ${auto}`,
    },
  }[input.state];

  const container = new ContainerBuilder()
    .setAccentColor(copy.color)
    .addTextDisplayComponents(textBlock(`## ${copy.title}\n${emojis.torneo} **${escapeDiscord(input.tournamentName)}**`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(copy.body.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# ${copy.footer}`));

  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    allowedMentions: { parse: [] },
    components: [container],
  };
}
