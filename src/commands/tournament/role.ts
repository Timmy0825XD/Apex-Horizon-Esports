import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  GuildMember,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type InteractionReplyOptions,
  type Role,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { escapeDiscord } from "../room/labels.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatRole, formatRoleFromRole, formatUser } from "../../lib/formatters.js";
import {
  SheetError,
  discordIdHeaders,
  formatPlayerCount,
  loadParsedSheet,
  type DiscordIdHeader,
  type SheetPlayer,
  type SheetTeam,
} from "../../lib/sheet.js";
import { divider, textBlock } from "../../lib/v2.js";
import { loadGuildSettings } from "../settings/store.js";
import { requireOrganiser } from "./access.js";
import { auditTournamentRole } from "./audit.js";
import { loadOfficialBannedGameIds, playerHasOfficialBannedId } from "./banned-ids.js";
import { deferTournament, respondTournament } from "./respond.js";
import { findTournamentById } from "./store.js";
import { tournamentErrorMessage } from "./view.js";

const MAX_SHOWN = 15;
const ROLE_CONFIRM_PREFIX = "tournament:role";

type PlayerRow = {
  teamName: string;
  player: SheetPlayer;
  headerLabel: string;
  member?: GuildMember;
};

type RoleBuckets = {
  assigned: PlayerRow[];
  alreadyHad: PlayerRow[];
  notInServer: PlayerRow[];
  invalidIds: PlayerRow[];
  banned: PlayerRow[];
  failed: PlayerRow[];
};

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim());
}

function playerHasIdentity(player: SheetPlayer): boolean {
  return Boolean(player.discordTag || player.discordId || player.gameName || player.gameId);
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

function botCanManageRoles(botMember: GuildMember): boolean {
  return botMember.permissions.has(PermissionFlagsBits.ManageRoles);
}

function unmanageableRoleReason(role: Role, actor: GuildMember, botMember: GuildMember): string | null {
  const mention = formatRoleFromRole(role);
  if (role.managed) {
    return `${mention} is managed by an integration and cannot be assigned.`;
  }
  if (role.position >= botMember.roles.highest.position) {
    return `My highest role is not above ${mention}.`;
  }
  if (actor.id !== actor.guild.ownerId && actor.roles.highest.comparePositionTo(role) <= 0) {
    return `Your highest role is not above ${mention}.`;
  }
  return null;
}

function parseSlot(raw: string | null, headers: DiscordIdHeader[]): DiscordIdHeader | null {
  if (raw == null || raw === "") {
    return null;
  }
  const slot = Number(raw);
  if (!Number.isInteger(slot)) {
    return null;
  }
  return headers.find((header) => header.slot === slot) ?? null;
}

function collectTargets(teams: SheetTeam[], header: DiscordIdHeader | null, headers: DiscordIdHeader[]): PlayerRow[] {
  const rows: PlayerRow[] = [];
  for (const team of teams) {
    const slots = header ? [header] : headers;
    for (const column of slots) {
      const player = team.players[column.slot];
      if (!player || !playerHasIdentity(player)) {
        continue;
      }
      rows.push({ teamName: team.teamName, player, headerLabel: column.label });
    }
  }
  return rows;
}

const warnColor = 0xe67e22;

function stamp(): string {
  return `<t:${Math.floor(Date.now() / 1000)}:F>`;
}

function rowLabel(row: PlayerRow): string {
  const team = row.teamName ? `**${escapeDiscord(row.teamName)}** · ` : "";
  if (row.member) {
    return `- ${team}${formatUser(row.member.id)}`;
  }
  const who = row.player.gameName || row.player.discordTag || row.player.gameId || "Unknown player";
  const id = row.player.discordId ? ` · \`${escapeDiscord(row.player.discordId)}\`` : "";
  return `- ${team}**${escapeDiscord(who)}**${id}`;
}

function listedBlock(rows: PlayerRow[]): string {
  const shown = rows.slice(0, MAX_SHOWN);
  const extra = rows.length - shown.length;
  const more = extra > 0 ? `\n*And **${extra}** more.*` : "";
  return `${shown.map(rowLabel).join("\n")}${more}`;
}

/** Members who got the role, as mentions in a row; the rest only as a count. */
function givenBlock(rows: PlayerRow[]): string {
  const mentions = rows.flatMap((row) => (row.member ? [formatUser(row.member.id)] : []));
  const shown = mentions.slice(0, MAX_SHOWN);
  const extra = rows.length - shown.length;
  return extra > 0 ? `${shown.join(" ")} *and **${extra}** more*` : shown.join(" ");
}

function roleResultMessage(
  tournamentName: string,
  role: Role,
  scope: string,
  buckets: RoleBuckets,
  actorId: string,
): InteractionReplyOptions {
  const total =
    buckets.assigned.length +
    buckets.alreadyHad.length +
    buckets.notInServer.length +
    buckets.invalidIds.length +
    buckets.banned.length +
    buckets.failed.length;
  if (total === 0) {
    return tournamentErrorMessage("No players to role", `**${tournamentName}** has no players that could be processed.`, false);
  }

  const skipped = buckets.notInServer.length + buckets.invalidIds.length + buckets.banned.length + buckets.failed.length;
  const noneGiven = buckets.assigned.length === 0 && buckets.alreadyHad.length === 0;
  const color = noneGiven ? embedColors.error : skipped > 0 ? warnColor : embedColors.success;
  const emoji = noneGiven ? emojis.error : emojis.success;
  const title = noneGiven ? "Role Not Given" : "Role Given to Players";
  const counts = [
    `**Given** \`${buckets.assigned.length}\``,
    `**Already had it** \`${buckets.alreadyHad.length}\``,
    `**Not in server** \`${buckets.notInServer.length}\``,
    `**Banned** \`${buckets.banned.length}\``,
    `**Invalid ID** \`${buckets.invalidIds.length}\``,
    `**Failed** \`${buckets.failed.length}\``,
  ].join(" · ");

  const groups: string[] = [];
  if (buckets.assigned.length > 0) {
    groups.push(`### ${emojis.success} Given · ${buckets.assigned.length}\n${givenBlock(buckets.assigned)}`);
  }
  if (buckets.notInServer.length > 0) {
    groups.push(`### ${emojis.members} Not in This Server · ${buckets.notInServer.length}\n${listedBlock(buckets.notInServer)}`);
  }
  if (buckets.invalidIds.length > 0) {
    groups.push(
      `### ${emojis.error} Invalid Discord IDs · ${buckets.invalidIds.length}\n-# Empty or not a Discord ID on the sheet.\n${listedBlock(buckets.invalidIds)}`,
    );
  }
  if (buckets.banned.length > 0) {
    groups.push(
      `### ${emojis.banned} Banned, Skipped · ${buckets.banned.length}\n-# Discord ban or official in-game ID ban.\n${listedBlock(buckets.banned)}`,
    );
  }
  if (buckets.failed.length > 0) {
    groups.push(
      `### ${emojis.error} Could Not Update · ${buckets.failed.length}\n-# Discord rejected the role update. Check my role position.\n${listedBlock(buckets.failed)}`,
    );
  }

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      textBlock(`## ${emoji} ${title}\n-# ${escapeDiscord(tournamentName)} · ${escapeDiscord(scope)}`),
      textBlock(`${formatRoleFromRole(role)} → ${counts}`),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(...groups.map((group) => textBlock(group)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Given by ${formatUser(actorId)} · ${stamp()}`));

  return {
    components: [container],
    allowedMentions: { parse: [] },
  };
}

function confirmAllPlayersMessage(
  userId: string,
  tournamentId: string,
  tournamentName: string,
  format: string,
  role: Role,
  playerCount: number,
  columnCount: number,
): InteractionReplyOptions {
  const columns =
    columnCount === 1 ? "`1` Discord ID column" : `\`${columnCount}\` Discord ID columns (\`${format}\`)`;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ROLE_CONFIRM_PREFIX}:ok:${userId}:${tournamentId}:${role.id}`)
      .setLabel("Give to all players")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(customEmoji(emojis.success)),
    new ButtonBuilder()
      .setCustomId(`${ROLE_CONFIRM_PREFIX}:no:${userId}:${tournamentId}:${role.id}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.error)),
  );

  return {
    components: [
      new ContainerBuilder()
        .setAccentColor(warnColor)
        .addTextDisplayComponents(
          textBlock(
            `## ${emojis.alert} Give the Role to Every Player?\nNo **ID header** was picked, so ${formatRoleFromRole(role)} goes to the whole roster of **${escapeDiscord(tournamentName)}**.`,
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(
          textBlock(
            [
              `**Columns** ${columns} · **Players** \`${playerCount}\``,
              "- People who already have it, invalid IDs, non-members and banned players are skipped.",
              "- The bot cannot undo this. You would remove the role by hand.",
            ].join("\n"),
          ),
          textBlock(`-# Only ${formatUser(userId)} can use these buttons.`),
        )
        .addActionRowComponents(row),
    ],
    allowedMentions: { parse: [] },
  };
}

function cancelledMessage(guild: Guild, tournamentName: string, roleId: string, actorId: string): InteractionReplyOptions {
  return {
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(
            `## ${emojis.info} Role Assignment Cancelled\n${formatRole(guild, roleId)} was **not** given to anyone in **${escapeDiscord(tournamentName)}**. Pick an **ID header** if you only want one Discord ID column.`,
          ),
          textBlock(`-# Cancelled by ${formatUser(actorId)} · ${stamp()}`),
        ),
    ],
    allowedMentions: { parse: [] },
  };
}

async function loadBanIds(guild: Guild, ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(isSnowflake))];
  if (unique.length === 0 || !guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
    return new Set();
  }

  if (unique.length > 8) {
    const bans = await guild.bans.fetch().catch(() => null);
    if (!bans) {
      return new Set();
    }
    return new Set(unique.filter((id) => bans.has(id)));
  }

  const banned = new Set<string>();
  await Promise.all(
    unique.map(async (id) => {
      const cached = guild.bans.cache.get(id);
      const ban = cached ?? (await guild.bans.fetch(id).catch(() => null));
      if (ban) {
        banned.add(id);
      }
    }),
  );
  return banned;
}

async function grantRole(member: GuildMember, role: Role, reason: string): Promise<boolean> {
  try {
    await member.roles.add(role, reason);
    return true;
  } catch {
    return false;
  }
}

async function assignRoleToTargets(
  guild: Guild,
  tournamentName: string,
  role: Role,
  targets: PlayerRow[],
): Promise<RoleBuckets> {
  const buckets: RoleBuckets = {
    assigned: [],
    alreadyHad: [],
    notInServer: [],
    invalidIds: [],
    banned: [],
    failed: [],
  };

  const bannedGameIds = await loadOfficialBannedGameIds();

  await guild.members.fetch().catch(() => undefined);
  const bans = await loadBanIds(
    guild,
    targets.map((row) => row.player.discordId),
  );
  for (const row of targets) {
    const rawId = row.player.discordId.trim();
    const gameBanned = playerHasOfficialBannedId(row.player, bannedGameIds);

    if (!rawId || !isSnowflake(rawId)) {
      buckets.invalidIds.push(row);
      continue;
    }

    const member = guild.members.cache.get(rawId) ?? null;
    const listed = { ...row, member: member ?? undefined };

    if (!member) {
      if (bans.has(rawId) || gameBanned) {
        buckets.banned.push(listed);
      } else {
        buckets.notInServer.push(listed);
      }
      continue;
    }

    if (gameBanned) {
      buckets.banned.push(listed);
      continue;
    }

    if (member.roles.cache.has(role.id)) {
      buckets.alreadyHad.push(listed);
      continue;
    }

    const ok = await grantRole(member, role, `Tournament role: ${tournamentName}`);
    if (ok) {
      buckets.assigned.push(listed);
    } else {
      buckets.failed.push(listed);
    }
  }

  return buckets;
}

async function loadLiveTargets(
  tournament: { sheetLink: string; format: import("../../lib/sheet.js").TeamFormat; name: string },
  slotRaw: string | null,
): Promise<{ headers: DiscordIdHeader[]; header: DiscordIdHeader | null; targets: PlayerRow[] }> {
  const sheet = await loadParsedSheet(tournament.sheetLink);
  const headers = discordIdHeaders(sheet.format, sheet.headers);
  const header = parseSlot(slotRaw, headers);
  if (slotRaw && !header) {
    throw new SheetError("bad-columns", "That Discord ID header is not part of this tournament format.");
  }
  return { headers, header, targets: collectTargets(sheet.teams, header, headers) };
}

async function requireAssignableRole(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  guild: Guild,
  roleId: string,
): Promise<Role | null> {
  if (roleId === guild.id) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Invalid role", "The @everyone role cannot be assigned this way.", false),
    );
    return null;
  }

  await guild.roles.fetch().catch(() => undefined);
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Role missing", "That role is no longer in this server.", false),
    );
    return null;
  }

  const actor = interaction.member instanceof GuildMember ? interaction.member : await guild.members.fetch(interaction.user.id);
  const botMember = await guild.members.fetchMe();
  if (!botCanManageRoles(botMember)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Missing permission", "I need **Manage Roles** to assign tournament roles.", false),
    );
    return null;
  }

  const reason = unmanageableRoleReason(role, actor, botMember);
  if (reason) {
    await respondTournament(interaction, tournamentErrorMessage("Hierarchy blocked", reason, false));
    return null;
  }

  return role;
}

async function finishAssignment(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  guild: Guild,
  tournamentName: string,
  role: Role,
  scope: string,
  targets: PlayerRow[],
): Promise<void> {
  if (targets.length === 0) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("No players", `**${tournamentName}** has no players in that Discord ID column.`, false),
    );
    return;
  }

  let buckets: RoleBuckets;
  try {
    buckets = await assignRoleToTargets(guild, tournamentName, role, targets);
  } catch (error) {
    const detail =
      error instanceof SheetError
        ? error.message
        : "The official banned-ID list could not be read. Try again in a moment.";
    await respondTournament(interaction, tournamentErrorMessage("Banned-ID list unavailable", detail, false));
    return;
  }

  await respondTournament(interaction, roleResultMessage(tournamentName, role, scope, buckets, interaction.user.id));

  if (buckets.assigned.length > 0) {
    const settings = await loadGuildSettings(guild.id);
    if (settings) {
      await auditTournamentRole(interaction, guild, settings, tournamentName, role.id, scope, buckets.assigned.length);
    }
  }
}

export async function handleTournamentRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondTournament(interaction, tournamentErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  if (!(await requireOrganiser(interaction, "assign tournament roles"))) {
    return;
  }

  await deferTournament(interaction);

  const tournament = await findTournamentById(guild.id, interaction.options.getString("tournament", true));
  if (!tournament) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Unknown tournament", "Pick a tournament from the autocomplete list.", false),
    );
    return;
  }

  const role = await requireAssignableRole(interaction, guild, interaction.options.getRole("role", true).id);
  if (!role) {
    return;
  }

  const slotRaw = interaction.options.getString("id_header");

  let loaded: { headers: DiscordIdHeader[]; header: DiscordIdHeader | null; targets: PlayerRow[] };
  try {
    loaded = await loadLiveTargets(tournament, slotRaw);
  } catch (error) {
    if (error instanceof SheetError && error.code === "bad-columns" && slotRaw) {
      await respondTournament(
        interaction,
        tournamentErrorMessage(
          "Unknown ID header",
          `**${tournament.name}** is \`${tournament.format}\`, so pick one of its **${formatPlayerCount(tournament.format)}** Discord ID header${formatPlayerCount(tournament.format) === 1 ? "" : "s"}.`,
          false,
        ),
      );
      return;
    }
    await respondTournament(
      interaction,
      tournamentErrorMessage("Could not load participants", participantsLoadError(error), false),
    );
    return;
  }

  if (!loaded.header) {
    await respondTournament(
      interaction,
      confirmAllPlayersMessage(
        interaction.user.id,
        tournament.id,
        tournament.name,
        tournament.format,
        role,
        loaded.targets.length,
        loaded.headers.length,
      ),
    );
    return;
  }

  await finishAssignment(interaction, guild, tournament.name, role, loaded.header.label, loaded.targets);
}

export async function handleTournamentRoleButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(":");
  const action = parts[2];
  const userId = parts[3];
  const tournamentId = parts[4];
  const roleId = parts[5];
  const guild = interaction.guild;

  if (!guild || !userId || !tournamentId || !roleId || (action !== "ok" && action !== "no")) {
    return;
  }

  if (interaction.user.id !== userId) {
    await interaction.reply(
      tournamentErrorMessage("Not your confirmation", "Only the person who ran the command can confirm this."),
    );
    return;
  }

  const tournament = await findTournamentById(guild.id, tournamentId);

  if (action === "no") {
    const cancelled = cancelledMessage(guild, tournament?.name ?? "this tournament", roleId, interaction.user.id);
    await interaction.update({
      components: cancelled.components,
      allowedMentions: cancelled.allowedMentions,
    });
    return;
  }

  if (!(await requireOrganiser(interaction, "assign tournament roles"))) {
    return;
  }

  await interaction.deferUpdate();

  if (!tournament) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Unknown tournament", "That tournament is no longer registered.", false),
    );
    return;
  }

  const assignRole = await requireAssignableRole(interaction, guild, roleId);
  if (!assignRole) {
    return;
  }

  let loaded: { headers: DiscordIdHeader[]; header: DiscordIdHeader | null; targets: PlayerRow[] };
  try {
    loaded = await loadLiveTargets(tournament, null);
  } catch (error) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Could not load participants", participantsLoadError(error), false),
    );
    return;
  }

  await finishAssignment(interaction, guild, tournament.name, assignRole, "Every Discord ID column", loaded.targets);
}

export function isTournamentRoleButton(customId: string): boolean {
  return customId.startsWith(`${ROLE_CONFIRM_PREFIX}:`);
}
