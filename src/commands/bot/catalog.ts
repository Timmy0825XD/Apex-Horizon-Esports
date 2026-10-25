export type HelpEntry = {
  slash: string;
  summary: string;
  access: string;
};

export type HelpCategory = {
  title: string;
  description: string;
  entries: HelpEntry[];
};

export const helpCatalog: HelpCategory[] = [
  {
    title: "Bot",
    description: "Diagnostics, identity, and the command map.",
    entries: [
      { slash: "bot ping", summary: "Check WebSocket, command, and database latency.", access: "Admin, Organiser, or Helper" },
      { slash: "bot about", summary: "Bot identity and runtime health.", access: "Admin, Organiser, or Helper" },
      { slash: "bot help", summary: "Command map by section and who can use each one.", access: "Admin, Organiser, Helper, or Staff" },
    ],
  },
  {
    title: "Settings",
    description: "Server-layer roles, schedules, thumbnails, bans, and audit channels.",
    entries: [
      { slash: "settings set", summary: "First-time server roles and log channels. All fields required.", access: "Discord Administrator" },
      { slash: "settings edit", summary: "Change a configured role or channel.", access: "Admin or Organiser" },
      { slash: "settings show", summary: "Review whether roles and channels still exist.", access: "Admin or Organiser" },
    ],
  },
  {
    title: "Staff",
    description: "Hierarchy, recruiting, and payroll board.",
    entries: [
      { slash: "staff config set", summary: "Define staff roles and coordination channels.", access: "Admin" },
      { slash: "staff config edit", summary: "Patch the staff hierarchy or channels.", access: "Admin" },
      { slash: "staff config view", summary: "Read the configured staff roles and channels.", access: "Admin" },
      { slash: "staff recruit", summary: "Grant a staff role package and welcome the member.", access: "Admin or Organiser" },
      { slash: "staff fire", summary: "Remove a staff post or every configured staff role.", access: "Admin or Organiser" },
      { slash: "staff work", summary: "Tournament payroll board from attendance.", access: "Admin, Organiser, Helper, or Staff" },
    ],
  },
  {
    title: "Tournament",
    description: "Register and maintain a tournament world.",
    entries: [
      { slash: "tournament add", summary: "Register a tournament. Blocks if any in-game ID is on the official banned list.", access: "Admin or Organiser" },
      { slash: "tournament edit", summary: "Patch that tournament world.", access: "Admin or Organiser" },
      { slash: "tournament delete", summary: "Wipe bot records for a tournament. Keeps the stored sheet as history.", access: "Admin or Organiser" },
      { slash: "tournament info", summary: "Show one tournament.", access: "Admin or Organiser" },
      { slash: "tournament list", summary: "List tournaments in this server.", access: "Admin or Organiser" },
      { slash: "tournament report", summary: "Export attendance, staff work, results, and setup as a workbook.", access: "Organiser" },
      { slash: "tournament role", summary: "Give a Discord role by Discord ID column, or to every player after confirmation.", access: "Organiser" },
      { slash: "tournament validate", summary: "Open a ticket for each team that is missing the verified role or is not in the server.", access: "Organiser" },
    ],
  },
  {
    title: "Sheet",
    description: "The Google Sheet is the source of truth for who plays.",
    entries: [
      { slash: "sheet add", summary: "Archive one sheet (link + name) or several via CSV into the global player search.", access: "Admin" },
      { slash: "sheet get", summary: "Get a stored sheet link by name, or export every tournament sheet as CSV.", access: "Admin or Organiser" },
      { slash: "sheet find_player", summary: "Search every stored sheet across all servers.", access: "Admin or Organiser" },
      { slash: "sheet validate", summary: "Quality-check a sheet before creating a tournament.", access: "Admin or Organiser" },
      { slash: "team info", summary: "Look up a player by Discord user or alias (game ID, name, or Discord ID).", access: "Public" },
      { slash: "team list", summary: "Publish every team in a tournament.", access: "Organiser" },
      { slash: "utility discord_tag", summary: "Turn pasted Discord IDs into usernames for the sheet.", access: "Admin or Organiser" },
    ],
  },
  {
    title: "Room",
    description: "Battle tickets from the bracket, scores, and corrections.",
    entries: [
      { slash: "auto_room", summary: "Turn automatic battle tickets on or off. Turning on opens matches that are ready now.", access: "Organiser" },
      { slash: "room create", summary: "Open pending battle tickets now. Optional group and round.", access: "Organiser" },
      { slash: "room available", summary: "Show matches that still need a battle ticket.", access: "Organiser" },
      { slash: "bracket upload", summary: "Report the official score inside a ticket.", access: "Tournament admin, helper, or Organiser" },
      { slash: "bracket dq_both", summary: "Disqualify both sides. Side 1 advances and forfeits the next match.", access: "Tournament admin, helper, or Organiser" },
      { slash: "bracket correct", summary: "Amend a posted score and rebuild lying rooms.", access: "Organiser" },
    ],
  },
  {
    title: "Schedule",
    description: "Match time, table staff, and public results.",
    entries: [
      { slash: "schedule create", summary: "Set the UTC time inside a ticket. Minimum +10 minutes.", access: "Tournament admin, helper, or Organiser" },
      { slash: "schedule update", summary: "Change time, judge, recorder, or note.", access: "Tournament admin, helper, or Organiser" },
      { slash: "schedule show", summary: "List schedules or open one match card. Any status, while the tournament still exists.", access: "Admin, Organiser, Helper, or Staff" },
      { slash: "schedule delete", summary: "Remove the active schedule. Not recoverable.", access: "Tournament admin, helper, or Organiser" },
      { slash: "schedule unassigned", summary: "List matches missing judge or recorder.", access: "Admin, Organiser, Helper, or Staff" },
      { slash: "schedule refresh", summary: "Renew claim buttons on a schedule from any channel.", access: "Organiser, Helper, Staff, Judge, or Recorder" },
      { slash: "schedule resign", summary: "Leave judge, recorder, or both.", access: "Assigned staff" },
      { slash: "schedule results", summary: "Public result in the ticket and the result channel. Does not advance the bracket.", access: "Judge" },
      { slash: "schedule results_delete", summary: "Remove that public result. Does not undo bracket upload.", access: "Judge" },
    ],
  },
  {
    title: "Attendance",
    description: "Attendance, links, and work tracking for matches.",
    entries: [
      { slash: "attendance mark", summary: "Record match attendance and scores inside the ticket.", access: "Judge / Recorder" },
      { slash: "attendance delete", summary: "Soft-delete the attendance in this ticket.", access: "Creator or Organiser" },
      { slash: "attendance report", summary: "Salary card for one person. Default wins included.", access: "Own card: staff roles or Helper. Another person: Admin or Organiser" },
      { slash: "get attendance", summary: "View a user's attendance records.", access: "Staff, Judge, Recorder, Helper, Admin, or Organiser" },
      { slash: "get sheet", summary: "Export attendance and work statistics. Rates follow the stored format.", access: "Organiser" },
      { slash: "link add", summary: "Attach a recording link to a match.", access: "Recorder of that attendance" },
      { slash: "link delete", summary: "Remove every recording link from a match.", access: "Recorder, Admin, or Organiser" },
      { slash: "link missing", summary: "Pending links for a tournament, or for one person.", access: "Staff of the tournament" },
    ],
  },
  {
    title: "Ticket",
    description: "Close, reopen, or delete the match channel. Not the bracket.",
    entries: [
      { slash: "ticket close", summary: "Silence a battle ticket. A validation ticket is transcribed and removed.", access: "Organiser" },
      { slash: "ticket reopen", summary: "Restore permissions and the original category when known.", access: "Organiser" },
      { slash: "ticket delete", summary: "Destroy the channel and forget the match link.", access: "Organiser" },
    ],
  },
  {
    title: "Role",
    description: "Discord roles, not tournament staff posts.",
    entries: [
      { slash: "role user", summary: "Toggle one role on one member.", access: "Organiser" },
      { slash: "role add all", summary: "Add a role to every eligible member.", access: "Admin" },
      { slash: "role remove all", summary: "Remove a role from every member who has it.", access: "Admin" },
      { slash: "role list", summary: "List or export members of a role.", access: "Organiser" },
    ],
  },
  {
    title: "Server",
    description: "Server snapshot, bans, channel tree, and invites.",
    entries: [
      { slash: "server info", summary: "Live server statistics.", access: "Admin or Organiser" },
      { slash: "server banlist", summary: "Export banned Discord IDs, dates, and reasons as .txt or Excel.", access: "Organiser" },
      { slash: "server tree", summary: "Export the category and channel tree as .txt or Excel.", access: "Organiser" },
      { slash: "server invites", summary: "Export active invites and vanity uses as .txt or Excel.", access: "Organiser" },
      { slash: "user ban", summary: "Ban a Discord ID for a set duration.", access: "Organiser" },
      { slash: "user unban", summary: "Remove a tracked ban.", access: "Organiser" },
    ],
  },
  {
    title: "Utility",
    description: "Cleanup, UTC clock, embeds, Components V2, and small server tools.",
    entries: [
      { slash: "utility clear_category", summary: "Delete every channel under a category (confirmation).", access: "Admin" },
      { slash: "utility clear", summary: "Purge messages in the current channel.", access: "Admin" },
      { slash: "utility emoji_steal", summary: "Remove a custom emoji and show its image.", access: "Admin" },
      { slash: "utility random", summary: "Pick from a list of options.", access: "Public" },
      { slash: "utility utc", summary: "Build a UTC timestamp the same way schedules do.", access: "Public" },
      { slash: "utility discord_tag", summary: "Turn pasted Discord IDs into usernames for the sheet.", access: "Admin or Organiser" },
      { slash: "utility avatar", summary: "Show a user's avatar.", access: "Public" },
      { slash: "utility toss", summary: "Coin flip.", access: "Public" },
      { slash: "utility enlarge", summary: "Show an emoji at full size.", access: "Public" },
      { slash: "utility embed", summary: "Interactive embed builder.", access: "Admin or Organiser" },
      { slash: "utility edit_embed", summary: "Rewrite an embed posted by the bot.", access: "Admin or Organiser" },
      { slash: "utility v2", summary: "Interactive Components V2 builder.", access: "Admin or Organiser" },
      { slash: "utility edit_v2", summary: "Rewrite a Components V2 message posted by the bot.", access: "Admin or Organiser" },
    ],
  },
];
