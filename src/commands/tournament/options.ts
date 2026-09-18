import type { ChatInputCommandInteraction } from "discord.js";
import {
  optionalCategoryFields,
  optionalTextChannelFields,
  requiredCategoryFields,
  roleFields,
  textChannelFields,
  type TournamentWorld,
} from "./fields.js";

function requiredChannelId(interaction: ChatInputCommandInteraction, name: string): string {
  return interaction.options.getChannel(name, true).id;
}

function optionalChannelId(interaction: ChatInputCommandInteraction, name: string): string | undefined {
  return interaction.options.getChannel(name)?.id;
}

export function readCreateWorld(
  interaction: ChatInputCommandInteraction,
    extras: { name: string; challongeId: string; sheetLink: string; format: TournamentWorld["format"]; additionalFieldCount: number },
): Omit<TournamentWorld, "autoRoomRunning"> {
  const open = [
    requiredChannelId(interaction, "ticket_open_category_1"),
    requiredChannelId(interaction, "ticket_open_category_2"),
    optionalChannelId(interaction, "ticket_open_category_3"),
    optionalChannelId(interaction, "ticket_open_category_4"),
  ].filter((id): id is string => Boolean(id));

  return {
    name: extras.name,
    challongeId: extras.challongeId,
    sheetLink: extras.sheetLink,
    format: extras.format,
    additionalFieldCount: extras.additionalFieldCount,
    adminRoleId: interaction.options.getRole("admin_role", true).id,
    helperRoleId: interaction.options.getRole("helper_role", true).id,
    attendanceChannelId: requiredChannelId(interaction, "attendance_channel"),
    transcriptChannelId: requiredChannelId(interaction, "transcript_channel"),
    rulesChannelId: requiredChannelId(interaction, "rules_channel"),
    deadlineChannelId: requiredChannelId(interaction, "deadline_channel"),
    resultChannelId: requiredChannelId(interaction, "result_channel"),
    eventsLinksChannelId: optionalChannelId(interaction, "events_links") ?? null,
    closedTicketCategoryId: requiredChannelId(interaction, "closed_ticket_category"),
    closeTicketCategory2Id: optionalChannelId(interaction, "close_ticket_category_2") ?? null,
    ticketOpenCategoryIds: open,
    autoRoomCapable: interaction.options.getBoolean("auto_room_creation", true),
  };
}

export type WorldPatch = Partial<
  Omit<TournamentWorld, "challongeId" | "format" | "ticketOpenCategoryIds" | "autoRoomRunning">
> & {
  ticketOpenCategory1Id?: string;
  ticketOpenCategory2Id?: string;
  ticketOpenCategory3Id?: string;
  ticketOpenCategory4Id?: string;
  key?: string;
};

export function readWorldPatch(interaction: ChatInputCommandInteraction): WorldPatch {
  const patch: WorldPatch = {};
  const name = interaction.options.getString("name");
  if (name) {
    patch.name = name.trim();
  }
  const key = interaction.options.getString("key");
  if (key) {
    patch.key = key.trim();
  }
  const sheetLink = interaction.options.getString("sheet_link");
  if (sheetLink) {
    patch.sheetLink = sheetLink.trim();
  }

  for (const field of roleFields) {
    const role = interaction.options.getRole(field.option);
    if (role) {
      patch[field.key] = role.id;
    }
  }

  for (const field of textChannelFields) {
    const channel = interaction.options.getChannel(field.option);
    if (channel) {
      patch[field.key] = channel.id;
    }
  }

  for (const field of optionalTextChannelFields) {
    const channel = interaction.options.getChannel(field.option);
    if (channel) {
      patch[field.key] = channel.id;
    }
  }

  for (const field of requiredCategoryFields) {
    const channel = interaction.options.getChannel(field.option);
    if (!channel) {
      continue;
    }
    if (field.key === "ticketOpenCategory1Id") {
      patch.ticketOpenCategory1Id = channel.id;
    } else if (field.key === "ticketOpenCategory2Id") {
      patch.ticketOpenCategory2Id = channel.id;
    } else {
      patch[field.key] = channel.id;
    }
  }

  for (const field of optionalCategoryFields) {
    const channel = interaction.options.getChannel(field.option);
    if (!channel) {
      continue;
    }
    if (field.key === "ticketOpenCategory3Id") {
      patch.ticketOpenCategory3Id = channel.id;
    } else if (field.key === "ticketOpenCategory4Id") {
      patch.ticketOpenCategory4Id = channel.id;
    } else {
      patch.closeTicketCategory2Id = channel.id;
    }
  }

  const autoRoom = interaction.options.getBoolean("auto_room_creation");
  if (autoRoom != null) {
    patch.autoRoomCapable = autoRoom;
  }

  return patch;
}

export function mergeWorld(current: TournamentWorld, patch: WorldPatch): TournamentWorld {
  const open = [...current.ticketOpenCategoryIds];
  if (patch.ticketOpenCategory1Id) {
    open[0] = patch.ticketOpenCategory1Id;
  }
  if (patch.ticketOpenCategory2Id) {
    open[1] = patch.ticketOpenCategory2Id;
  }
  if (patch.ticketOpenCategory3Id) {
    open[2] = patch.ticketOpenCategory3Id;
  }
  if (patch.ticketOpenCategory4Id) {
    open[3] = patch.ticketOpenCategory4Id;
  }

  const autoRoomCapable = patch.autoRoomCapable ?? current.autoRoomCapable;

  return {
    ...current,
    name: patch.name ?? current.name,
    sheetLink: patch.sheetLink ?? current.sheetLink,
    adminRoleId: patch.adminRoleId ?? current.adminRoleId,
    helperRoleId: patch.helperRoleId ?? current.helperRoleId,
    attendanceChannelId: patch.attendanceChannelId ?? current.attendanceChannelId,
    transcriptChannelId: patch.transcriptChannelId ?? current.transcriptChannelId,
    rulesChannelId: patch.rulesChannelId ?? current.rulesChannelId,
    deadlineChannelId: patch.deadlineChannelId ?? current.deadlineChannelId,
    resultChannelId: patch.resultChannelId ?? current.resultChannelId,
    eventsLinksChannelId:
      patch.eventsLinksChannelId !== undefined ? patch.eventsLinksChannelId : current.eventsLinksChannelId,
    closedTicketCategoryId: patch.closedTicketCategoryId ?? current.closedTicketCategoryId,
    closeTicketCategory2Id:
      patch.closeTicketCategory2Id !== undefined ? patch.closeTicketCategory2Id : current.closeTicketCategory2Id,
    ticketOpenCategoryIds: open.filter((id): id is string => Boolean(id)),
    autoRoomCapable,
    autoRoomRunning: autoRoomCapable ? current.autoRoomRunning : false,
  };
}

export function changedWorldKeys(current: TournamentWorld, next: TournamentWorld): string[] {
  const keys: Array<keyof TournamentWorld> = [
    "name",
    "sheetLink",
    "format",
    "additionalFieldCount",
    "adminRoleId",
    "helperRoleId",
    "attendanceChannelId",
    "transcriptChannelId",
    "rulesChannelId",
    "deadlineChannelId",
    "resultChannelId",
    "eventsLinksChannelId",
    "closedTicketCategoryId",
    "closeTicketCategory2Id",
    "autoRoomCapable",
    "autoRoomRunning",
  ];

  const changed = keys.filter((key) => current[key] !== next[key]);
  if (current.ticketOpenCategoryIds.join(",") !== next.ticketOpenCategoryIds.join(",")) {
    changed.push("ticketOpenCategoryIds");
  }
  return changed;
}

export function duplicateIds(ids: Array<string | null | undefined>): boolean {
  const filled = ids.filter((id): id is string => Boolean(id));
  return new Set(filled).size !== filled.length;
}
