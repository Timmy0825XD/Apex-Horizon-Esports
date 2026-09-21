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
      { slash: "bot ping", summary: "Check WebSocket, command, and database latency.", access: "Public" },
      { slash: "bot about", summary: "Bot identity and runtime health.", access: "Public" },
      { slash: "bot help", summary: "Command map by section and who can use each one.", access: "Public" },
    ],
  },
  {
    title: "Settings",
    description: "Server-layer roles, schedules, thumbnails, bans, and audit channels.",
    entries: [
      { slash: "settings set", summary: "First-time server roles and log channels. All fields required.", access: "Discord Administrator" },
      { slash: "settings edit", summary: "Change a configured role or channel.", access: "Admin" },
      { slash: "settings show", summary: "Review whether roles and channels still exist.", access: "Admin" },
    ],
  },
  {
    title: "Staff",
    description: "Hierarchy, recruiting, and payroll board.",
    entries: [
      { slash: "staff config set", summary: "Define staff roles and coordination channels.", access: "Admin" },
      { slash: "staff config edit", summary: "Patch the staff hierarchy or channels.", access: "Admin" },
      { slash: "staff config view", summary: "Read the configured staff roles and channels.", access: "Admin" },
      { slash: "staff recruit", summary: "Grant a staff role package and welcome the member.", access: "Discord Administrator" },
      { slash: "staff fire", summary: "Remove a staff post or every configured staff role.", access: "Discord Administrator" },
      { slash: "staff work", summary: "Tournament payroll board from attendance.", access: "Admin" },
    ],
  },
  {
    title: "Tournament",
    description: "Register and maintain a tournament world.",
    entries: [
      { slash: "tournament add", summary: "Register a tournament. Blocks if any in-game ID is on the official banned list.", access: "Admin" },
      { slash: "tournament edit", summary: "Patch that tournament world.", access: "Admin" },
      { slash: "tournament delete", summary: "Wipe bot records for a tournament. Keeps the stored sheet as history.", access: "Admin" },
      { slash: "tournament add_sheet", summary: "Archive one sheet (link + name) or several via CSV into the global player search.", access: "Admin" },
      { slash: "tournament get_sheet", summary: "Get a stored sheet link by name, or export every tournament sheet as CSV.", access: "Public" },
      { slash: "tournament find_player", summary: "Search every stored sheet across all servers.", access: "Public" },
      { slash: "tournament info", summary: "Show one tournament.", access: "Public" },
      { slash: "tournament list", summary: "List tournaments in this server.", access: "Public" },
      { slash: "tournament role", summary: "Give a Discord role by Discord ID column, or to every player after confirmation.", access: "Organiser" },
    ],
  },
  {
    title: "Sheet",
    description: "The Google Sheet is the source of truth for who plays.",
    entries: [
      { slash: "sheet headers", summary: "Show the column contract by format.", access: "Public" },
      { slash: "sheet validate", summary: "Quality-check a sheet before creating a tournament.", access: "Admin" },
      { slash: "team info", summary: "Look up a player by Discord user or alias (game ID, name, or Discord ID).", access: "Organiser" },
      { slash: "team list", summary: "Publish every team in a tournament.", access: "Organiser" },
      { slash: "utility discord_tag", summary: "Turn pasted Discord IDs into usernames for the sheet.", access: "Public" },
    ],
  },
  {
    title: "Room",
    description: "Tickets from the bracket, scores, and corrections.",
    entries: [
      { slash: "auto_room run", summary: "Turn automation on and open up to 25 eligible rooms.", access: "Organiser" },
      { slash: "auto_room stop", summary: "Stop scanning for new rooms. Open tickets stay.", access: "Organiser" },
      { slash: "auto_room toggle", summary: "Flip auto-room on or off.", access: "Organiser" },
      { slash: "room create", summary: "Open eligible rooms into a category, up to the limit.", access: "Organiser" },
      { slash: "room available", summary: "Show the queue of matches that could get a room now.", access: "Organiser" },
      { slash: "upload_score", summary: "Report the official score inside a ticket.", access: "Staff of the tournament" },
      { slash: "correct_bracket", summary: "Amend a posted score and rebuild lying rooms.", access: "Organiser" },
    ],
  },
  {
    title: "Schedule",
    description: "Match time, table staff, and public results.",
    entries: [
      { slash: "schedule create", summary: "Set the UTC time inside a ticket. Minimum +10 minutes.", access: "Staff of the tournament" },
      { slash: "schedule update", summary: "Change time, judge, recorder, or note.", access: "Staff of the tournament" },
      { slash: "schedule show", summary: "Ephemeral view of a schedule embed.", access: "Public" },
      { slash: "schedule delete", summary: "Remove the active schedule. Not recoverable.", access: "Staff of the tournament" },
      { slash: "schedule unassigned", summary: "List matches missing judge or recorder.", access: "Staff of the tournament" },
      { slash: "schedule refresh", summary: "Renew buttons and the post link.", access: "Staff of the tournament" },
      { slash: "schedule resign", summary: "Leave judge, recorder, or both.", access: "Assigned staff" },
      { slash: "schedule results", summary: "Public result with proof. Does not advance the bracket.", access: "Captain or staff" },
      { slash: "schedule results_delete", summary: "Remove that public result. Does not undo upload_score.", access: "Staff of the tournament" },
    ],
  },
  {
    title: "Attendance",
    description: "Attendance, links, and work tracking for matches.",
    entries: [
      { slash: "attendance mark", summary: "Record match attendance and scores.", access: "Judge / Recorder" },
      { slash: "attendance delete", summary: "Soft-delete an attendance record.", access: "Creator or Organiser" },
      { slash: "get attendance", summary: "View a user's attendance records.", access: "Staff of the tournament" },
      { slash: "get sheet", summary: "Export attendance and work statistics.", access: "Organiser" },
      { slash: "link add", summary: "Attach a recording link to a match.", access: "Recorder of that attendance" },
      { slash: "link delete", summary: "Remove every recording link from a match.", access: "Organiser / Admin" },
      { slash: "link missing", summary: "List matches that still need links.", access: "Staff of the tournament" },
      { slash: "work_done", summary: "View a user's work count and salary.", access: "Admin" },
    ],
  },
  {
    title: "Ticket",
    description: "Close, reopen, or delete the match channel. Not the bracket.",
    entries: [
      { slash: "ticket close", summary: "Silence the ticket and move it to closed.", access: "Organiser" },
      { slash: "ticket reopen", summary: "Restore permissions and the original category when known.", access: "Organiser" },
      { slash: "ticket delete", summary: "Destroy the channel and forget the match link.", access: "Organiser" },
    ],
  },
  {
    title: "Role",
    description: "Discord roles, not tournament staff posts.",
    entries: [
      { slash: "role user", summary: "Toggle one role on one member.", access: "Organiser" },
      { slash: "role add all", summary: "Add a role to every eligible member.", access: "Organiser" },
      { slash: "role remove all", summary: "Remove a role from every member who has it.", access: "Organiser" },
      { slash: "role list", summary: "List or export members of a role.", access: "Organiser" },
    ],
  },
  {
    title: "Server",
    description: "Server snapshot, bans, channel tree, and invites.",
    entries: [
      { slash: "server info", summary: "Live server statistics.", access: "Public" },
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
      { slash: "utility clear_category", summary: "Delete every channel under a category (confirmation).", access: "Discord Administrator" },
      { slash: "utility clear", summary: "Purge messages in the current channel.", access: "Manage Messages" },
      { slash: "utility emoji_steal", summary: "Remove a custom emoji and show its image.", access: "Manage Emojis" },
      { slash: "utility random", summary: "Pick from a list of options.", access: "Public" },
      { slash: "utility utc", summary: "Build a UTC timestamp the same way schedules do.", access: "Public" },
      { slash: "utility discord_tag", summary: "Turn pasted Discord IDs into usernames for the sheet.", access: "Public" },
      { slash: "utility avatar", summary: "Show a user's avatar.", access: "Public" },
      { slash: "utility toss", summary: "Coin flip.", access: "Public" },
      { slash: "utility enlarge", summary: "Show an emoji at full size.", access: "Public" },
      { slash: "utility embed", summary: "Interactive embed builder.", access: "Manage Messages" },
      { slash: "utility edit_embed", summary: "Rewrite an embed posted by the bot.", access: "Manage Messages" },
      { slash: "utility v2", summary: "Interactive Components V2 builder.", access: "Manage Messages" },
      { slash: "utility edit_v2", summary: "Rewrite a Components V2 message posted by the bot.", access: "Manage Messages" },
    ],
  },
];
