import type { GuideBook } from "./types.js";

const pickTournament = "The tournament, picked from the list.";

export const attendanceGuides: GuideBook = {
  "attendance mark": {
    where: "Only inside the match ticket, once the scheduled time has passed.",
    steps: [
      "Run it in the ticket after the match ends.",
      "Pick the judge and the recorder and type the score.",
      "The bot posts a green card in the ticket and in the attendance channel. If the result is already declared, the links are added to it too.",
    ],
    options: {
      "judge recorder": "The people who worked the match. They must have that role.",
      "team1_score team2_score": "Final score of each side. Draws are allowed here.",
      remark: "Choose DW for a default win. No recording is needed then.",
      link: "YouTube link of the recording. Add several separated by spaces.",
    },
    notes: [
      "This record is what counts towards staff pay.",
      "One attendance per match. To fix it, delete it and mark it again.",
      "Forgot the link? Add it later with {/link add} instead of marking again.",
    ],
    related: ["attendance delete", "link add", "attendance report"],
  },
  "attendance delete": {
    where: "Only inside the match ticket.",
    steps: [
      "Run it in the ticket and set confirm to true.",
      "The bot removes the attendance and its cards from the ticket and the attendance channel.",
    ],
    options: {
      confirm: "Must be true.",
      reason: "Why it was deleted. Shown on the card and in the log.",
    },
    notes: [
      "It stops counting towards salary.",
      "Only whoever marked it, an Admin, or an Organiser can delete it.",
      "Mark it again with {/attendance mark} if the data was wrong.",
    ],
    related: ["attendance mark", "get attendance"],
  },
  "attendance report": {
    steps: [
      "Pick the tournament, and a member if it is not for you.",
      "The bot posts the salary report: matches as judge, recorder, and both, and the total.",
      "Use the **GOLD** and **AC** buttons to switch the currency.",
    ],
    options: { tournament: pickTournament, user: "Whose report. Leave it empty for your own." },
    notes: [
      "Rates depend on the tournament format: per game in 4vs4 and 5vs5, per match in the rest.",
      "Default wins (DW) are included.",
      "Only an Admin or an Organiser can open someone else's report.",
    ],
    related: ["get attendance", "staff work", "get sheet"],
  },
  "get attendance": {
    steps: [
      "Pick the tournament and the member.",
      "The bot shows their attendance history, 5 per page, newest first.",
    ],
    options: { tournament: pickTournament, user: "The staff member to look up." },
    notes: [
      "Each record says if its recording link is there, missing, or not needed (DW).",
      "A missing link does not change the salary, but it should still be added with {/link add}.",
    ],
    related: ["attendance report", "link missing"],
  },
  "get sheet": {
    steps: [
      "Pick the tournament, the type, and whether default wins count.",
      "You get a private Excel workbook with attendance, work count, salary estimate, and tournament info.",
    ],
    options: {
      tournament: pickTournament,
      tournament_type: "The type of tournament. Rates still follow the saved format.",
      include_default_win_salary: "Whether default wins (DW) are paid.",
    },
    notes: [
      "Use it to pay the staff at the end of a tournament.",
      "Export it before {/tournament delete}, because deleting the tournament removes its attendance.",
    ],
    related: ["attendance report", "tournament report"],
  },
  "link add": {
    steps: [
      "Pick the tournament and the match, and paste the YouTube links.",
      "The bot adds them to the attendance card and to the declared result.",
    ],
    options: {
      tournament: pickTournament,
      match: "The match you recorded.",
      link: "One or more YouTube links separated by spaces.",
    },
    notes: [
      "Only the recorder of that attendance can add links.",
      "Up to **7** links per match. Repeated or invalid links are rejected.",
    ],
    related: ["link missing", "link delete"],
  },
  "link delete": {
    steps: [
      "Pick the tournament and the match.",
      "The bot removes every recording link from that attendance and its public posts.",
    ],
    options: { tournament: pickTournament, match: "The match whose links you remove." },
    notes: [
      "It removes all links at once. The recorder can upload the right ones again with {/link add}.",
      "If there were no links, nothing changes.",
    ],
    related: ["link add", "link missing"],
  },
  "link missing": {
    steps: [
      "Pick the tournament, and a recorder if you want only theirs.",
      "The bot lists every attendance still without a recording, 10 per page.",
    ],
    options: { tournament: pickTournament, user: "Only this recorder's pending links." },
    notes: [
      "Default wins (DW) are left out because they need no recording.",
      "Recorders: check it after every match day and add what is missing with {/link add}.",
    ],
    related: ["link add", "get attendance"],
  },
};
