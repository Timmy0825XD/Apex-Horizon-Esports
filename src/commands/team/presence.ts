import { PermissionFlagsBits, type Guild, type GuildMember } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import type { SheetTeam } from "../../lib/sheet.js";
import type { PlayerPresence } from "./view.js";

const MEMBER_FETCH_CHUNK = 100;

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function fromMember(member: GuildMember, verifiedRoleId: string | undefined): PlayerPresence {
  return {
    avatarUrl: member.displayAvatarURL({ size: 256 }),
    inServer: true,
    validId: true,
    verified: Boolean(verifiedRoleId && member.roles.cache.has(verifiedRoleId)),
    banned: false,
  };
}

async function loadVerifiedRoleId(guildId: string): Promise<string | undefined> {
  const guild = await prisma.guild.findUnique({
    where: { guildId },
    select: { settings: true },
  });
  return guild?.settings?.verifiedRoleId || undefined;
}

function collectIds(teams: SheetTeam[]): string[] {
  return [
    ...new Set(teams.flatMap((team) => team.players.map((player) => player.discordId).filter((id) => isSnowflake(id)))),
  ];
}

export async function resolvePresence(guild: Guild, teams: SheetTeam[]): Promise<Map<string, PlayerPresence>> {
  const ids = collectIds(teams);
  const presence = new Map<string, PlayerPresence>();
  if (ids.length === 0) {
    return presence;
  }

  const verifiedRoleId = await loadVerifiedRoleId(guild.id);
  const missingMembers: string[] = [];
  for (const id of ids) {
    const member = guild.members.cache.get(id);
    if (member) {
      presence.set(id, fromMember(member, verifiedRoleId));
    } else {
      missingMembers.push(id);
    }
  }

  for (let i = 0; i < missingMembers.length; i += MEMBER_FETCH_CHUNK) {
    const chunk = missingMembers.slice(i, i + MEMBER_FETCH_CHUNK);
    await guild.members.fetch({ user: chunk }).catch(() => undefined);
    for (const id of chunk) {
      const member = guild.members.cache.get(id);
      if (member) {
        presence.set(id, fromMember(member, verifiedRoleId));
      }
    }
  }

  const notInServer = ids.filter((id) => !presence.get(id)?.inServer);
  if (notInServer.length > 0 && guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
    if (notInServer.length > 8) {
      const bans = await guild.bans.fetch().catch(() => null);
      if (bans) {
        for (const id of notInServer) {
          const ban = bans.get(id);
          if (!ban) {
            continue;
          }
          presence.set(id, {
            avatarUrl: ban.user.displayAvatarURL({ size: 256 }),
            inServer: false,
            validId: true,
            verified: false,
            banned: true,
          });
        }
      }
    } else {
      await Promise.all(
        notInServer.map(async (id) => {
          const cached = guild.bans.cache.get(id);
          const ban = cached ?? (await guild.bans.fetch(id).catch(() => null));
          if (!ban) {
            return;
          }
          presence.set(id, {
            avatarUrl: ban.user.displayAvatarURL({ size: 256 }),
            inServer: false,
            validId: true,
            verified: false,
            banned: true,
          });
        }),
      );
    }
  }

  const stillMissing = ids.filter((id) => !presence.has(id));
  const needFetch: string[] = [];
  for (const id of stillMissing) {
    const cached = guild.client.users.cache.get(id);
    if (cached) {
      presence.set(id, {
        avatarUrl: cached.displayAvatarURL({ size: 256 }),
        inServer: false,
        validId: true,
        verified: false,
        banned: false,
      });
    } else {
      needFetch.push(id);
    }
  }

  await Promise.all(
    needFetch.map(async (id) => {
      const user = await guild.client.users.fetch(id).catch(() => null);
      presence.set(
        id,
        user
          ? {
              avatarUrl: user.displayAvatarURL({ size: 256 }),
              inServer: false,
              validId: true,
              verified: false,
              banned: false,
            }
          : { inServer: false, validId: false, verified: false, banned: false },
      );
    }),
  );

  return presence;
}
