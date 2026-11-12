import type { GuideBook } from "./types.js";

export const ticketGuides: GuideBook = {
  "ticket close": {
    where: "Only inside a ticket channel.",
    steps: [
      "In a battle ticket: players can still read but can no longer write, and the channel moves to the closed category.",
      "In a validation ticket: the transcript is saved and the channel is deleted after **5** seconds.",
    ],
    notes: [
      "A closed battle ticket can be reopened with {/ticket reopen}. A validation ticket cannot.",
      "It does not report a score. Use {/bracket upload} to report and close in one step.",
    ],
    related: ["ticket reopen", "bracket upload"],
  },
  "ticket reopen": {
    where: "Only inside a closed battle ticket.",
    steps: [
      "Run it in the closed ticket.",
      "Players can write again and the channel goes back to its open category, or the next one with space.",
    ],
    notes: ["The bracket is not touched."],
    related: ["ticket close", "ticket delete"],
  },
  "ticket delete": {
    where: "Only inside a ticket channel.",
    steps: [
      "Run it in the ticket.",
      "The channel is deleted and unlinked from its match.",
    ],
    notes: [
      "It cannot be undone, and no transcript is saved.",
      "The match can get a new ticket with {/room create}.",
      "The bracket is not touched.",
    ],
    related: ["ticket close", "room create"],
  },
  "ticket transcript": {
    where: "Only inside a battle ticket, open or closed.",
    steps: [
      "Run it in the ticket.",
      "A new transcript of the channel as it is now goes to the tournament transcript channel.",
      "The old transcript posts are deleted, and the result posts and the {/bracket upload} card point to the new one.",
    ],
    notes: [
      "If the new transcript cannot be published, nothing old is removed.",
      "The bracket and the ticket state are not touched.",
    ],
    related: ["bracket upload", "ticket close"],
  },
};
