export const TEAM_FORMATS = ["1vs1", "2vs2", "3vs3", "4vs4", "5vs5"] as const;

export type TeamFormat = (typeof TEAM_FORMATS)[number];

export const PLAYER_FIELDS = [
  { key: "discordTag", label: "Discord Tag" },
  { key: "discordId", label: "Discord ID" },
  { key: "gameName", label: "In-game name" },
  { key: "gameId", label: "In-game ID" },
  { key: "currentTitle", label: "Current Title" },
] as const;

export type PlayerFieldKey = (typeof PLAYER_FIELDS)[number]["key"];

export const roleFields = [
  { key: "adminRoleId", option: "admin_role", label: "Tournament Admin" },
  { key: "helperRoleId", option: "helper_role", label: "Tournament Helper" },
] as const;

export const textChannelFields = [
  { key: "attendanceChannelId", option: "attendance_channel", label: "Attendance Channel" },
  { key: "transcriptChannelId", option: "transcript_channel", label: "Transcript Channel" },
  { key: "rulesChannelId", option: "rules_channel", label: "Rules Channel" },
  { key: "deadlineChannelId", option: "deadline_channel", label: "Deadline Channel" },
  { key: "resultChannelId", option: "result_channel", label: "Result Channel" },
] as const;

export const optionalTextChannelFields = [
  { key: "eventsLinksChannelId", option: "events_links", label: "Events Links" },
] as const;

export const requiredCategoryFields = [
  { key: "closedTicketCategoryId", option: "closed_ticket_category", label: "Closed Tickets" },
  { key: "ticketOpenCategory1Id", option: "ticket_open_category_1", label: "Open Tickets 1" },
  { key: "ticketOpenCategory2Id", option: "ticket_open_category_2", label: "Open Tickets 2" },
] as const;

export const optionalCategoryFields = [
  { key: "closeTicketCategory2Id", option: "close_ticket_category_2", label: "Closed Tickets 2" },
  { key: "ticketOpenCategory3Id", option: "ticket_open_category_3", label: "Open Tickets 3" },
  { key: "ticketOpenCategory4Id", option: "ticket_open_category_4", label: "Open Tickets 4" },
] as const;

export type TournamentWorld = {
  name: string;
  challongeId: string;
  sheetLink: string;
  format: TeamFormat;
  additionalFieldCount: number;
  adminRoleId: string;
  helperRoleId: string;
  attendanceChannelId: string;
  transcriptChannelId: string;
  rulesChannelId: string;
  deadlineChannelId: string;
  resultChannelId: string;
  eventsLinksChannelId: string | null;
  closedTicketCategoryId: string;
  closeTicketCategory2Id: string | null;
  ticketOpenCategoryIds: string[];
  autoRoomCapable: boolean;
  autoRoomRunning: boolean;
};

export type TournamentRecord = TournamentWorld & {
  id: string;
  challongeKeyEnc: string;
  createdBy: string;
};

export function isTeamFormat(value: string): value is TeamFormat {
  return (TEAM_FORMATS as readonly string[]).includes(value);
}

export function formatPlayerCount(format: TeamFormat): number {
  return Number(format[0]);
}

export function playerSlotLabel(slot: number): string {
  return slot === 0 ? "Captain" : `Player ${slot + 1}`;
}

export function hasLeadingTeamName(format: TeamFormat): boolean {
  return format !== "1vs1";
}

export function playerBlockStart(format: TeamFormat): number {
  return hasLeadingTeamName(format) ? 1 : 0;
}

export function coreColumnCount(format: TeamFormat): number {
  return playerBlockStart(format) + formatPlayerCount(format) * PLAYER_FIELDS.length;
}

export function detectSheetLayout(columnCount: number): { format: TeamFormat; additionalFieldCount: number } | null {
  if (columnCount < PLAYER_FIELDS.length) {
    return null;
  }
  for (let i = TEAM_FORMATS.length - 1; i >= 0; i -= 1) {
    const format = TEAM_FORMATS[i];
    if (!format) {
      continue;
    }
    const core = coreColumnCount(format);
    if (columnCount >= core) {
      return { format, additionalFieldCount: columnCount - core };
    }
  }
  return null;
}

export function canonicalHeaders(format: TeamFormat): string[] {
  const headers: string[] = [];
  if (hasLeadingTeamName(format)) {
    headers.push("Team name");
  }
  const players = formatPlayerCount(format);
  for (let slot = 0; slot < players; slot += 1) {
    const prefix = playerSlotLabel(slot);
    for (const field of PLAYER_FIELDS) {
      headers.push(`${prefix} ${field.label}`);
    }
  }
  return headers;
}
