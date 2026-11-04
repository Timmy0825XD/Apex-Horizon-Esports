import type { GuideBook } from "./types.js";

export const roleGuides: GuideBook = {
  "role user": {
    steps: [
      "Pick the member and the role.",
      "If they have it, it is removed. If not, it is given.",
    ],
    options: { target: "The member to update.", role: "The role to give or remove." },
    notes: [
      "You cannot manage someone with a role equal to or above yours.",
      "The role must be below the bot's role and yours.",
      "Staff posts go through {/staff recruit} and {/staff fire}, not here.",
    ],
    related: ["role list", "staff recruit"],
  },
  "role add all": {
    steps: [
      "Pick the role.",
      "The bot gives it to every member who does not have it yet, with a live progress bar.",
      "At the end you get how many were changed, already had it, or failed.",
    ],
    options: { role: "The role to give to everyone." },
    notes: [
      "It reaches the whole server. Double-check the role before running it.",
      "Big servers take a few minutes. Do not run it twice.",
      "If some fail, move the bot's role higher and run it again.",
    ],
    related: ["role remove all", "tournament role"],
  },
  "role remove all": {
    steps: [
      "Pick the role.",
      "The bot removes it from everyone who has it, with a live progress bar.",
      "At the end you get how many were changed or failed.",
    ],
    options: { role: "The role to remove from everyone." },
    notes: [
      "It cannot be undone in one step.",
      "Check who has it first with {/role list}.",
    ],
    related: ["role add all", "role list"],
  },
  "role list": {
    steps: [
      "Pick the role.",
      "You get a private count of the humans and bots who have it, and their mentions.",
    ],
    options: { role: "The role to look up." },
    notes: [
      "If the list is too long, it comes as a CSV file.",
      "It only reads. Nothing changes.",
    ],
    related: ["role user", "role remove all"],
  },
};
