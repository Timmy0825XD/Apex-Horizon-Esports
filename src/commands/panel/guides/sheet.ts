import type { GuideBook } from "./types.js";

export const sheetGuides: GuideBook = {
  "sheet add": {
    steps: [
      "Give one sheet with its link and a name, or several at once with a CSV file.",
      "The bot reads each sheet, detects its format, and stores a copy in the global archive.",
      "Its players can then be found with {/sheet find player}.",
    ],
    options: {
      "link name": "One sheet: its link and the tournament name. Use both together.",
      csv: "Several sheets: name in column 1, link in column 2, no header row, up to 40 rows.",
    },
    notes: [
      "This does **not** create a playable tournament. For that, use {/tournament add}.",
      "Do not mix the CSV with link and name.",
      "A link that is already archived is skipped.",
    ],
    related: ["sheet get", "sheet find player"],
  },
  "sheet get": {
    steps: [
      "Search a stored sheet by tournament name, or ask for the full list as CSV.",
      "You get the sheet link privately, or the CSV file.",
    ],
    options: {
      name: "Tournament name, picked from the archive of every server.",
      csv: "Turn it on to download every stored sheet with its link.",
    },
    notes: ["Use at least one option. Both together also work.", "It only reads. Nothing changes."],
    related: ["sheet find player", "sheet add"],
  },
  "sheet find player": {
    steps: [
      "Fill one or more ways to identify the player.",
      "The bot searches every stored sheet, from every server.",
      "You get one private card per player with each sheet they appear in.",
    ],
    options: {
      "game_id discord_id discord_tag player_name": "Any of them. With several, a match on any one counts.",
    },
    notes: [
      "`game_id` and `discord_id` take several IDs separated by spaces, like `123 456 789`.",
      "Every match is shown, over several private messages if needed. A very wide search also gets a CSV with all of them.",
      "It searches stored copies. For the live sheet of a running tournament, use {/team info}.",
      "It only reads. Nothing changes.",
    ],
    related: ["team info", "sheet get"],
  },
  "sheet validate": {
    steps: [
      "Paste the link of the sheet you plan to use.",
      "The bot checks every player row.",
      "You get a private summary and one block per type of problem, or **Sheet Passed**.",
    ],
    options: { sheet_link: "The Google Sheet to check. It must be visible to anyone with the link." },
    notes: [
      "Run it before {/tournament add} so the tournament registers at the first try.",
      "It does not store the sheet.",
      "Wrong usernames? {/utility discord tag} turns Discord IDs into usernames for the sheet.",
    ],
    related: ["tournament add", "utility discord tag"],
  },
  "team info": {
    steps: [
      "Pick the tournament and search by member or by alias.",
      "The bot reads the live sheet and shows each matching team.",
      "Every player shows their Discord, in-game name and ID, title, and if they are verified.",
    ],
    options: {
      tournament: "The tournament, picked from the list.",
      user: "A Discord member of the team.",
      alias: "A game ID, in-game name, or Discord ID.",
    },
    notes: [
      "Use at least one of user or alias. With both, the team must match both.",
      "*Not verified* means the player is in the server but lacks the verified role.",
      "Anyone can use it, so players can check their own team.",
    ],
    related: ["team list", "sheet find player"],
  },
  "team list": {
    steps: [
      "Pick the tournament.",
      "The bot posts one card per team in this channel, one after another, until all are posted.",
    ],
    options: { tournament: "The tournament, picked from the list." },
    notes: [
      "It reads the live sheet, so recent edits count.",
      "Big tournaments post many messages. Use a channel made for it.",
    ],
    related: ["team info", "tournament validate"],
  },
};
