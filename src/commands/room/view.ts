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
  type TextDisplayBuilder,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatCategory, formatChannel, formatHelpEntry, formatRole, formatUser } from "../../lib/formatters.js";
import { roomCommandIdFor } from "../../lib/register-slash.js";
import { type SheetTeam, type TeamFormat } from "../../lib/sheet.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { captainOf, gameIdLines, type BlockedMatch, type CaptainIssue, type ReadyMatch } from "./bracket.js";
import { escapeDiscord, matchLabel, stageLabel, ticketTopic } from "./labels.js";

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

function titleSide(team: SheetTeam, format: TeamFormat, fallback: string): string {
  if (format === "1vs1") {
    const tag = captainOf(team)?.discordTag.trim() || team.teamName.trim() || fallback;
    return `**${escapeDiscord(tag)}**`;
  }
  return `**${escapeDiscord(team.teamName.trim() || fallback)}**`;
}

const TICKET_WINDOW_SECONDS = 36 * 60 * 60;

/** `present: false` is a captain who is not in the server: named on the card, but not pinged. */
type TicketCaptain = { id: string; avatar?: string; present: boolean };
export type TicketSide = { id: string; member: GuildMember | null };

/** One team: its name, the captain mention and the in-game IDs, with the captain's avatar beside it. */
function addTeam(container: ContainerBuilder, team: SheetTeam, format: TeamFormat, fallback: string, captain: TicketCaptain): void {
  const block = [`### ${titleSide(team, format, fallback)}`, `${emojis.captains} ${formatUser(captain.id)}`, gameIdLines(team)].join("\n");
  if (captain.avatar) {
    container.addSectionComponents(headingWithThumbnail(block, captain.avatar));
  } else {
    container.addTextDisplayComponents(textBlock(block));
  }
}

/**
 * The single battle ticket message: the captains' ping as a Text Display above the card (in V2 it notifies),
 * then the match, both teams, what to do next and the 36-hour warning inside the container.
 */
export function battleTicketPayload(input: {
  guild: Guild;
  tournamentName: string;
  format: TeamFormat;
  helperRoleId: string;
  rulesChannelId: string;
  deadlineChannelId: string;
  match: ReadyMatch;
  captains: { left: TicketCaptain; right: TicketCaptain };
}): { flags: typeof v2Flags; components: [TextDisplayBuilder, ContainerBuilder] } {
  const { guild, format, match, captains } = input;
  const opened = Math.floor(Date.now() / 1000);
  const endsAt = opened + TICKET_WINDOW_SECONDS;
  const stage = stageLabel(match);
  const eyebrow = `-# ${emojis.torneo} ${escapeDiscord(input.tournamentName)}${stage ? ` · ${stage}` : ""}`;
  const title = `# ${titleSide(match.left, format, match.leftName)} ${emojis.vs} ${titleSide(match.right, format, match.rightName)}`;
  const intro = `Your battle ticket is open. Agree on a **date and time** with your opponent here, then ping ${formatRole(null, input.helperRoleId)} so they can create the schedule.`;
  const steps = [
    "### Before you play",
    `${emojis.rules} Read the ${formatChannel(guild, input.rulesChannelId)}`,
    `${emojis.calendar} Check the round deadline in ${formatChannel(guild, input.deadlineChannelId)}`,
    `${emojis.uptime} Reply here before <t:${endsAt}:F> (<t:${endsAt}:R>)`,
  ].join("\n");
  const warning = `> ${emojis.alert} No reply or no coordination within **36 hours** means **automatic disqualification**.`;

  const container = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(textBlock(`${eyebrow}\n${title}`), textBlock(intro))
    .addSeparatorComponents(divider());
  addTeam(container, match.left, format, match.leftName, captains.left);
  container.addSeparatorComponents(divider());
  addTeam(container, match.right, format, match.rightName, captains.right);
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(steps), textBlock(warning))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# **Match ID:** \`${match.id}\` · Opened <t:${opened}:f>`));

  const pinged = [captains.left, captains.right].filter((captain) => captain.present).map((captain) => formatUser(captain.id));
  const ping = textBlock([`${emojis.party} **Battle Ticket Open!**`, ...pinged].join(" "));
  return { flags: v2Flags, components: [ping, container] };
}

/** Plain-text note for the tournament organisers when a captain could not join the ticket. */
export function absentCaptainNotice(adminRoleId: string, absent: CaptainIssue[]): string {
  const who = (issue: CaptainIssue) =>
    `${issue.discordId ? formatUser(issue.discordId) : `**${escapeDiscord(issue.discordTag)}**`} (**${escapeDiscord(issue.teamName)}**)`;
  const body =
    absent.length === 1
      ? `the captain ${who(absent[0])} is not in this server, so they could not be added to this ticket.`
      : `these captains are not in this server, so they could not be added to this ticket: ${absent.map(who).join(", ")}.`;
  return `${emojis.alert} ${formatRole(null, adminRoleId)} ${body} Add them to the channel once they join.`;
}

export async function publishBattleTicket(
  channel: TextChannel,
  guild: Guild,
  tournamentName: string,
  format: TeamFormat,
  adminRoleId: string,
  helperRoleId: string,
  rulesChannelId: string,
  deadlineChannelId: string,
  match: ReadyMatch,
  captains: { left: TicketSide; right: TicketSide },
  absent: CaptainIssue[],
): Promise<void> {
  const captain = (side: TicketSide): TicketCaptain => ({
    id: side.member?.id ?? side.id,
    avatar: side.member?.displayAvatarURL({ extension: "png", size: 256 }),
    present: Boolean(side.member),
  });
  const present = [captains.left.member, captains.right.member].flatMap((member) => (member ? [member.id] : []));
  const posted = await channel.send({
    ...battleTicketPayload({
      guild,
      tournamentName,
      format,
      helperRoleId,
      rulesChannelId,
      deadlineChannelId,
      match,
      captains: { left: captain(captains.left), right: captain(captains.right) },
    }),
    // Only the captains in the server are notified; the helper role is named without a ping.
    allowedMentions: { users: [...new Set(present)], parse: [] },
  });
  await posted.pin("Battle ticket").catch((error) => {
    console.error(`Battle ticket pin failed for match ${match.id}`, error);
  });
  if (absent.length > 0) {
    await channel.send({
      content: absentCaptainNotice(adminRoleId, absent),
      allowedMentions: { roles: [adminRoleId], users: [], parse: [] },
    });
  }
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
