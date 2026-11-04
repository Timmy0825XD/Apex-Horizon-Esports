import type { GuideBook } from "./types.js";

const worldOptions = {
  name: "The name everyone sees.",
  "id key": "The Challonge tournament ID and its API key. The key is stored encrypted.",
  sheet_link: "The Google Sheet with the players. It must be visible to anyone with the link.",
  "admin_role helper_role": "The admin and helper roles of **this** tournament.",
  "attendance_channel transcript_channel rules_channel deadline_channel result_channel":
    "Where attendance, ticket transcripts, rules, deadlines, and results go.",
  "closed_ticket_category ticket_open_category_1 ticket_open_category_2":
    "Categories for open battle tickets and for closed ones.",
  "close_ticket_category_2 ticket_open_category_3 ticket_open_category_4":
    "Extra categories for when the first ones fill up.",
  events_links: "Channel where recording links are shared publicly.",
};

const pickTournament = "The tournament, picked from the list.";

export const tournamentGuides: GuideBook = {
  "tournament add": {
    where: "Needs {/settings set} first. Up to **4** tournaments at a time.",
    steps: [
      "Fill the bracket, the sheet, the roles, and the channels.",
      "The bot checks the bracket and reads the sheet to detect the format (1vs1 to 5vs5).",
      "Every in-game ID is checked against the official ban list. If anyone is banned, nothing is registered.",
      "If all is fine, the tournament is saved and a copy of the sheet is stored.",
    ],
    options: worldOptions,
    notes: [
      "Check the sheet first with {/sheet validate}. It saves a failed attempt.",
      "Auto-room starts **off**. Turn it on with {/room auto} when you are ready.",
    ],
    related: ["tournament edit", "tournament info", "sheet validate"],
  },
  "tournament edit": {
    steps: [
      "Pick the tournament, then fill only what you want to change.",
      "The bot saves it and marks each changed value as *updated*.",
    ],
    options: { ...worldOptions, id: pickTournament },
    notes: [
      "A new sheet link replaces the stored copy and is checked against the ban list again.",
      "Auto-room is not touched here. Use {/room auto}.",
    ],
    related: ["tournament info", "tournament add"],
  },
  "tournament delete": {
    steps: [
      "Pick the tournament.",
      "The bot stops its automation and deletes its matches, rooms, schedules, and attendance.",
    ],
    options: { id: pickTournament },
    notes: [
      "Discord channels, the Google Sheet, and the Challonge bracket are left in place.",
      "The sheet copy becomes history and still shows up in {/sheet find player}.",
      "Attendance is deleted too, so export salaries with {/get sheet} before you delete.",
    ],
    related: ["tournament list", "get sheet"],
  },
  "tournament info": {
    steps: [
      "Pick the tournament.",
      "The bot shows its format, roles, channels, ticket categories, and who registered it.",
    ],
    options: { id: pickTournament },
    notes: [
      "It only reads. Nothing changes.",
      "Anything deleted from the server is flagged so you can fix it with {/tournament edit}.",
    ],
    related: ["tournament edit", "tournament list"],
  },
  "tournament list": {
    steps: [
      "Run it in any channel.",
      "You get a private list of the tournaments, how many of the 4 slots are used, and if auto-room is on.",
    ],
    notes: ["It only reads. Nothing changes."],
    related: ["tournament info", "tournament add"],
  },
  "tournament report": {
    steps: [
      "Pick the tournament.",
      "The bot reads the bracket at that moment and builds a workbook with seven sheets.",
      "You get a private summary with progress, records, and a **To do** list, plus the file.",
    ],
    options: { tournament: pickTournament },
    notes: [
      "**To do** lists what is still missing and which command fixes each item.",
      "If Challonge does not answer, the report uses the last saved matches and says so.",
      "It only reads. Nothing changes.",
    ],
    related: ["get sheet", "staff work"],
  },
  "tournament role": {
    steps: [
      "Pick the tournament and the role.",
      "Pick a Discord ID column to give it only to those players, or leave it empty for everyone.",
      "For everyone, the bot asks you to confirm first.",
      "You get one summary: who got it, who already had it, and who was skipped.",
    ],
    options: {
      tournament: pickTournament,
      role: "The Discord role to give.",
      id_header: "One Discord ID column of the sheet, for example only captains.",
    },
    notes: [
      "It reads the live sheet, so recent edits count.",
      "Banned players, players not in the server, and invalid IDs are skipped and listed.",
      "It cannot be undone in one step. To remove the role, use {/role remove all}.",
    ],
    related: ["tournament validate", "role remove all"],
  },
  "tournament validate": {
    steps: [
      "Pick the tournament, a category for tickets, and a channel for transcripts.",
      "The bot checks that every player is in the server and has the verified role.",
      "Each team with a problem gets a private ticket listing its issues.",
      "A summary is posted here with how many were checked, verified, and ticketed.",
    ],
    options: {
      tournament: pickTournament,
      category: "Where the validation tickets are created.",
      transcript_channel: "Where the transcript goes when a validation ticket is closed.",
      secondary_category: "Overflow category when the first one reaches 50 channels.",
    },
    notes: [
      "Teams that pass do not get a ticket.",
      "Close these tickets with {/ticket close}. It saves the transcript and deletes the channel.",
      "If nobody from a team is in the server, no ticket is created and the team is listed apart.",
    ],
    related: ["ticket close", "team info"],
  },
};
