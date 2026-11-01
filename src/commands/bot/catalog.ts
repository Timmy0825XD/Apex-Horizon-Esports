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
    description: "Bot status, info, and this command list.",
    entries: [
      { slash: "bot ping", summary: "Check bot and database latency: WebSocket, command response, and database round trip.", access: "Admin, Organiser, or Helper" },
      { slash: "bot about", summary: "Show bot info and status: identity, uptime, memory, and version.", access: "Admin, Organiser, or Helper" },
      { slash: "bot help", summary: "List commands and who can use them, grouped by section.", access: "Admin, Organiser, Helper, or Staff" },
    ],
  },
  {
    title: "Settings",
    description: "Server roles, schedule and thumbnail channels, and log channels.",
    entries: [
      { slash: "settings set", summary: "Set up the server roles and log channels the bot needs. Every field is required the first time.", access: "Discord Administrator" },
      { slash: "settings edit", summary: "Change one configured role or channel without redoing the whole setup.", access: "Admin or Organiser" },
      { slash: "settings show", summary: "Check configured roles and channels and flag any that no longer exist.", access: "Admin or Organiser" },
    ],
  },
  {
    title: "Staff",
    description: "Staff hierarchy, recruiting, and the payroll board.",
    entries: [
      { slash: "staff config set", summary: "Set up staff roles and the staff coordination channels.", access: "Admin" },
      { slash: "staff config edit", summary: "Change one staff role or channel in the hierarchy.", access: "Admin" },
      { slash: "staff config view", summary: "Show the configured staff roles and channels.", access: "Admin" },
      { slash: "staff recruit", summary: "Give a member a staff role package and post their welcome in the staff chat.", access: "Admin or Organiser" },
      { slash: "staff fire", summary: "Remove one staff post from a member, or every configured staff role.", access: "Admin or Organiser" },
      { slash: "staff work", summary: "Post the tournament payroll board built from recorded attendance.", access: "Admin, Organiser, Helper, or Staff" },
    ],
  },
  {
    title: "Tournament",
    description: "Register and manage tournaments.",
    entries: [
      { slash: "tournament add", summary: "Register a tournament with its bracket, sheet, roles, and channels. Blocks if any in-game ID is officially banned.", access: "Admin or Organiser" },
      { slash: "tournament edit", summary: "Change a registered tournament's bracket, roles, channels, or ticket categories.", access: "Admin or Organiser" },
      { slash: "tournament delete", summary: "Remove a tournament and its bot records. The stored sheet stays as history.", access: "Admin or Organiser" },
      { slash: "tournament info", summary: "Show a tournament's setup: identity, roles, channels, and ticket categories.", access: "Admin or Organiser" },
      { slash: "tournament list", summary: "List every tournament registered in this server.", access: "Admin or Organiser" },
      { slash: "tournament report", summary: "Export the tournament workbook: attendance, staff work, results, and setup.", access: "Organiser" },
      { slash: "tournament role", summary: "Give a role to tournament players, by one Discord ID column or to everyone after confirming.", access: "Organiser" },
      { slash: "tournament validate", summary: "Open a ticket for each team with members missing the verified role or not in the server.", access: "Organiser" },
    ],
  },
  {
    title: "Sheet",
    description: "Player sheets decide who plays. Store, search, and check them.",
    entries: [
      { slash: "sheet add", summary: "Store a player sheet (link and name, or several via CSV) so its players show up in searches.", access: "Admin" },
      { slash: "sheet get", summary: "Get a stored sheet link by tournament name, or export every stored sheet as CSV.", access: "Admin or Organiser" },
      { slash: "sheet find_player", summary: "Find a player in every stored sheet, across all servers.", access: "Admin or Organiser" },
      { slash: "sheet validate", summary: "Check a player sheet for problems before you create a tournament with it.", access: "Admin or Organiser" },
      { slash: "team info", summary: "Show a team or player's details. Search by Discord user, game ID, name, or Discord ID.", access: "Public" },
      { slash: "team list", summary: "Post every team in a tournament, one panel per team.", access: "Organiser" },
      { slash: "utility discord_tag", summary: "Turn pasted Discord IDs into usernames, in the same order, ready for the sheet.", access: "Admin or Organiser" },
    ],
  },
  {
    title: "Room",
    description: "Battle tickets from the bracket, official scores, and corrections.",
    entries: [
      { slash: "auto_room", summary: "Turn automatic battle tickets on or off. Turning it on opens the matches that are ready now.", access: "Organiser" },
      { slash: "room create", summary: "Open pending battle tickets now, optionally for one group or round.", access: "Organiser" },
      { slash: "room available", summary: "List bracket matches that still have no battle ticket.", access: "Organiser" },
      { slash: "bracket upload", summary: "Report this match's official score to the bracket from inside its ticket.", access: "Tournament admin, helper, or Organiser" },
      { slash: "bracket dq_both", summary: "Disqualify both teams in this match. Side 1 advances and forfeits its next match.", access: "Tournament admin, helper, or Organiser" },
      { slash: "bracket correct", summary: "Fix a score already reported. Tickets of later matches that depended on it are redone after you confirm.", access: "Organiser" },
    ],
  },
  {
    title: "Schedule",
    description: "Match times, judge and recorder seats, and public results.",
    entries: [
      { slash: "schedule create", summary: "Schedule this match at a UTC time, at least 10 minutes ahead. Optionally assign judge and recorder.", access: "Tournament admin, helper, or Organiser" },
      { slash: "schedule update", summary: "Change this match's time, judge, recorder, or note, or regenerate its image.", access: "Tournament admin, helper, or Organiser" },
      { slash: "schedule show", summary: "View schedules and results, or open one match card while its tournament exists.", access: "Admin, Organiser, Helper, or Staff" },
      { slash: "schedule delete", summary: "Delete this match's schedule. It cannot be recovered.", access: "Tournament admin, helper, or Organiser" },
      { slash: "schedule unassigned", summary: "List schedules that still need a judge, a recorder, or both.", access: "Admin, Organiser, Helper, or Staff" },
      { slash: "schedule refresh", summary: "Reopen the judge and recorder buttons on a schedule for 10 minutes, from any channel.", access: "Organiser, Helper, Staff, Judge, or Recorder" },
      { slash: "schedule resign", summary: "Leave your judge or recorder seat (or both) on this match.", access: "Assigned staff" },
      { slash: "schedule results", summary: "Post this match's result in the ticket and the results channel. Does not update the bracket.", access: "Judge" },
      { slash: "schedule results_delete", summary: "Remove this match's posted result. Does not undo a bracket upload.", access: "Judge" },
    ],
  },
  {
    title: "Attendance",
    description: "Staff attendance, recording links, and salary.",
    entries: [
      { slash: "attendance mark", summary: "Record this match's staff, score, and video links from inside the ticket.", access: "Judge / Recorder" },
      { slash: "attendance delete", summary: "Remove this ticket's attendance. It stops counting toward salary.", access: "Creator or Organiser" },
      { slash: "attendance report", summary: "Salary report for one staff member in a tournament, default wins included.", access: "Own card: staff roles or Helper. Another person: Admin or Organiser" },
      { slash: "get attendance", summary: "Show a member's attendance history, page by page.", access: "Staff, Judge, Recorder, Helper, Admin, or Organiser" },
      { slash: "get sheet", summary: "Export attendance, work, and salary to Excel. Rates follow the tournament format.", access: "Organiser" },
      { slash: "link add", summary: "Add YouTube recording links to an attendance.", access: "Recorder of that attendance" },
      { slash: "link delete", summary: "Remove every recording link from an attendance.", access: "Recorder, Admin, or Organiser" },
      { slash: "link missing", summary: "List attendances missing a recording, for a tournament or one person.", access: "Staff of the tournament" },
    ],
  },
  {
    title: "Ticket",
    description: "Close, reopen, or delete the match channel. The bracket is not touched.",
    entries: [
      { slash: "ticket close", summary: "Close this battle ticket: players can no longer write. A validation ticket is transcribed and deleted.", access: "Organiser" },
      { slash: "ticket reopen", summary: "Reopen this ticket: restore chat access and move it back to its original category.", access: "Organiser" },
      { slash: "ticket delete", summary: "Delete this ticket channel and unlink it from its match.", access: "Organiser" },
    ],
  },
  {
    title: "Role",
    description: "Discord roles for members. Staff posts live under Staff.",
    entries: [
      { slash: "role user", summary: "Give or remove one role from one member.", access: "Organiser" },
      { slash: "role add all", summary: "Give a role to every eligible member of the server.", access: "Admin" },
      { slash: "role remove all", summary: "Remove a role from everyone who has it.", access: "Admin" },
      { slash: "role list", summary: "List a role's members, or export them when the list is too long.", access: "Organiser" },
    ],
  },
  {
    title: "Server",
    description: "Server stats, bans, channel tree, and invites.",
    entries: [
      { slash: "server info", summary: "Show live server stats.", access: "Admin or Organiser" },
      { slash: "server banlist", summary: "Export the ban list (Discord IDs, dates, and reasons) as .txt or Excel.", access: "Organiser" },
      { slash: "server tree", summary: "Export the category and channel tree as .txt or Excel.", access: "Organiser" },
      { slash: "server invites", summary: "Export active invites and vanity URL uses as .txt or Excel.", access: "Organiser" },
      { slash: "user ban", summary: "Ban a user ID for a set time or permanently.", access: "Organiser" },
      { slash: "user unban", summary: "Remove a user's ban tracked by the bot.", access: "Organiser" },
    ],
  },
  {
    title: "Utility",
    description: "Cleanup, UTC clock, message builders, and small tools.",
    entries: [
      { slash: "utility clear_category", summary: "Delete every channel in a category, after confirming.", access: "Admin" },
      { slash: "utility clear", summary: "Delete recent messages in this channel.", access: "Admin" },
      { slash: "utility emoji_steal", summary: "Remove a custom emoji from this server and show its image.", access: "Admin" },
      { slash: "utility random", summary: "Pick randomly from a list of options separated by commas, pipes, or new lines.", access: "Public" },
      { slash: "utility utc", summary: "Build a UTC timestamp the same way schedules read the time.", access: "Public" },
      { slash: "utility discord_tag", summary: "Turn pasted Discord IDs into usernames, in the same order, ready for the sheet.", access: "Admin or Organiser" },
      { slash: "utility avatar", summary: "Show a user's avatar, or your own.", access: "Public" },
      { slash: "utility toss", summary: "Flip a coin: heads or tails.", access: "Public" },
      { slash: "utility enlarge", summary: "Show a custom or standard emoji at full size.", access: "Public" },
      { slash: "utility embed", summary: "Build an embed step by step and post it.", access: "Admin or Organiser" },
      { slash: "utility edit_embed", summary: "Edit an embed the bot posted.", access: "Admin or Organiser" },
      { slash: "utility v2", summary: "Build a Components V2 message step by step and post it.", access: "Admin or Organiser" },
      { slash: "utility edit_v2", summary: "Edit a Components V2 message the bot posted.", access: "Admin or Organiser" },
    ],
  },
];
