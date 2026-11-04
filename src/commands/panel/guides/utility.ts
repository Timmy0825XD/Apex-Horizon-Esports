import type { GuideBook } from "./types.js";

const builderNotes = [
  "The builder is private and closes after **15 minutes** without changes.",
  "You can only have one draft open at a time.",
];

export const utilityGuides: GuideBook = {
  "utility clear category": {
    steps: [
      "Pick the category.",
      "The bot shows which channels will be deleted and asks you to confirm.",
      "After confirming, every channel in that category is deleted.",
    ],
    options: { category: "The category to empty." },
    notes: [
      "It cannot be undone. Save any transcript you need first.",
      "The category itself stays.",
      "Useful to clean up tickets after a tournament ends.",
    ],
    related: ["utility clear messages", "ticket delete"],
  },
  "utility clear messages": {
    steps: [
      "Run it in the channel to clean, with a number of messages or a number of days.",
      "The bot deletes them and tells you how many.",
    ],
    options: {
      number: "How many recent messages, from 1 to 1000.",
      days: "Messages from the last 1 to 14 days.",
    },
    notes: [
      "Use number or days, not both.",
      "Discord does not let bots bulk-delete messages older than **14 days**. Those stay.",
    ],
    related: ["utility clear category"],
  },
  "utility emoji steal": {
    steps: [
      "Paste the ID of a custom emoji from this server.",
      "The bot removes it from the server and sends you its image.",
    ],
    options: { emoji_id: "The ID of the emoji to remove." },
    notes: ["The emoji is deleted from the server. Keep the image if you want to upload it again."],
    related: ["utility enlarge"],
  },
  "utility random": {
    steps: [
      "Write the options, separated by commas, pipes, or new lines.",
      "The bot picks at random and shows the winners.",
    ],
    options: {
      options: "The list to pick from.",
      number: "How many to pick. One if empty.",
    },
    notes: ["Useful for draws, giveaways, or picking a side."],
    related: ["utility toss"],
  },
  "utility utc": {
    steps: [
      "Type the date and time in UTC.",
      "The bot shows that moment as a Discord timestamp, which everyone sees in their own time zone.",
    ],
    options: { "hour minute day month year": "The moment, in UTC." },
    notes: [
      "It reads the time the same way {/schedule create} does. Use it to check a time before scheduling.",
    ],
    related: ["schedule create"],
  },
  "utility discord tag": {
    steps: [
      "Paste the Discord IDs, one per line or separated by spaces.",
      "You get the usernames privately, in the same order, ready to paste in the sheet.",
    ],
    options: { ids: "The Discord IDs to look up." },
    notes: [
      "IDs that cannot be found stay as the ID and are flagged.",
      "Check the sheet afterwards with {/sheet validate}.",
    ],
    related: ["sheet validate"],
  },
  "utility avatar": {
    steps: ["Pick a member, or leave it empty for yours.", "The bot shows the avatar with a full-size button."],
    options: { user: "Whose avatar. Yours if empty." },
    notes: ["It shows the server avatar when the member has one."],
    related: ["utility enlarge"],
  },
  "utility toss": {
    steps: ["Run it.", "The bot flips a coin: heads or tails."],
    notes: ["Useful to decide sides or who picks first."],
    related: ["utility random"],
  },
  "utility enlarge": {
    steps: ["Paste the emoji.", "The bot shows it at full size with a link to open it."],
    options: { emoji: "A custom or standard emoji." },
    notes: ["Works with emojis from other servers too."],
    related: ["utility avatar"],
  },
  "utility embed create": {
    steps: [
      "Pick the channel where the embed will be posted.",
      "A private builder opens: add the title, text, color, images, and fields with the buttons.",
      "Publish when the preview looks right.",
    ],
    options: { channel: "Where the embed is posted." },
    notes: builderNotes,
    related: ["utility embed edit", "utility v2 create"],
  },
  "utility embed edit": {
    steps: [
      "Paste the ID of the bot's embed message, and its channel if it is not this one.",
      "The builder opens with the current content. Change it and save.",
    ],
    options: {
      message_id: "The ID of the message to edit.",
      message_channel: "The channel of that message, if it is not this one.",
    },
    notes: ["Only messages posted by this bot can be edited.", ...builderNotes],
    related: ["utility embed create"],
  },
  "utility v2 create": {
    steps: [
      "Pick the channel where the message will be posted.",
      "A private builder opens: add text, sections, separators, images, and a color.",
      "Publish when the preview looks right.",
    ],
    options: { channel: "Where the message is posted." },
    notes: builderNotes,
    related: ["utility v2 edit", "utility embed create"],
  },
  "utility v2 edit": {
    steps: [
      "Paste the ID of the bot's message, and its channel if it is not this one.",
      "The builder opens with the current content. Change it and save.",
    ],
    options: {
      message_id: "The ID of the message to edit.",
      message_channel: "The channel of that message, if it is not this one.",
    },
    notes: ["Only messages posted by this bot can be edited.", ...builderNotes],
    related: ["utility v2 create"],
  },
};
