import { attendanceGuides } from "./attendance.js";
import { botGuides } from "./bot.js";
import { panelGuides } from "./panel.js";
import { roleGuides } from "./role.js";
import { roomGuides } from "./room.js";
import { scheduleGuides } from "./schedule.js";
import { serverGuides } from "./server.js";
import { settingsGuides } from "./settings.js";
import { sheetGuides } from "./sheet.js";
import { staffGuides } from "./staff.js";
import { ticketGuides } from "./ticket.js";
import { tournamentGuides } from "./tournament.js";
import type { Guide, GuideBook } from "./types.js";
import { utilityGuides } from "./utility.js";

export type { Guide } from "./types.js";

const guides: GuideBook = {
  ...botGuides,
  ...settingsGuides,
  ...staffGuides,
  ...tournamentGuides,
  ...sheetGuides,
  ...roomGuides,
  ...scheduleGuides,
  ...attendanceGuides,
  ...ticketGuides,
  ...roleGuides,
  ...serverGuides,
  ...utilityGuides,
  ...panelGuides,
};

export function guideFor(slash: string): Guide | undefined {
  return guides[slash];
}
