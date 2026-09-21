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

function rowLabel(row: PlayerRow): string {
  if (row.member) {
    const team = row.teamName ? `**${row.teamName}** · ` : "";
    return `> ${team}${formatUser(row.member.id)}`;
  }
  const who = row.player.gameName || row.player.discordTag || row.player.gameId || "Unknown player";
  const team = row.teamName ? `**${row.teamName}** · ` : "";
  const id = row.player.discordId ? ` · \`${row.player.discordId}\`` : "";
  return `> ${team}**${who}**${id}`;
}

function listedBlock(rows: PlayerRow[]): string {
  const shown = rows.slice(0, MAX_SHOWN);
  const extra = rows.length - shown.length;
  const more = extra > 0 ? `\n*And **${extra}** more.*` : "";
  return `${shown.map(rowLabel).join("\n")}${more}`;
}

function roleResultMessage(
  tournamentName: string,
  role: Role,
  scope: string,
  buckets: RoleBuckets,
): InteractionReplyOptions {
  const containers: ContainerBuilder[] = [];

  if (buckets.assigned.length > 0) {
    const count = buckets.assigned.length;
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.success} Role granted`),
          textBlock(
            count === 1
              ? `Gave ${formatRoleFromRole(role)} to **1** player in **${tournamentName}** (${scope}).`
              : `Gave ${formatRoleFromRole(role)} to **${count}** players in **${tournamentName}** (${scope}).`,
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(listedBlock(buckets.assigned))),
    );
  }

  if (buckets.alreadyHad.length > 0) {
    const count = buckets.alreadyHad.length;
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.info} Already held the role`),
          textBlock(
            count === 1
              ? `**1** player already had ${formatRoleFromRole(role)}.`
              : `**${count}** players already had ${formatRoleFromRole(role)}.`,
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(listedBlock(buckets.alreadyHad))),
    );
  }

  if (buckets.notInServer.length > 0) {
    const count = buckets.notInServer.length;
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.members} Not in this server`),
          textBlock(
            count === 1
              ? "**1** player could not be found in this server."
              : `**${count}** players could not be found in this server.`,
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(listedBlock(buckets.notInServer))),
    );
  }

  if (buckets.invalidIds.length > 0) {
    const count = buckets.invalidIds.length;
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.error} Invalid Discord IDs`),
          textBlock(
            count === 1
              ? "**1** player has an empty or invalid Discord ID."
              : `**${count}** players have empty or invalid Discord IDs.`,
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(listedBlock(buckets.invalidIds))),
    );
  }

  if (buckets.banned.length > 0) {
    const count = buckets.banned.length;
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.banned} Banned players skipped`),
          textBlock(
            count === 1
              ? "**1** player is banned (Discord or official in-game ID) and did not receive the role."
              : `**${count}** players are banned (Discord or official in-game ID) and did not receive the role.`,
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(listedBlock(buckets.banned))),
    );
  }

  if (buckets.failed.length > 0) {
    const count = buckets.failed.length;
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.error} Could not update roles`),
          textBlock(
            count === 1
              ? "Discord rejected the role update for **1** player."
              : `Discord rejected the role update for **${count}** players.`,
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(listedBlock(buckets.failed))),
    );
  }

  if (containers.length === 0) {
    return tournamentErrorMessage("No players to role", `**${tournamentName}** has no players that could be processed.`, false);
  }

  return {
    components: containers,
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
    columnCount === 1
      ? "**1** Discord ID column"
      : `**${columnCount}** Discord ID columns (\`${format}\`)`;
  const players =
    playerCount === 1 ? "**1** player" : `**${playerCount}** players`;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ROLE_CONFIRM_PREFIX}:ok:${userId}:${tournamentId}:${role.id}`)
      .setLabel("Confirm all players")
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
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.error} Confirm role for every player`),
          textBlock(
            `You did not pick an **ID header**. Confirming gives ${formatRoleFromRole(role)} to **every player** in **${tournamentName}**, not one column.`,
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(
          textBlock(
            [
              `## ${emojis.info} What will happen`,
              `> I will scan ${columns} and try to grant the role to ${players}.`,
              `> Players already holding ${formatRoleFromRole(role)} are skipped.`,
              `> Invalid Discord IDs, people not in this server, and banned players (Discord ban or official in-game ID) are skipped.`,
              `> This cannot be undone from the bot: you would have to remove the role yourself.`,
            ].join("\n"),
          ),
        )
        .addSeparatorComponents(divider())
        .addActionRowComponents(row),
    ],
    allowedMentions: { parse: [] },
  };
}

function cancelledMessage(guild: Guild, tournamentName: string, roleId: string): InteractionReplyOptions {
  return {
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.info} Role assignment cancelled`),
          textBlock(
            `${formatRole(guild, roleId)} was **not** given to anyone in **${tournamentName}**. Pick an **ID header** if you only want one Discord ID column.`,
          ),
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

  await respondTournament(interaction, roleResultMessage(tournamentName, role, scope, buckets));

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
    const cancelled = cancelledMessage(guild, tournament?.name ?? "this tournament", roleId);
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
