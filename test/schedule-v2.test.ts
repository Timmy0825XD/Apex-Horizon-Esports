import assert from "node:assert/strict";
import test from "node:test";
import { MessageFlags } from "discord.js";
import { legacyNotice, scheduleCard, scheduleNotice, stampFooter } from "../src/commands/schedule/respond.js";
import {
  boardPostPayload,
  newSchedulePayload,
  postMentionIds,
  reminderMentions,
  reminderPayload,
  resultsPayload,
  ticketPostPayload,
  urgentPayload,
  type ScheduleFace,
} from "../src/commands/schedule/view.js";

const face: ScheduleFace = {
  tournamentName: "Rakshasa",
  leftName: "Apex_Wolves",
  rightName: "Nova Rising",
  round: 2,
  group: "B",
  when: new Date("2026-11-04T21:00:00Z"),
  judgeId: "111111111111111111",
  recorderId: "222222222222222222",
  remark: null,
  matchId: 1847203,
  channelId: "333333333333333333",
  captain1Id: "444444444444444444",
  captain2Id: "555555555555555555",
};

function json(components: { toJSON(): unknown }[]): string {
  return JSON.stringify(components.map((component) => component.toJSON()));
}

test("notices are Components V2 cards with a level-2 heading; the legacy look keeps level 1", () => {
  const notice = scheduleNotice("warning", "Seat taken", "Someone took it.");
  assert.deepEqual(notice.flags, [MessageFlags.IsComponentsV2]);
  assert.match(json(notice.components as never), /## .* Seat taken/);
  assert.match(json(legacyNotice("success", "Schedule created", "Done.").components as never), /"# .* Schedule created/);
});

test("cards put the eyebrow above the title and the footer last", () => {
  const card = scheduleCard({ tone: "danger", eyebrow: "Rakshasa · Round 2", title: "Schedule deleted", blocks: ["Body"], footer: stampFooter("Deleted", "111111111111111111") }).toJSON();
  const texts = card.components.map((component) => ("content" in component ? component.content : ""));
  assert.match(texts[0] ?? "", /^-# Rakshasa · Round 2\n## /);
  assert.match(texts.at(-1) ?? "", /^-# Deleted by <@111111111111111111> · <t:\d+:f>$/);
});

test("the T-10 reminder pings outside the card and shows the staff check with Present", () => {
  const payload = reminderPayload({
    face,
    scheduleId: "abc",
    confirmations: { judge: false, recorder: true },
    rulesChannelId: "666666666666666666",
    mentionIds: reminderMentions(face, face),
  });
  assert.equal(payload.components.length, 2);
  const out = json(payload.components);
  assert.match(out, /<@444444444444444444> <@555555555555555555> <@111111111111111111> <@222222222222222222>/);
  assert.match(out, /Staff check/);
  assert.match(out, /\*waiting\*/);
  assert.match(out, /confirmed/);
  assert.match(out, /Apex\\\\_Wolves vs Nova Rising/);
  assert.match(out, /<#666666666666666666>/);
  assert.match(out, /"label":"Present"/);
  assert.match(out, /"label":"Confirmed"/);
});

test("the T-2 urgent post names who did not confirm and keeps Assign inside the card", () => {
  const out = json(
    urgentPayload({
      face: { ...face, judgeId: null, alert: { raisedAt: new Date(), judgeFailedId: "111111111111111111", judgeVacant: false, recorderFailedId: null, recorderVacant: false } },
      scheduleId: "abc",
      unlocked: true,
      roleIds: ["777777777777777777"],
    }).components,
  );
  assert.match(out, /<@&777777777777777777>/);
  assert.match(out, /Urgent Staff Replacement/);
  assert.match(out, /<@111111111111111111> · \*\*did not confirm\*\*/);
  assert.match(out, /"label":"Assign"/);
});

test("the ticket post pings from the first line and lists each captain with their team", () => {
  const out = json(ticketPostPayload({ ...face, remark: null, creatorId: "888888888888888888" }, postMentionIds(face, false)).components);
  assert.match(out, /"content":"<@444444444444444444> <@555555555555555555>"/);
  assert.match(out, /<@444444444444444444> · \*\*Apex\\\\_Wolves\*\*/);
  assert.match(out, /<@555555555555555555> · \*\*Nova Rising\*\*/);
  assert.match(out, /### Staff/);
  assert.match(out, /Created by <@888888888888888888>/);
  assert.doesNotMatch(out, /"content":"> /);
});

test("the schedules-channel post keeps Assign and the ticket link inside the card, without a captains block", () => {
  const out = json(
    boardPostPayload({ face, guildId: "999999999999999999", scheduleId: "abc", unlocked: true, openUntil: new Date("2026-11-04T18:30:00Z") }).components,
  );
  assert.doesNotMatch(out, /### Captains/);
  assert.match(out, /"label":"Open ticket","url":"https:\/\/discord.com\/channels\/999999999999999999\/333333333333333333"/);
  assert.match(out, /Assign is open until <t:\d+:t>/);
  assert.doesNotMatch(out, /<#333333333333333333>/);
});

test("the results post shows the proofs by attachment name and its section title has no emoji", () => {
  const payload = resultsPayload({
    face,
    team1Score: 3,
    team2Score: 1,
    notes: null,
    links: ["https://youtu.be/x"],
    declaredAt: new Date("2026-11-04T21:48:00Z"),
    uploadedById: "111111111111111111",
    transcriptUrl: "https://discord.com/channels/1/2/3",
    proofNames: ["proof-1.png", "proof-2.jpg"],
    intro: true,
  });
  const out = json(payload.components);
  assert.match(out, /Match Complete!\*\* <@444444444444444444> <@555555555555555555>/);
  assert.match(out, /### Result\\n/);
  assert.match(out, /attachment:\/\/proof-1.png/);
  assert.match(out, /attachment:\/\/proof-2.jpg/);
  assert.match(out, /"label":"Recording 1"/);
  assert.match(out, /"label":"Transcript"/);
  assert.equal(resultsPayload({ ...{ face, team1Score: 3, team2Score: 1, notes: null, links: [], declaredAt: new Date(), uploadedById: null, transcriptUrl: null, proofNames: [] }, intro: false }).components.length, 1);
});

test("the New Schedule alert pings the open seat role and uses the direct GIF as thumbnail", () => {
  const out = json(newSchedulePayload({ face, roleIds: ["777777777777777777"], openSeats: ["recorder"], boardUrl: "https://discord.com/channels/1/2/3" }).components);
  assert.match(out, /"content":"<@&777777777777777777>"/);
  assert.match(out, /needs a \*\*Recorder\*\*/);
  assert.match(out, /https:\/\/media.tenor.com\/a7v_DiKrkeoAAAAC\/check-schedule.gif/);
  assert.match(out, /"label":"Go to Assign"/);
});
