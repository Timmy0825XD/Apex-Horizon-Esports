import assert from "node:assert/strict";
import test from "node:test";
import { Workbook } from "exceljs";
import { buildOverview, buildTodo, todoSummary, type BracketMatch, type RoomRow } from "../src/commands/tournament/report-checks.js";
import { buildTournamentReport } from "../src/commands/tournament/report-book.js";

const now = new Date("2026-11-02T18:00:00Z");
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);

function match(id: number, round: number, state: string, names = ["A", "B"]): BracketMatch {
  return { challongeMatchId: id, state, round, group: null, thirdPlace: false, player1Name: names[0], player2Name: names[1] };
}

const results = (declaredAt: Date) => ({
  team1Score: 2, team2Score: 1, notes: null, imageUrls: [], links: [], messageId: "m",
  ticketMessageId: null, transcriptUrl: null, uploadedBy: null, declaredAt,
});

function schedule(id: number, at: Date, extra: Partial<{ results: ReturnType<typeof results>; judgeId: string | null; recorderId: string | null }> = {}) {
  return { challongeMatchId: id, channelId: `ch${id}`, scheduledAt: at, results: null, judgeId: "j", recorderId: "r", ...extra };
}

const matches = [
  match(1, 1, "complete", ["Nova", "Kraken"]),
  match(2, 1, "complete"),
  match(3, 1, "complete"),
  match(4, 2, "open", ["Ghost", "Fang"]),
  match(5, 2, "open"),
  match(6, 3, "pending", ["", ""]),
];
const rooms: RoomRow[] = [
  { challongeMatchId: 1, channelId: "ch1", status: "closed" },
  { challongeMatchId: 2, channelId: "ch2", status: "open" },
  { challongeMatchId: 4, channelId: "ch4", status: "open" },
];
const marks = [{ challongeMatchId: 2, links: [], remark: null }, { challongeMatchId: 3, links: ["https://youtu.be/x"], remark: null }];

test("each check fires on its own case and nowhere else", () => {
  const items = buildTodo({
    matches,
    rooms,
    marks,
    schedules: [
      schedule(1, hours(-30), { results: results(hours(-29)) }), // scheduled and complete, no attendance
      schedule(4, hours(-3)), // overdue, no result
      schedule(5, hours(5), { recorderId: null }), // soon, missing recorder
      schedule(3, hours(-30), { results: results(hours(-29)) }), // declared, has attendance: no item
      schedule(2, hours(48), { judgeId: null }), // missing staff but not within 24 h: no item
    ],
    now,
  });
  const found = items.map((item) => `${item.check}:${item.matchId}`).sort();
  assert.deepEqual(found, [
    "attendance-no-recordings:2",
    "complete-no-attendance:1",
    "open-no-ticket:5",
    "result-no-attendance:1",
    "schedule-overdue:4",
    "schedule-soon-unstaffed:5",
    "ticket-open-complete:2",
  ]);
});

test("a match settled without a ticket is not asked for attendance", () => {
  const items = buildTodo({ matches: [match(9, 1, "complete")], rooms: [], marks: [], schedules: [], now });
  assert.equal(items.length, 0);
});

test("a ticket settled without a schedule (a DQ) is not asked for attendance", () => {
  const items = buildTodo({
    matches: [match(9, 1, "complete")],
    rooms: [{ challongeMatchId: 9, channelId: "ch9", status: "closed" }],
    marks: [],
    schedules: [],
    now,
  });
  assert.equal(items.length, 0);
});

test("default wins are not asked for recordings", () => {
  const items = buildTodo({ matches: [], rooms: [], marks: [{ challongeMatchId: 1, links: [], remark: "DW" }], schedules: [], now });
  assert.equal(items.length, 0);
});

test("a declared result without attendance is reported", () => {
  const items = buildTodo({
    matches: [match(7, 1, "complete")],
    rooms: [],
    marks: [],
    schedules: [schedule(7, hours(-2), { results: results(hours(-1)) })],
    now,
  });
  assert.deepEqual(items.map((item) => item.check), ["result-no-attendance"]);
});

test("items come high first, then in bracket order", () => {
  const items = buildTodo({
    matches,
    rooms,
    marks,
    schedules: [schedule(1, hours(-30), { results: results(hours(-29)) }), schedule(4, hours(-3))],
    now,
  });
  const ranks = items.map((item) => item.priority);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => ["high", "medium", "low"].indexOf(a) - ["high", "medium", "low"].indexOf(b)));
  assert.equal(items[0].matchId, 1);
  assert.equal(todoSummary(items).find((row) => row.check === "schedule-overdue")?.count, 1);
});

test("overview counts each stage and finds the stage in progress", () => {
  const overview = buildOverview({ matches, rooms, marks, schedules: [schedule(3, hours(-30), { results: results(hours(-29)) })] });
  assert.deepEqual(
    overview.stages.map((row) => [row.stage, row.matches, row.complete, row.open, row.pending]),
    [["Round 1", 3, 3, 0, 0], ["Semifinal", 2, 0, 2, 0], ["Final", 1, 0, 0, 1]],
  );
  assert.equal(overview.currentStage, "Semifinal");
  assert.deepEqual([overview.totals.matches, overview.totals.tickets, overview.totals.attendance, overview.totals.results], [6, 3, 2, 1]);
});

test("the workbook opens with the three new sheets and keeps the old ones", async () => {
  const stage = { stage: "Round 1", matches: 1, complete: 1, open: 0, pending: 0, tickets: 1, attendance: 1, results: 1 };
  const buffer = await buildTournamentReport({
    tournamentName: "Apex Winter Cup",
    generatedLabel: "2026-11-02 18:00:00 UTC",
    payModeLabel: "1v1/2v2/3v3 (Per Match)",
    overview: {
      source: "Bracket read from Challonge",
      kpis: [{ value: "1 / 1", label: "Matches complete · 100%" }],
      stages: [stage],
      totals: { ...stage, stage: "Total" },
      topStaff: [{ username: "kairo", rounds: 1, games: 3 }],
      schedules: [{ label: "Schedules", value: "1" }],
    },
    todo: [{ priority: "high", check: "Schedule passed, no result declared", stage: "Round 1", matchId: 1, match: "A vs B", ticket: "r1-a-vs-b", fix: "/schedule results add", detail: "Scheduled 2026-11-02 14:00 UTC." }],
    schedules: [{ stage: "Round 1", matchId: 1, match: "A vs B", status: "Overdue", scheduledAt: "x", declaredAt: "—", resultAfter: null, judge: "kairo", recorder: "Open", confirmed: "None", score: "—", ticket: "r1", note: "—" }],
    attendance: [{ stage: "Round 1", matchId: 1, match: "A vs B", ticket: "r1", judge: "k", judgeId: "1", recorder: "n", recorderId: "2", bothSeats: false, team1: 2, team2: 1, games: 3, winner: "A", tie: false, remark: "—", defaultWin: false, recordings: [], proof: [], resultDeclared: false, markedBy: "k", markedAt: "x" }],
    work: [],
    results: [],
    config: [{ kind: "section", title: "Identity" }, { kind: "field", label: "Tournament", value: "Apex Winter Cup" }],
  });
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["Overview", "To do", "Schedules", "Attendance", "Work count", "Results", "Configuration"],
  );
  const attendance = workbook.getWorksheet("Attendance")!;
  const headers = (attendance.getRow(6).values as unknown[]).slice(1);
  assert.equal(headers.length, 19);
  assert.equal(attendance.getCell(7, headers.indexOf("Ticket") + 1).value, "r1");
  assert.equal(attendance.getCell(7, headers.indexOf("Result declared") + 1).value, "No");
  // Totals line up under the score columns even after the new columns.
  assert.equal(attendance.getCell(8, headers.indexOf("Games") + 1).value, 3);
  assert.equal(workbook.getWorksheet("To do")!.getCell(7, 1).value, "High");
});
