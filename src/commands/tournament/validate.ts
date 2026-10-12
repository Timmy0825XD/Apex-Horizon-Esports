import {
  ChannelType,
  ContainerBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatCategory, formatChannel, formatHelpEntry, formatRole, formatUser } from "../../lib/formatters.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import {
  SheetError,
  hasLeadingTeamName,
  loadParsedSheet,
  playerSlotLabel,
  type SheetPlayer,
  type SheetTeam,
  type TeamFormat,
} from "../../lib/sheet.js";
import { validationTicketTopic } from "../../lib/validation-ticket.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { loadGuildSettings } from "../settings/store.js";
import { requireOrganiser } from "./access.js";
import { auditValidationTickets } from "./audit.js";
import { deferTournament, respondTournament } from "./respond.js";
import { findTournamentById } from "./store.js";
import { tournamentErrorMessage } from "./view.js";

const CATEGORY_LIMIT = 50;
const MEMBER_FETCH_CHUNK = 100;
const LIST_LIMIT = 20;

const CHAT = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis,
] as const;

type PlayerStatus = "verified" | "missing_role" | "not_in_server";

type OpenedTicket = {
  channelId: string;
  welcomeOk: boolean;
};

type OpenResult =
  | { kind: "opened"; channelId: string; welcomeOk: boolean }
  | { kind: "orphan" }
  | { kind: "full" }
  | { kind: "discord" }
  | { kind: "forbidden" };

type ValidationRun = {
  tournamentName: string;
  total: number;
  passed: number;
  verifiedRoleId: string;
  transcriptChannelId: string;
  categoryId: string;
  secondaryCategoryId: string | null;
  opened: OpenedTicket[];
  orphans: string[];
  full: string[];
  refused: string[];
  discordFailed: string[];
  requestedBy: string;
};

function escapeDiscord(value: string): string {
  return value.replace(/[\\*_~`|]/g, (char) => `\\${char}`);
}

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function errorCode(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }
  const code = (error as { code: unknown }).code;
  return typeof code === "number" ? code : null;
}

function isCategoryFull(error: unknown): boolean {
  return errorCode(error) === 30013;
}

function isMissingAccess(error: unknown): boolean {
  const code = errorCode(error);
  return code === 50013 || code === 50001;
}

function participantsLoadError(error: unknown): string {
  if (error instanceof SheetError) {
    if (error.code === "sheet-empty") {
      return "This tournament has no participants yet.";
    }
    if (error.code === "timeout") {
      return "Timed out loading participants. Try again.";
    }
    if (error.code === "invalid-link" || error.code === "sheet-private") {
      return "The participant list for this tournament is not readable right now.";
    }
    return "The participant list for this tournament is not in a readable format.";
  }
  return "Something went wrong while loading participants. Try again.";
}

function teamLabel(team: SheetTeam, format: TeamFormat, index: number): string {
  if (hasLeadingTeamName(format) && team.teamName.trim()) {
    return team.teamName.trim();
  }
  const captain = team.players[0];
  return captain?.discordTag.trim() || captain?.gameName.trim() || `Team ${index + 1}`;
}

function slug(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "team";
}

function channelName(guild: Guild, used: Set<string>, label: string): string {
  const base = `validation-${slug(label)}`.slice(0, 90).replace(/-+$/g, "") || "validation-team";
  let name = base;
  let n = 2;
  while (used.has(name) || guild.channels.cache.some((channel) => channel.name === name)) {
    const suffix = `-${n}`;
    name = `${base.slice(0, 100 - suffix.length)}${suffix}`.replace(/-+$/g, "");
    n += 1;
    if (n > 100) {
      break;
    }
  }
  return name;
}

function playerStatus(player: SheetPlayer, members: Map<string, GuildMember>, verifiedRoleId: string): PlayerStatus {
  const id = player.discordId.trim();
  if (!isSnowflake(id)) {
    return "not_in_server";
  }
  const member = members.get(id);
  if (!member) {
    return "not_in_server";
  }
  return member.roles.cache.has(verifiedRoleId) ? "verified" : "missing_role";
}

function issueLabel(status: PlayerStatus): string {
  if (status === "missing_role") {
    return `${emojis.error} Not verified`;
  }
  return `${emojis.error} Not in server`;
}

function issueLine(player: SheetPlayer, status: PlayerStatus): string {
  const id = player.discordId.trim();
  const tag = player.discordTag.trim();
  const mention = isSnowflake(id) ? `${formatUser(id)} ` : "";
  const name = tag
    ? `**${escapeDiscord(tag)}**`
    : mention
      ? "*Empty*"
      : `**${escapeDiscord(playerSlotLabel(player.slot))}**`;
  return `- ${mention}${name} - ${issueLabel(status)}`;
}

function contactIds(players: SheetPlayer[], members: Map<string, GuildMember>, verifiedRoleId: string): string[] {
  const ids: string[] = [];
  for (const player of players) {
    if (playerStatus(player, members, verifiedRoleId) === "not_in_server") {
      continue;
    }
    const id = player.discordId.trim();
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function snowflakeIds(teams: SheetTeam[]): string[] {
  const ids = new Set<string>();
  for (const team of teams) {
    for (const player of team.players) {
      const id = player.discordId.trim();
      if (isSnowflake(id)) {
        ids.add(id);
      }
    }
  }
  return [...ids];
}

async function loadMembers(guild: Guild, ids: string[]): Promise<Map<string, GuildMember>> {
  const members = new Map<string, GuildMember>();
  const missing: string[] = [];
  for (const id of ids) {
    const cached = guild.members.cache.get(id);
    if (cached) {
      members.set(id, cached);
    } else {
      missing.push(id);
    }
  }

  for (let i = 0; i < missing.length; i += MEMBER_FETCH_CHUNK) {
    const chunk = missing.slice(i, i + MEMBER_FETCH_CHUNK);
    await guild.members.fetch({ user: chunk }).catch(() => undefined);
    for (const id of chunk) {
      const member = guild.members.cache.get(id);
      if (member) {
        members.set(id, member);
      }
    }
  }

  return members;
}

function categoryLoads(guild: Guild, categoryIds: string[]): Map<string, number> {
  const loads = new Map<string, number>();
  for (const id of categoryIds) {
    const channel = guild.channels.cache.get(id);
    if (!channel || channel.type !== ChannelType.GuildCategory) {
      continue;
    }
    loads.set(id, guild.channels.cache.filter((child) => child.parentId === id).size);
  }
  return loads;
}

function nextOpenCategory(categoryIds: string[], loads: Map<string, number>): string | null {
  for (const id of categoryIds) {
    const count = loads.get(id);
    if (count == null || count >= CATEGORY_LIMIT) {
      continue;
    }
    return id;
  }
  return null;
}

function overwrites(guildId: string, adminRoleId: string, helperRoleId: string, userId: string) {
  const rows: Array<{ id: string; allow?: bigint[]; deny?: bigint[] }> = [
    { id: guildId, deny: [PermissionFlagsBits.ViewChannel] },
  ];
  const seen = new Set<string>([guildId]);
  for (const id of [adminRoleId, helperRoleId, userId]) {
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    rows.push({ id, allow: [...CHAT] });
  }
  return rows;
}

function rulesText(guild: Guild, verifiedRoleId: string, adminRoleId: string): string {
  const verified = formatRole(guild, verifiedRoleId);
  const admin = formatRole(guild, adminRoleId);
  return [
    `According to our tournament rules, **all registered players must be verified in the server.** This ticket has been opened because one or more members of your team do not have the ${verified} role or are not currently in the server.`,
    "",
    `Please contact your teammates to resolve the issue. Once everything has been fixed, ping ${admin} so we can verify it.`,
  ].join("\n");
}

async function publishTicket(
  channel: TextChannel,
  guild: Guild,
  verifiedRoleId: string,
  adminRoleId: string,
  players: SheetPlayer[],
  members: Map<string, GuildMember>,
  contactId: string,
): Promise<void> {
  const lines = players
    .filter((player) => playerStatus(player, members, verifiedRoleId) !== "verified")
    .map((player) => issueLine(player, playerStatus(player, members, verifiedRoleId)));
  const issues = lines.length > 0 ? lines.join("\n") : "*No failing players were left.*";
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.error)
    .addTextDisplayComponents(textBlock(`# ${emojis.alert} Group Validation Ticket`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(rulesText(guild, verifiedRoleId, adminRoleId)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`### ${emojis.error} Issues\n${issues}`));

  await channel.send({
    components: [container],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });
  await channel.send({
    content: `${formatUser(contactId)} Please read this and take care of solving it as soon as possible.`,
    allowedMentions: { users: [contactId] },
  });
}

async function openTeam(
  guild: Guild,
  tournamentName: string,
  challongeId: string,
  adminRoleId: string,
  helperRoleId: string,
  verifiedRoleId: string,
  transcriptChannelId: string,
  team: SheetTeam,
  label: string,
  members: Map<string, GuildMember>,
  categoryIds: string[],
  loads: Map<string, number>,
  usedNames: Set<string>,
): Promise<OpenResult> {
  const contacts = contactIds(team.players, members, verifiedRoleId);
  if (contacts.length === 0) {
    return { kind: "orphan" };
  }

  let index = 0;
  while (index < contacts.length) {
    const userId = contacts[index];
    if (!userId) {
      break;
    }
    const categoryId = nextOpenCategory(categoryIds, loads);
    if (!categoryId) {
      return { kind: "full" };
    }
    const name = channelName(guild, usedNames, label);
    try {
      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: categoryId,
        topic: validationTicketTopic(challongeId, transcriptChannelId),
        permissionOverwrites: overwrites(guild.id, adminRoleId, helperRoleId, userId),
        reason: `Group validation for ${tournamentName}`.slice(0, 500),
      });
      if (channel.type !== ChannelType.GuildText) {
        await channel.delete("Validation ticket was not a text channel").catch(() => undefined);
        index += 1;
        continue;
      }
      loads.set(categoryId, (loads.get(categoryId) ?? 0) + 1);
      usedNames.add(name);
      let welcomeOk = true;
      try {
        await publishTicket(channel, guild, verifiedRoleId, adminRoleId, team.players, members, userId);
      } catch (error) {
        welcomeOk = false;
        console.error(`Validation ticket welcome failed for ${label}`, error);
      }
      return { kind: "opened", channelId: channel.id, welcomeOk };
    } catch (error) {
      if (isCategoryFull(error)) {
        loads.set(categoryId, CATEGORY_LIMIT);
        continue;
      }
      if (isMissingAccess(error)) {
        return { kind: "forbidden" };
      }
      index += 1;
    }
  }

  return { kind: "discord" };
}

function capLines(lines: string[]): string {
  const shown = lines.slice(0, LIST_LIMIT);
  const extra = lines.length - shown.length;
  if (extra > 0) {
    shown.push(`*And **${extra}** more.*`);
  }
  return shown.join("\n");
}

function nameLines(labels: string[]): string {
  return capLines(labels.map((label) => `- **${escapeDiscord(label)}**`));
}

function validationMessage(guild: Guild, run: ValidationRun) {
  const welcomeFailed = run.opened.filter((ticket) => !ticket.welcomeOk).length;
  const broken = run.full.length + run.refused.length + run.discordFailed.length;
  const gaps = broken + run.orphans.length + welcomeFailed;
  const allVerified = run.passed === run.total;
  const tone = allVerified ? "success" : run.opened.length > 0 && gaps === 0 ? "success" : run.opened.length > 0 || broken === 0 ? "info" : "error";
  const title = allVerified
    ? "Rosters verified"
    : run.opened.length > 0 && gaps === 0
      ? "Validation tickets opened"
      : run.opened.length > 0
        ? "Validation finished with gaps"
        : broken === 0
          ? "Teams left without a ticket"
          : "No validation tickets opened";
  const emoji = tone === "success" ? emojis.success : tone === "error" ? emojis.error : emojis.info;
  const color = tone === "success" ? embedColors.success : tone === "error" ? embedColors.error : embedColors.info;
  const verified = formatRole(guild, run.verifiedRoleId);
  const intro = allVerified
    ? `Every player in **${escapeDiscord(run.tournamentName)}** is in the server and has ${verified}. **${run.total}** teams checked. No channel was created.`
    : run.opened.length > 0 && gaps === 0
      ? `Opened a ticket for every team in **${escapeDiscord(run.tournamentName)}** that is not fully verified. **${run.passed}** teams already had every player in the server with ${verified}, so they got no channel.`
      : broken === 0 && run.opened.length === 0
        ? run.passed === 0
          ? `Nobody registered in **${escapeDiscord(run.tournamentName)}** is in the server, so no validation ticket was opened.`
          : `**${run.passed}** teams in **${escapeDiscord(run.tournamentName)}** are fully verified. The other **${run.orphans.length}** have nobody in the server to add, so they got no ticket.`
        : `Checked **${run.total}** teams in **${escapeDiscord(run.tournamentName)}** against ${verified}. Tickets were opened only where someone from the roster is in the server.`;

  const facts = [
    `**Checked:** **${run.total}**`,
    `**Verified teams:** **${run.passed}**`,
    `**Tickets opened:** **${run.opened.length}**`,
    `**Transcripts:** ${formatChannel(guild, run.transcriptChannelId)}`,
    `**Category:** ${formatCategory(guild, run.categoryId)}`,
    run.secondaryCategoryId ? `**Overflow:** ${formatCategory(guild, run.secondaryCategoryId)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      textBlock(`# ${emoji} ${title}`),
      textBlock(`${emojis.torneo} **Tournament:** **${escapeDiscord(run.tournamentName)}**`),
      textBlock(intro),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`### ${emojis.channels} Result`), textBlock(facts));

  if (run.opened.length > 0) {
    const mentions = capLines(run.opened.map((ticket) => `- ${formatChannel(guild, ticket.channelId)}`));
    const note =
      welcomeFailed === 0
        ? ""
        : welcomeFailed === 1
          ? "\n\n**1** ticket exists, but the validation message failed to send."
          : `\n\n**${welcomeFailed}** tickets exist, but the validation message failed to send.`;
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(textBlock(`### ${emojis.textChannel} Opened`), textBlock(`${mentions}${note}`));
  }

  if (run.orphans.length > 0) {
    const onlyOrphans = run.opened.length === 0 && broken === 0;
    const orphanBody = onlyOrphans
      ? nameLines(run.orphans)
      : `These teams failed verification, and nobody on the roster is in the server.\n${nameLines(run.orphans)}`;
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(textBlock(`### ${emojis.info} No one to add`), textBlock(orphanBody));
  }

  if (run.full.length > 0) {
    const where = run.secondaryCategoryId
      ? "Both categories are at **50** channels."
      : `${formatCategory(guild, run.categoryId)} is at **50** channels.`;
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        textBlock(`### ${emojis.categories} Category full`),
        textBlock(`${where}\n${nameLines(run.full)}`),
      );
  }

  if (run.refused.length > 0) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(
      textBlock(`### ${emojis.error} Could not continue`),
      textBlock(
        `Discord refused more channels. I need **Manage Channels** in the validation categories.\n${nameLines(run.refused)}`,
      ),
    );
  }

  if (run.discordFailed.length > 0) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(
      textBlock(`### ${emojis.error} Channel not created`),
      textBlock(`Discord did not create a ticket for these teams.\n${nameLines(run.discordFailed)}`),
    );
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Requested by ${formatUser(run.requestedBy)}`));

  return {
    flags: v2Flags,
    allowedMentions: { parse: [] as const },
    components: [container],
  };
}

function botCan(channel: GuildBasedChannel | null, me: GuildMember, bits: bigint): boolean {
  if (!channel) {
    return false;
  }
  return channel.permissionsFor(me)?.has(bits) ?? false;
}

async function resolveChannel(guild: Guild, id: string): Promise<GuildBasedChannel | null> {
  return guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
}

export async function handleTournamentValidate(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireOrganiser(interaction, "validate a tournament roster"))) {
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Guild only", "This command can only be used in a server."),
    );
    return;
  }

  await deferTournament(interaction);

  const settings = await loadGuildSettings(guild.id);
  if (!settings?.verifiedRoleId) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Verified role missing",
        `Run ${formatHelpEntry("settings set", settingsCommandIdFor(guild.id))} and set the verified role first.`,
        false,
      ),
    );
    return;
  }

  const verifiedRole =
    guild.roles.cache.get(settings.verifiedRoleId) ??
    (await guild.roles.fetch(settings.verifiedRoleId).catch(() => null));
  if (!verifiedRole) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Verified role missing",
        "The verified role from settings is no longer in this server.",
        false,
      ),
    );
    return;
  }

  const tournament = await findTournamentById(guild.id, interaction.options.getString("tournament", true));
  if (!tournament) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Unknown tournament", "Pick a tournament from the autocomplete list.", false),
    );
    return;
  }

  const categoryId = interaction.options.getChannel("category", true).id;
  const transcriptChannelId = interaction.options.getChannel("transcript_channel", true).id;
  const secondaryId = interaction.options.getChannel("secondary_category")?.id ?? null;
  if (secondaryId && secondaryId === categoryId) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Overflow category", "Pick a different category for the overflow.", false),
    );
    return;
  }

  await guild.channels.fetch().catch(() => undefined);
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  const category = await resolveChannel(guild, categoryId);
  const transcript = await resolveChannel(guild, transcriptChannelId);
  const secondary = secondaryId ? await resolveChannel(guild, secondaryId) : null;
  if (!category || category.type !== ChannelType.GuildCategory) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Category missing", "That category is no longer in this server.", false),
    );
    return;
  }
  if (!transcript || (transcript.type !== ChannelType.GuildText && transcript.type !== ChannelType.GuildAnnouncement)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Transcript channel missing", "That channel is no longer a text channel in this server.", false),
    );
    return;
  }
  if (secondaryId && (!secondary || secondary.type !== ChannelType.GuildCategory)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Overflow category missing", "That overflow category is no longer in this server.", false),
    );
    return;
  }
  if (!me || !botCan(category, me, PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ViewChannel)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Missing channel access",
        `I need **Manage Channels** in ${formatCategory(guild, category.id)} to open validation tickets.`,
        false,
      ),
    );
    return;
  }
  if (
    secondary &&
    !botCan(secondary, me, PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ViewChannel)
  ) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Missing channel access",
        `I need **Manage Channels** in ${formatCategory(guild, secondary.id)} to use it as overflow.`,
        false,
      ),
    );
    return;
  }
  const transcriptBits =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.AttachFiles |
    PermissionFlagsBits.EmbedLinks;
  if (!me || !botCan(transcript, me, transcriptBits)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Missing channel access",
        `I need to send messages and files in ${formatChannel(guild, transcript.id)} so transcripts can be delivered there.`,
        false,
      ),
    );
    return;
  }

  let sheet;
  try {
    sheet = await loadParsedSheet(tournament.sheetLink);
  } catch (error) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Could not load participants", participantsLoadError(error), false),
    );
    return;
  }

  const members = await loadMembers(guild, snowflakeIds(sheet.teams));
  const categoryIds = [category.id, secondary?.id].filter((id): id is string => Boolean(id));
  const loads = categoryLoads(guild, categoryIds);
  const usedNames = new Set<string>();
  const opened: OpenedTicket[] = [];
  const orphans: string[] = [];
  const full: string[] = [];
  const refused: string[] = [];
  const discordFailed: string[] = [];
  let passed = 0;
  let stop = false;

  for (const [index, team] of sheet.teams.entries()) {
    const label = teamLabel(team, sheet.format, index);
    const verified = team.players.every(
      (player) => playerStatus(player, members, settings.verifiedRoleId) === "verified",
    );
    if (verified) {
      passed += 1;
      continue;
    }
    if (stop) {
      const someoneHere = team.players.some(
        (player) => playerStatus(player, members, settings.verifiedRoleId) !== "not_in_server",
      );
      if (someoneHere) {
        refused.push(label);
      } else {
        orphans.push(label);
      }
      continue;
    }
    const result = await openTeam(
      guild,
      tournament.name,
      tournament.challongeId,
      tournament.adminRoleId,
      tournament.helperRoleId,
      settings.verifiedRoleId,
      transcript.id,
      team,
      label,
      members,
      categoryIds,
      loads,
      usedNames,
    );
    if (result.kind === "opened") {
      opened.push({ channelId: result.channelId, welcomeOk: result.welcomeOk });
    } else if (result.kind === "orphan") {
      orphans.push(label);
    } else if (result.kind === "full") {
      full.push(label);
    } else if (result.kind === "forbidden") {
      stop = true;
      refused.push(label);
    } else {
      discordFailed.push(label);
    }
  }

  const run: ValidationRun = {
    tournamentName: tournament.name,
    total: sheet.teams.length,
    passed,
    verifiedRoleId: settings.verifiedRoleId,
    transcriptChannelId: transcript.id,
    categoryId: category.id,
    secondaryCategoryId: secondary?.id ?? null,
    opened,
    orphans,
    full,
    refused,
    discordFailed,
    requestedBy: interaction.user.id,
  };

  await respondTournament(interaction, validationMessage(guild, run));
  await auditValidationTickets(
    guild,
    settings,
    interaction.user,
    tournament.name,
    transcript.id,
    opened,
    orphans.length + full.length + refused.length + discordFailed.length,
  );
}
