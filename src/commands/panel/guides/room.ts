import type { GuideBook } from "./types.js";

const pickTournament = "The tournament, picked from the list.";

export const roomGuides: GuideBook = {
  "room auto": {
    steps: [
      "Pick the tournament and turn it on or off.",
      "Turning it on opens a battle ticket for every match that is ready right now.",
      "After that, the bot opens new tickets by itself at **00:00** and **12:00 UTC**.",
    ],
    options: { tournament: pickTournament, status: "On to start the automation, off to stop it." },
    notes: [
      "Turning it off does not close any ticket.",
      "If the bracket cannot be read, auto-room stays off.",
      "Need tickets before the next run? Use {/room create}.",
    ],
    related: ["room create", "room available"],
  },
  "room create": {
    steps: [
      "Pick the tournament, and a group or round if you only want those.",
      "The bot opens a battle ticket for every ready match that does not have one yet.",
      "A report is posted here: created, errors, waiting, and free category slots.",
    ],
    options: {
      tournament: pickTournament,
      group: "Only matches of this group.",
      round: "Only matches of this round.",
    },
    notes: [
      "It works with auto-room on or off and does not change it.",
      "**Issues** lists captains who are not in the server or have a wrong Discord ID in the sheet.",
      "If categories are full, add overflow ones with {/tournament edit}.",
    ],
    related: ["room available", "room auto"],
  },
  "room available": {
    steps: [
      "Pick the tournament.",
      "The bot posts the matches that are ready but still have no battle ticket.",
    ],
    options: { tournament: pickTournament },
    notes: [
      "It only reads. Open them with {/room create}.",
      "Matches blocked by a problem in the sheet are counted apart.",
    ],
    related: ["room create", "room auto"],
  },
  "bracket upload": {
    where: "Only inside the battle ticket.",
    steps: [
      "Type both scores, in the same order as the ticket's sides.",
      "The bot reports the score to Challonge and completes the match.",
      "The ticket is archived and a transcript of the whole chat is published.",
    ],
    options: {
      "score1 score2": "Final score of side 1 and side 2.",
      note: "A short note shown on the upload card.",
    },
    notes: [
      "Draws are not allowed.",
      "Check the score twice. Fixing it later needs {/bracket correct} from an Organiser.",
      "If Challonge accepted the score but archiving fails, you get a private note to finish it by hand.",
    ],
    related: ["bracket correct", "schedule results add", "bracket dq both"],
  },
  "bracket dq both": {
    where: "Only inside the battle ticket.",
    steps: [
      "Run it when both sides are disqualified.",
      "Side 1 advances on paper and side 2 is eliminated.",
      "Side 1 then loses its next match automatically, without a ticket.",
      "The ticket is archived and transcribed like an upload.",
    ],
    notes: [
      "It is not a normal win. Side 1 is only moved forward to keep the bracket working.",
      "If side 1's next rival is not known yet, the forfeit waits until it is.",
      "To undo it, an Organiser uses {/bracket correct}.",
    ],
    related: ["bracket upload", "bracket correct"],
  },
  "bracket correct": {
    steps: [
      "Pick the tournament and the match, then type the right score.",
      "If the winner stays the same, the score is fixed right away.",
      "If the winner changes and later matches already had tickets, you see what will be redone and must confirm.",
    ],
    options: {
      tournament: pickTournament,
      match: "The reported match to fix.",
      "score1 score2": "The correct score of side 1 and side 2.",
    },
    notes: [
      "Confirming deletes the later tickets and their schedules, and reopens those matches.",
      "Draws are not allowed.",
      "The old and new score stay in the log.",
    ],
    related: ["bracket upload", "room create"],
  },
};
