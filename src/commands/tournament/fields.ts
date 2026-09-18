import type { TeamFormat } from "../../lib/sheet.js";

export {
  PLAYER_FIELDS,
  TEAM_FORMATS,
  canonicalHeaders,
  coreColumnCount,
  detectSheetLayout,
  formatPlayerCount,
  hasLeadingTeamName,
  isTeamFormat,
  playerBlockStart,
  playerSlotLabel,
  type PlayerFieldKey,
  type TeamFormat,
} from "../../lib/sheet.js";

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
