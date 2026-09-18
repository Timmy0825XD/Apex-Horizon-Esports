import type { GuildSettings } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { StaffInput } from "./fields.js";

export type GuildStaffState = {
  settings: GuildSettings | null;
  staff: StaffInput | null;
};

type RawGuild = {
  staff?: Record<string, unknown>;
};

function asRawGuilds(raw: unknown): RawGuild[] {
  if (Array.isArray(raw)) {
    return raw as RawGuild[];
  }
  if (raw && typeof raw === "object") {
    return [raw as RawGuild];
  }
  return [];
}

async function repairLegacyStaffRulesChannel(guildId: string): Promise<void> {
  const raw = asRawGuilds(
    await prisma.guild.findRaw({
      filter: { guildId },
    }),
  );
  const staff = raw[0]?.staff;
  if (!staff) {
    return;
  }

  const rules = staff.staffRulesChannelId;
  const legacy = staff.staffInstructionsChannelId;
  if (typeof rules === "string" && rules.length > 0) {
    if (legacy != null) {
      await prisma.$runCommandRaw({
        update: "guilds",
        updates: [
          {
            q: { guildId },
            u: { $unset: { "staff.staffInstructionsChannelId": true } },
          },
        ],
      });
    }
    return;
  }

  if (typeof legacy !== "string" || legacy.length === 0) {
    return;
  }

  await prisma.$runCommandRaw({
    update: "guilds",
    updates: [
      {
        q: { guildId },
        u: {
          $set: { "staff.staffRulesChannelId": legacy },
          $unset: { "staff.staffInstructionsChannelId": true },
        },
      },
    ],
  });
}

function toStaffInput(staff: object): StaffInput {
  const row = staff as Record<string, string | null | undefined>;
  return {
    managerRoleId: row.managerRoleId ?? "",
    t1AdminRoleId: row.t1AdminRoleId ?? null,
    t2AdminRoleId: row.t2AdminRoleId ?? null,
    challongeModRoleId: row.challongeModRoleId ?? "",
    serverHelperRoleId: row.serverHelperRoleId ?? "",
    bestStaffRoleId: row.bestStaffRoleId ?? "",
    judgeRoleId: row.judgeRoleId ?? "",
    recorderRoleId: row.recorderRoleId ?? "",
    staffRoleId: row.staffRoleId ?? "",
    staffchatChannelId: row.staffchatChannelId ?? "",
    staffAnnouncementChannelId: row.staffAnnouncementChannelId ?? "",
    staffRulesChannelId: row.staffRulesChannelId || row.staffInstructionsChannelId || "",
    staffDetailsChannelId: row.staffDetailsChannelId ?? "",
  };
}

export async function loadGuildStaffState(guildId: string): Promise<GuildStaffState> {
  await repairLegacyStaffRulesChannel(guildId);

  const guild = await prisma.guild.findUnique({
    where: { guildId },
    select: { settings: true, staff: true },
  });
  return {
    settings: guild?.settings ?? null,
    staff: guild?.staff ? toStaffInput(guild.staff) : null,
  };
}

export async function saveStaffConfig(guildId: string, staff: StaffInput): Promise<StaffInput> {
  const guild = await prisma.guild.upsert({
    where: { guildId },
    create: { guildId, staff: staff as never },
    update: { staff: staff as never },
    select: { staff: true },
  });

  if (!guild.staff) {
    throw new Error("Staff config was not persisted");
  }
  return toStaffInput(guild.staff);
}
