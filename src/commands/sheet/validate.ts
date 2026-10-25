import type { ChatInputCommandInteraction, Guild, GuildMember } from "discord.js";
import { formatRole, formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { playerSlotLabel, type ParsedSheet, type SheetPlayer, type SheetTeam } from "../../lib/sheet.js";
import { findBannedPlayers, type BannedPlayerHit } from "../tournament/banned-ids.js";
import { SheetError, loadParsedSheet } from "../tournament/sheet.js";
import { isSheetAdmin, requireSheetAdmin } from "./access.js";
import { deferSheet, respondSheet } from "./respond.js";
import { sheetErrorMessage, sheetValidateMessage, type SheetIssueKind, type SheetValidateReport } from "./view.js";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const DISCORD_EPOCH = 1420070400000n;
const MEMBER_FETCH_CHUNK = 100;

type PlayerRef = {
  teamName: string;
  slotLabel: string;
  discordId: string;
  discordTag: string;
  gameName: string;
  gameId: string;
};

type CommandIds = {
  tournamentCommandId?: string;
  utilityCommandId?: string;
};

function escapeDiscord(value: string): string {
  return value.replace(/[\\*_~`|]/g, (char) => `\\${char}`);
}

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function tagKey(value: string): string {
  return value.trim().replace(/^@+/, "").replace(/[\u200B-\u200D\uFEFF]/g, "").toLowerCase();
}

function gameKey(value: string): string {
  return value.replace(/[\s\u200B-\u200D\uFEFF]/g, "").toUpperCase();
}

function isHexGameId(value: string): boolean {
  return /^[0-9A-F]{8,16}$/.test(gameKey(value));
}

function snowflakeCreatedAt(id: string): number | null {
  if (!isSnowflake(id)) {
    return null;
  }
  return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
}

function refOf(team: SheetTeam, player: SheetPlayer): PlayerRef {
  return {
    teamName: team.teamName,
    slotLabel: playerSlotLabel(player.slot),
    discordId: player.discordId.trim(),
    discordTag: player.discordTag.trim(),
    gameName: player.gameName.trim(),
    gameId: player.gameId.trim(),
  };
}

function who(ref: PlayerRef, discordId = ref.discordId): string {
  const team = ref.teamName ? `**${escapeDiscord(ref.teamName)}** · ` : "";
  const person = isSnowflake(discordId)
    ? formatUser(discordId)
    : `**${escapeDiscord(ref.discordTag || ref.gameName || "Unknown player")}**`;
  return `> ${team}**${escapeDiscord(ref.slotLabel)}:** ${person}`;
}

function pushTag(map: Map<string, GuildMember[]>, key: string, member: GuildMember): void {
  if (!key) {
    return;
  }
  const list = map.get(key) ?? [];
  if (list.some((row) => row.id === member.id)) {
    return;
  }
  list.push(member);
  map.set(key, list);
}

function indexTags(guild: Guild): Map<string, GuildMember[]> {
  const map = new Map<string, GuildMember[]>();
  for (const member of guild.members.cache.values()) {
    pushTag(map, tagKey(member.user.username), member);
    if (member.user.discriminator && member.user.discriminator !== "0") {
      pushTag(map, tagKey(member.user.tag), member);
    }
  }
  return map;
}

async function loadKnownMembers(guild: Guild, ids: string[]): Promise<boolean> {
  let known = true;
  for (let i = 0; i < ids.length; i += MEMBER_FETCH_CHUNK) {
    const chunk = ids.slice(i, i + MEMBER_FETCH_CHUNK);
    try {
      await guild.members.fetch({ user: chunk });
    } catch {
      known = false;
    }
  }
  return known;
}

function duplicateLines(groups: Map<string, PlayerRef[]>, kind: "discord" | "game"): string[] {
  const lines: string[] = [];
  for (const [key, refs] of groups) {
    if (refs.length < 2) {
      continue;
    }
    const label = kind === "discord" && isSnowflake(key) ? formatUser(key) : `\`${escapeDiscord(key)}\``;
    const where = refs
      .slice(0, 4)
      .map((ref) => (ref.teamName ? `**${escapeDiscord(ref.teamName)}**` : `**${escapeDiscord(ref.slotLabel)}**`))
      .join(", ");
    const more = refs.length > 4 ? ", …" : "";
    lines.push(`> ${label} is on **${refs.length}** players (${where}${more}).`);
  }
  return lines;
}

function bannedLine(hit: BannedPlayerHit): string {
  return who(
    {
      teamName: hit.teamName,
      slotLabel: hit.slotLabel,
      discordId: hit.discordId,
      discordTag: hit.discordTag,
      gameName: hit.gameName,
      gameId: hit.gameId,
    },
    hit.discordId,
  ) + ` · \`${escapeDiscord(hit.gameId || "Unknown ID")}\``;
}

async function staffRoleIds(guildId: string): Promise<string[] | null> {
  const row = await prisma.guild.findUnique({
    where: { guildId },
    select: { staff: true },
  });
  if (!row?.staff) {
    return null;
  }
  return [row.staff.staffRoleId, row.staff.judgeRoleId, row.staff.recorderRoleId];
}

function collectReport(
  guild: Guild,
  parsed: ParsedSheet,
  banned: BannedPlayerHit[],
  membersKnown: boolean,
  fullRoster: boolean,
  roleIds: string[] | null,
): SheetValidateReport {
  const buckets = new Map<SheetIssueKind, string[]>();
  const add = (kind: SheetIssueKind, line: string) => {
    const list = buckets.get(kind) ?? [];
    list.push(line);
    buckets.set(kind, list);
  };

  if (banned.length > 0) {
    buckets.set("banned", banned.map(bannedLine));
  }

  const discordGroups = new Map<string, PlayerRef[]>();
  const gameGroups = new Map<string, PlayerRef[]>();
  const tags = fullRoster ? indexTags(guild) : new Map<string, GuildMember[]>();

  for (const team of parsed.teams) {
    for (const player of team.players) {
      const ref = refOf(team, player);
      if (ref.discordId) {
        const group = discordGroups.get(ref.discordId) ?? [];
        group.push(ref);
        discordGroups.set(ref.discordId, group);
      }
      const game = gameKey(ref.gameId);
      if (game) {
        const group = gameGroups.get(game) ?? [];
        group.push(ref);
        gameGroups.set(game, group);
      }

      if (!isHexGameId(ref.gameId)) {
        add("game-id", `${who(ref)} · in-game ID is missing or not 8–16 hex characters.`);
      }

      const sheetIdOk = isSnowflake(ref.discordId);
      let member = sheetIdOk ? (guild.members.cache.get(ref.discordId) ?? null) : null;
      let checkId = sheetIdOk ? ref.discordId : "";

      if (!sheetIdOk) {
        const key = tagKey(ref.discordTag);
        if (!key) {
          add("discord-id", `${who(ref)} · Discord ID is missing, and the sheet has no tag to look up.`);
        } else if (!fullRoster) {
          add("discord-id", `${who(ref)} · Discord ID is missing or invalid. The member list could not be fully loaded, so the tag was not used.`);
        } else {
          const matches = tags.get(key) ?? [];
          if (matches.length === 1 && matches[0]) {
            member = matches[0];
            checkId = member.id;
            add("discord-id", `${who(ref, checkId)} · sheet tag matched ${formatUser(checkId)}. Write that Discord ID on the sheet.`);
          } else if (matches.length === 0) {
            add("discord-id", `${who(ref)} · Discord ID is missing or invalid, and nobody in this server has that sheet tag.`);
          } else {
            add("discord-id", `${who(ref)} · Discord ID is missing or invalid, and **${matches.length}** members share that sheet tag.`);
          }
        }
      } else if (!member) {
        if (membersKnown) {
          add("membership", `${who(ref)} is not in this server.`);
        }
      }

      const current = member;
      if (current && sheetIdOk) {
        const sheetTag = tagKey(ref.discordTag);
        const username = tagKey(current.user.username);
        const legacy =
          current.user.discriminator && current.user.discriminator !== "0" ? tagKey(current.user.tag) : "";
        if (!sheetTag || (sheetTag !== username && sheetTag !== legacy)) {
          add("tag", `${who(ref)} · the sheet tag does not match their Discord username.`);
        }
      }

      if (current && roleIds) {
        const held = roleIds.filter((id) => current.roles.cache.has(id));
        if (held.length > 0) {
          add("staff-role", `${who(ref, checkId || ref.discordId)} has ${held.map((id) => formatRole(guild, id)).join(", ")}.`);
        }
      }

      const created = checkId ? snowflakeCreatedAt(checkId) : null;
      if (created != null && Date.now() - created <= MONTH_MS) {
        add("account-age", `${who(ref, checkId)} · Discord account is not older than **30 days**.`);
      }
    }
  }

  const discordDupes = duplicateLines(discordGroups, "discord");
  if (discordDupes.length > 0) {
    buckets.set("duplicate-discord", discordDupes);
  }
  const gameDupes = duplicateLines(gameGroups, "game");
  if (gameDupes.length > 0) {
    buckets.set("duplicate-game", gameDupes);
  }

  const order: SheetIssueKind[] = [
    "banned",
    "duplicate-discord",
    "duplicate-game",
    "discord-id",
    "game-id",
    "account-age",
    "staff-role",
    "membership",
    "tag",
  ];

  return {
    format: parsed.format,
    teams: parsed.teams.length,
    players: parsed.teams.reduce((sum, team) => sum + team.players.length, 0),
    staffConfigured: roleIds != null,
    buckets: order
      .filter((kind) => (buckets.get(kind)?.length ?? 0) > 0)
      .map((kind) => ({ kind, lines: buckets.get(kind) ?? [] })),
  };
}

export async function handleSheetValidate(
  interaction: ChatInputCommandInteraction,
  commandIds: CommandIds,
): Promise<void> {
  await deferSheet(interaction, true);

  const access = await requireSheetAdmin(interaction, "validate a sheet", { organiser: true });
  if (!isSheetAdmin(access)) {
    await respondSheet(interaction, access.error);
    return;
  }

  const link = interaction.options.getString("sheet_link", true).trim();
  let parsed: ParsedSheet;
  try {
    parsed = await loadParsedSheet(link);
  } catch (error) {
    const message = error instanceof SheetError ? error.message : "Unexpected error while reading that sheet.";
    await respondSheet(interaction, sheetErrorMessage("Could not read sheet", message));
    return;
  }

  let banned: BannedPlayerHit[];
  try {
    banned = await findBannedPlayers(parsed);
  } catch (error) {
    const message = error instanceof SheetError ? error.message : "The official banned-ID list could not be read.";
    await respondSheet(interaction, sheetErrorMessage("Could not check banned IDs", message));
    return;
  }

  const ids = [
    ...new Set(
      parsed.teams.flatMap((team) => team.players.map((player) => player.discordId.trim()).filter(isSnowflake)),
    ),
  ];
  const needsTagLookup = parsed.teams.some((team) =>
    team.players.some((player) => !isSnowflake(player.discordId.trim()) && tagKey(player.discordTag)),
  );
  const membersKnown = await loadKnownMembers(access.guild, ids);
  let fullRoster = access.guild.members.cache.size >= access.guild.memberCount && access.guild.memberCount > 0;
  if (needsTagLookup && !fullRoster) {
    try {
      await access.guild.members.fetch();
      fullRoster = true;
    } catch {
      fullRoster = false;
    }
  }

  const roleIds = await staffRoleIds(access.guild.id);
  const report = collectReport(access.guild, parsed, banned, membersKnown, fullRoster, roleIds);
  await respondSheet(interaction, sheetValidateMessage(report, commandIds));
}
