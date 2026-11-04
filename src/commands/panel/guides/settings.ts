import type { GuideBook } from "./types.js";

const settingsOptions = {
  "admin_role verified_role bracket_admin":
    "The bot admin role, the role verified members have, and the role that runs brackets server-wide.",
  "schedules_channel thumbnail_channel":
    "Where match schedules and their images are posted.",
  bans_channel: "The channel that follows the official ban posts. The bot turns each one into a card to decide.",
  "challonge_logs bot_logs": "Where the bot logs bracket actions and every other change.",
};

export const settingsGuides: GuideBook = {
  "settings set": {
    steps: [
      "Run it once when the bot joins a new server. Only a Discord Administrator can, because the bot admin role does not exist yet.",
      "Fill every role and channel. All of them are required the first time.",
      "The bot saves them and shows a panel with everything it stored.",
    ],
    options: settingsOptions,
    notes: [
      "Almost every other command needs this first. Without it there are no schedules, logs, or ban cards.",
      "If the server is already set up, use {/settings edit} instead.",
      "Channels must be text or announcement channels.",
    ],
    related: ["settings edit", "settings show", "staff config set"],
  },
  "settings edit": {
    steps: [
      "Run it with only the roles or channels you want to change.",
      "The bot saves the new values and marks them as *updated* in the panel.",
    ],
    options: settingsOptions,
    notes: [
      "Pick at least one value, and it has to be different from the saved one.",
      "It does not touch the staff roles. Those live in {/staff config edit}.",
    ],
    related: ["settings show", "settings set"],
  },
  "settings show": {
    steps: [
      "Run it in any channel.",
      "The bot lists the saved roles and channels and flags any that were deleted from the server.",
    ],
    notes: [
      "It only reads. Nothing changes.",
      "If something shows as *missing from this server*, fix it with {/settings edit}.",
    ],
    related: ["settings edit", "staff config view"],
  },
};
