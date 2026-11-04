import type { GuideBook } from "./types.js";

export const botGuides: GuideBook = {
  "bot ping": {
    steps: [
      "Run it in any channel.",
      "The bot measures its connection to Discord, its database, and how fast it answered you.",
      "The panel turns green, amber, or red depending on the slowest check.",
    ],
    notes: [
      "Green is under **200 ms**, amber under **500 ms**. Anything slower is red.",
      "Use it first when commands feel slow or do not answer.",
      "Right after a restart the Discord check may say *measuring* for a few seconds.",
    ],
    related: ["bot about", "bot help"],
  },
  "bot about": {
    steps: [
      "Run it in any channel.",
      "The bot shows who it is, how long it has been online, and the machine it runs on.",
    ],
    notes: [
      "It only reads information. Nothing changes in the server.",
      "Use the buttons at the bottom to jump to Help or Ping.",
    ],
    related: ["bot ping", "bot help"],
  },
  "bot help": {
    steps: [
      "Run it in any channel.",
      "Browse the sections with the arrows, or jump straight to one with the menu.",
      "Each command shows a short summary and who can use it. Click a command to fill it in.",
    ],
    notes: [
      "It is the quick map of the bot. For a full explanation of one command, ask an admin for its staff guide.",
      "Seeing a command here does not mean you can run it: check the line under it.",
    ],
    related: ["bot ping", "panel tutorial"],
  },
};
