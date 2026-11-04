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
};
