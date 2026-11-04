import type { GuideBook } from "./types.js";

const configOptions = {
  manager_role: "The **Organiser** role: rooms, tickets, roles, and bans.",
  "t1_admin_role t2_admin_role": "Admin tiers 1 and 2.",
  "challonge_mod server_helper_role best_staff_role":
    "Bracket moderators, server helpers, and the best staff recognition role.",
  "judge_role recorder_role staff_role": "The roles for judges, recorders, and the whole staff team.",
  "staffchat_channel staff_announcement_channel staff_rules_channel staff_details_channel":
    "Staff chat, announcements, rules, and the channel where staff info cards are posted.",
};

const packageChoice =
  "The post. A package gives every role that post needs, for example Judge gives Judge and Staff.";

export const staffGuides: GuideBook = {
  "staff config set": {
    where: "Needs {/settings set} first.",
    steps: [
      "Run it once to define the staff roles and the staff channels.",
      "Fill the required roles and channels. The two admin tiers are optional and go last.",
      "The bot saves them and shows the full staff hierarchy.",
    ],
    options: configOptions,
    notes: [
      "If the staff is already set up, use {/staff config edit} instead.",
      "The public schedules channel is not here. It lives in {/settings set}.",
    ],
    related: ["staff config edit", "staff config view", "staff recruit"],
  },
  "staff config edit": {
    steps: [
      "Run it with only the staff roles or channels you want to change.",
      "The bot saves them and marks each changed line as *updated*.",
    ],
    options: configOptions,
    notes: [
      "Pick at least one value, and it has to change.",
      "Changing a role here does not move members. Use {/staff recruit} or {/staff fire} for people.",
    ],
    related: ["staff config view", "staff config set"],
  },
  "staff config view": {
    steps: [
      "Run it in any channel.",
      "The bot lists the staff roles from top to bottom and the staff channels.",
    ],
    notes: [
      "It only reads. Nothing changes.",
      "Deleted roles or channels are flagged so you can replace them with {/staff config edit}.",
    ],
    related: ["staff config edit", "settings show"],
  },
  "staff info add": {
    where: "Staff role only. Needs {/staff config set} first.",
    steps: [
      "Run it and a form opens asking for your **Game ID** and **Game Name**.",
      "The bot fills your Discord ID and username by itself.",
      "Your card is posted in the staff details channel, and you get a private copy of what was saved.",
    ],
    notes: [
      "The Game ID is 8 to 16 letters and numbers. Spaces are removed and it is saved in capitals.",
      "Each Game ID can only belong to one staff member in the server.",
      "Already registered? Use {/staff info edit}.",
    ],
    related: ["staff info edit", "staff info export"],
  },
  "staff info edit": {
    where: "Staff role only, and only for your own info.",
    steps: [
      "Run it and the form opens with your current values.",
      "Change your Game ID or Game Name and submit.",
      "Your card in the staff details channel is rewritten. If it was deleted, a new one is posted.",
    ],
    notes: [
      "At least one value has to change.",
      "Your Discord username is refreshed at the same time.",
    ],
    related: ["staff info add", "staff info export"],
  },
  "staff info export": {
    steps: [
      "Run it in any channel.",
      "You get a private spreadsheet with every staff member's Discord and game info.",
    ],
    notes: [
      "The status column says if each person is *Active*, has *No staff role*, or *Left server*.",
      "Firing someone does not delete their info. The export simply marks their status.",
    ],
    related: ["staff info add", "staff fire"],
  },
  "staff recruit": {
    steps: [
      "Pick the member and the post they are joining as.",
      "The bot gives every role in that post's package.",
      "A welcome is posted in the staff chat with links to announcements, rules, and details.",
    ],
    options: { user: "The member who joins the staff.", role: packageChoice },
    notes: [
      "If the member already has the whole package, nobody is welcomed again.",
      "Your role and the bot's role must be above the roles you give.",
      "If the welcome fails, the roles stay given.",
    ],
    related: ["staff fire", "staff info add"],
  },
  "staff fire": {
    steps: [
      "Pick the member and the post to remove.",
      "The bot removes that role, or every staff role with **Complete**.",
    ],
    options: {
      user: "The member who leaves the post.",
      role: "The post to remove. **Complete** removes every configured staff role.",
    },
    notes: [
      "Removing one post keeps the others. Firing a Judge does not remove the Staff role.",
      "Past attendance is never deleted, so salary history stays.",
    ],
    related: ["staff recruit", "staff info export"],
  },
  "staff work": {
    steps: [
      "Pick the tournament.",
      "The bot posts a board with every judge and recorder, their matches, and their games.",
    ],
    options: {
      tournament: "The tournament to count.",
      include_default_wins: "Turn it on to also count default wins (DW).",
    },
    notes: [
      "It is built from {/attendance mark}. A match without attendance does not count.",
      "It shows work, not money. For pay, use {/attendance report}.",
    ],
    related: ["attendance report", "get sheet"],
  },
};
