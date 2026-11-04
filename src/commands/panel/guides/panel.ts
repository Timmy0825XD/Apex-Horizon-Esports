import type { GuideBook } from "./types.js";

export const panelGuides: GuideBook = {
  "panel tutorial": {
    where: "Guides are posted in the channel where you run it.",
    steps: [
      "Run it and a private panel opens.",
      "Pick a family, then the commands you want to explain. They add up in the queue.",
      "Press **Send** and the panel disappears. Each command is posted as its own guide, in queue order.",
    ],
    notes: [
      "Up to **15** guides per send.",
      "Deselect a command in the menu to take it out of the queue.",
      "The panel expires after **10 minutes** without use.",
    ],
    related: ["bot help"],
  },
  "panel tournament rules": {
    where: "The panel is posted in the channel where you run it.",
    steps: [
      "Pick the tournament and paste both rules links.",
      "The bot posts the panel with a button for each language.",
    ],
    options: {
      tournament: "The tournament whose name goes on the panel.",
      spanish: "Full link to the rules in Spanish.",
      english: "Full link to the rules in English.",
    },
    notes: ["Both links must start with `https://`.", "To change a link, post the panel again and delete the old one."],
    related: ["panel tournament bracket", "panel tournament deadline"],
  },
  "panel tournament bracket": {
    where: "The panel is posted in the channel where you run it.",
    steps: [
      "Pick the tournament and paste the YouTube link of the team shuffle.",
      "The bot reads the bracket link from Challonge and posts both as buttons.",
    ],
    options: {
      tournament: "The tournament whose bracket goes on the panel.",
      shuffle: "YouTube link of the recorded team shuffle.",
    },
    notes: [
      "The bracket link comes from the tournament's Challonge data. You do not paste it.",
      "Only `youtube.com` and `youtu.be` links are accepted for the shuffle.",
    ],
    related: ["panel tournament rules", "panel tournament deadline"],
  },
  "panel tournament deadline": {
    where: "The panel is posted in the channel where you run it.",
    steps: [
      "Pick the tournament and the participants role.",
      "A form opens. Write one round per line, like `10/10 - 14/10`.",
      "The bot numbers the rounds, posts the list and pings the role.",
    ],
    options: {
      tournament: "The tournament whose name goes on the panel.",
      role: "The participants role. It gets a real ping.",
    },
    notes: [
      "Rounds go in order and cannot overlap. A round that crosses into January moves to the next year.",
      "If the role is not mentionable, the bot needs **Mention All Roles** in that channel to ping it.",
      "Nothing is posted if a date is wrong. Fix it and run the command again.",
    ],
    related: ["panel tournament rules", "panel tournament bracket"],
  },
};
