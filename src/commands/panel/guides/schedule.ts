import type { GuideBook } from "./types.js";

const pickMatch = "The match, picked from the list.";

export const scheduleGuides: GuideBook = {
  "schedule create": {
    where: "Only inside the match ticket. The schedules channel must be set in {/settings set}.",
    steps: [
      "Open the match ticket and run the command with the date and time in **UTC**.",
      "The bot posts the schedule in the ticket and in the schedules channel, and pings both captains.",
      "If a seat is still open, the staff chat gets a **New Schedule** alert so judges and recorders can claim it.",
    ],
    options: {
      "hour minute day month year": "The match time in UTC.",
      "judge recorder": "Pre-assign someone. They need the judge or recorder role.",
      remark: "Short note shown on the schedule, up to 130 characters.",
      notify: "Set it to false to skip the staff chat alert.",
    },
    notes: [
      "The time must be at least **10 minutes** from now.",
      "Always convert to UTC first. {/utility utc} helps if you are unsure.",
      "If a step cannot finish, you get a private **Finish manually** list with what is left.",
    ],
    related: ["schedule update", "schedule delete", "schedule unassigned"],
  },
  "schedule update": {
    where: "Only inside the match ticket.",
    steps: [
      "Fill only what changes: the time, the staff, or the note.",
      "The bot posts the updated schedule in the ticket and pings the captains and the assigned staff.",
      "A new time resets the reminders and redraws the image.",
    ],
    options: {
      "hour minute day month year": "Any part of the new UTC time. Parts you leave out are kept.",
      "judge recorder": "Assign or replace someone. They need the judge or recorder role.",
      note: "New note for the schedule.",
      "remove_judge remove_recorder": "Free a seat.",
      reason: "Why it changed. Shown in the log.",
      regenerate_image: "Redraw the schedule image with the current data.",
    },
    notes: [
      "The new time cannot be in the past or less than 10 minutes away.",
      "Once the match has a result or the ticket is closed, staff can no longer be assigned.",
      "Your answer is private. The ticket gets the public update.",
    ],
    related: ["schedule create", "schedule refresh"],
  },
  "schedule show": {
    steps: [
      "Run it alone to list every schedule, newest first, 5 per page.",
      "Filter by status, tournament, or staff member, or pick one match to open its card.",
    ],
    options: {
      match: "Open the full card of one match.",
      filter: "All, pending, past, or overdue (time passed without a result).",
      tour: "Only this tournament.",
      user: "Only matches where this person is judge or recorder.",
    },
    notes: [
      "Green means completed, gold pending, red overdue.",
      "Schedules of deleted tournaments do not show up.",
    ],
    related: ["schedule unassigned", "schedule results add"],
  },
  "schedule delete": {
    where: "Only inside the match ticket.",
    steps: [
      "Run it in the ticket and set confirm to true.",
      "The bot deletes the schedule and removes the 🔴 mark from the channel.",
    ],
    options: {
      confirm: "Must be true. False cancels without changing anything.",
      reason: "Why it was deleted. Shown in the log.",
    },
    notes: [
      "It cannot be recovered. To move the time, use {/schedule update} instead.",
      "The ticket stays open.",
    ],
    related: ["schedule create", "schedule update"],
  },
  "schedule unassigned": {
    steps: [
      "Run it in any channel.",
      "The bot lists upcoming matches with an open judge or recorder seat, 5 per page.",
    ],
    options: { filter: "Which seat is missing: either, both, only judge, or only recorder." },
    notes: [
      "Matches with a result or a closed ticket are left out.",
      "To push the staff to claim a seat again, use {/schedule refresh}.",
    ],
    related: ["schedule refresh", "schedule show"],
  },
  "schedule refresh": {
    steps: [
      "Pick the match. It works from any channel.",
      "The claim buttons on that schedule open again for **10 minutes**.",
      "You get a link to the schedule post.",
    ],
    options: { match: pickMatch },
    notes: [
      "Seats already taken stay closed.",
      "Only future matches without a result and with an open ticket can be refreshed.",
    ],
    related: ["schedule unassigned", "schedule update"],
  },
  "schedule resign": {
    where: "Only inside the match ticket, and only if you hold a seat on it.",
    steps: [
      "Pick the seat you leave: judge, recorder, or both.",
      "The bot frees it and announces it in the ticket so someone else can claim it.",
    ],
    options: {
      role: "The seat you leave.",
      reason: "Why you leave. Type a single dot if it is private.",
      regenerate_image: "Redraw the schedule image without you.",
    },
    notes: [
      "Resign as early as possible so the seat can be filled in time.",
      "Before resigning, ask in the staff chat if someone can take your place.",
    ],
    related: ["schedule refresh", "schedule unassigned"],
  },
  "schedule results add": {
    where: "Only inside the match ticket, after the scheduled time. Captains never declare.",
    steps: [
      "Run it in the ticket once the match is finished.",
      "Type both scores and attach the proof screenshots.",
      "The bot posts the result in the ticket and in the results channel, with a **Match Complete** ping to the captains.",
    ],
    options: {
      "team_1 team_2": "Score of each side, from 0 to 99.",
      notes: "Anything worth recording, up to 500 characters. Shows as **Remarks**.",
      "image1 image2 image3 image4 image5 image6 image7 image8 image9 image10": "Proof screenshots of the result.",
    },
    notes: [
      "The only draw allowed is `0 - 0`.",
      "One declaration per match. A wrong one must be deleted first.",
      "This does not update Challonge. That happens with {/bracket upload}.",
    ],
    related: ["schedule results delete", "bracket upload", "attendance mark"],
  },
  "schedule results delete": {
    where: "Only inside the match ticket.",
    steps: [
      "Run it in the ticket and set confirm to true.",
      "The bot removes the posted result so a new one can be declared.",
    ],
    options: {
      confirm: "Must be true. False cancels without changing anything.",
      reason: "Why it was removed. Shown in the log.",
    },
    notes: [
      "The schedule stays. Only the result goes.",
      "It does not undo a bracket upload. For that, ask an Organiser for {/bracket correct}.",
    ],
    related: ["schedule results add", "bracket correct"],
  },
};
