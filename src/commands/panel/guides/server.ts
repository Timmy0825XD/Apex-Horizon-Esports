import type { GuideBook } from "./types.js";

const excel = "Turn it on for an Excel file instead of a text file.";

export const serverGuides: GuideBook = {
  "server info": {
    steps: [
      "Run it in any channel.",
      "The bot shows the owner, age, members, channels, roles, and boosts of the server.",
    ],
    notes: ["It only reads. Nothing changes."],
    related: ["server tree", "server invites"],
  },
  "server banlist": {
    steps: [
      "Run it in any channel.",
      "You get a private file with every banned ID, the date, and the reason.",
    ],
    options: { excel },
    notes: [
      "A date shows as *Unknown* when neither the bot nor Discord kept it.",
      "To ban or unban someone, use {/user ban} or {/user unban}.",
    ],
    related: ["user ban", "user unban"],
  },
  "server tree": {
    steps: [
      "Run it in any channel.",
      "You get a private file with every category and its channels, in order.",
    ],
    options: { excel },
    notes: ["Threads are not included.", "It only reads. Nothing changes."],
    related: ["server info", "server invites"],
  },
  "server invites": {
    steps: [
      "Run it in any channel.",
      "You get a private file with every active invite: code, uses, channel, creator, and expiry.",
    ],
    options: { excel },
    notes: ["The vanity link and its uses are included if the server has one."],
    related: ["server info", "server tree"],
  },
  "user ban": {
    steps: [
      "Paste the Discord ID and pick how long the ban lasts.",
      "The bot bans the ID, even if the person is not in the server.",
      "Timed bans are lifted by the bot on their own when they expire.",
    ],
    options: {
      discord_id: "The numeric Discord ID, 17 to 20 digits.",
      time: "7 days, 1 month, 2 months, 6 months, or permanent.",
      reason: "Why. Shown on the card and in the log.",
    },
    notes: [
      "You cannot ban yourself, the owner, or a bot.",
      "If the ID is already banned, its duration is not changed.",
    ],
    related: ["user unban", "server banlist"],
  },
  "user unban": {
    steps: [
      "Paste the Discord ID.",
      "The bot lifts the ban and cancels any pending expiry.",
    ],
    options: { discord_id: "The numeric Discord ID." },
    notes: ["If Discord already lifted it, the bot only forgets the pending expiry."],
    related: ["user ban", "server banlist"],
  },
};
