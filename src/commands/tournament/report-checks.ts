import type { Attendance, Match, Schedule } from "@prisma/client";
import { isDefaultWin } from "../attendance/payroll.js";

/** One bracket match as the report sees it: read from Challonge at run time, or the stored copy. */
export type BracketMatch = Pick<
  Match,
  "challongeMatchId" | "state" | "round" | "group" | "thirdPlace" | "player1Name" | "player2Name"
>;

export type RoomRow = { challongeMatchId: number; channelId: string; status: string };

type SortKey = [number, string, number, number];

export type StageContext = {
  lastWinnerRound: number | null;
  hasLosers: boolean;
};

export function stageContext(matches: BracketMatch[]): StageContext {
  const winners = matches.filter((match) => !match.group && match.round > 0).map((match) => match.round);
  return {
    lastWinnerRound: winners.length > 0 ? Math.max(...winners) : null,
    hasLosers: matches.some((match) => !match.group && match.round < 0),
  };
}

export function stageLabel(match: BracketMatch | undefined, context: StageContext): string {
  if (!match) {
    return "—";
  }
  if (match.group) {
    return `Group ${match.group} · Round ${match.round}`;
  }
  if (match.thirdPlace) {
    return "3rd place";
  }
  if (match.round < 0) {
    return `Losers round ${Math.abs(match.round)}`;
  }
  if (context.lastWinnerRound != null && match.round === context.lastWinnerRound) {
    return context.hasLosers ? "Grand final" : "Final";
  }
  if (context.lastWinnerRound != null && !context.hasLosers && match.round === context.lastWinnerRound - 1) {
    return "Semifinal";
  }
  return `Round ${match.round}`;
}

export function sortKey(match: BracketMatch | undefined, matchId: number): SortKey {
  if (!match) {
    return [4, "", 0, matchId];
  }
  if (match.group) {
    return [0, match.group, match.round, matchId];
  }
  if (match.thirdPlace) {
    return [2, "", match.round, matchId];
  }
  if (match.round < 0) {
    return [3, "", Math.abs(match.round), matchId];
  }
  return [1, "", match.round, matchId];
}

export function compareKeys(left: SortKey, right: SortKey): number {
  if (left[0] !== right[0]) {
    return left[0] - right[0];
  }
  if (left[1] !== right[1]) {
    return left[1] < right[1] ? -1 : 1;
  }
  if (left[2] !== right[2]) {
    return left[2] - right[2];
  }
  return left[3] - right[3];
}

export function matchTitle(match: BracketMatch | undefined, matchId: number): string {
  const left = match?.player1Name.trim();
  const right = match?.player2Name.trim();
  if (!left && !right) {
    return `Match ${matchId}`;
  }
  return `${left || "TBD"} vs ${right || "TBD"}`;
}

function stateOf(match: BracketMatch): "complete" | "open" | "pending" {
  const state = match.state.toLowerCase();
  if (state === "complete") {
    return "complete";
  }
  return state === "open" ? "open" : "pending";
}

/** Minutes from the scheduled time to the declaration; null when there is no result or it came first. */
export function minutesToResult(schedule: Pick<Schedule, "scheduledAt" | "results">): number | null {
  if (!schedule.results) {
    return null;
  }
  const minutes = Math.round((schedule.results.declaredAt.getTime() - schedule.scheduledAt.getTime()) / 60_000);
  return minutes >= 0 ? minutes : null;
}

// ---------------------------------------------------------------- overview

export type StageRow = {
  stage: string;
  matches: number;
  complete: number;
  open: number;
  pending: number;
  tickets: number;
  attendance: number;
  results: number;
};

export type Overview = {
  stages: StageRow[];
  totals: StageRow;
  /** First stage in bracket order that still has unfinished matches; null when the bracket is done. */
  currentStage: string | null;
};

export function buildOverview(input: {
  matches: BracketMatch[];
  rooms: RoomRow[];
  marks: Pick<Attendance, "challongeMatchId">[];
  schedules: Pick<Schedule, "challongeMatchId" | "results">[];
}): Overview {
  const context = stageContext(input.matches);
  const ticketed = new Set(input.rooms.map((room) => room.challongeMatchId));
  const marked = new Set(input.marks.map((mark) => mark.challongeMatchId));
  const declared = new Set(input.schedules.filter((row) => row.results).map((row) => row.challongeMatchId));
  const ordered = [...input.matches].sort((left, right) =>
    compareKeys(sortKey(left, left.challongeMatchId), sortKey(right, right.challongeMatchId)),
  );

  const rows = new Map<string, StageRow>();
  for (const match of ordered) {
    const stage = stageLabel(match, context);
    const row =
      rows.get(stage) ??
      { stage, matches: 0, complete: 0, open: 0, pending: 0, tickets: 0, attendance: 0, results: 0 };
    rows.set(stage, row);
    row.matches += 1;
    row[stateOf(match)] += 1;
    const id = match.challongeMatchId;
    row.tickets += ticketed.has(id) ? 1 : 0;
    row.attendance += marked.has(id) ? 1 : 0;
    row.results += declared.has(id) ? 1 : 0;
  }

  const stages = [...rows.values()];
  const totals = stages.reduce<StageRow>(
    (sum, row) => ({
      stage: "Total",
      matches: sum.matches + row.matches,
      complete: sum.complete + row.complete,
      open: sum.open + row.open,
      pending: sum.pending + row.pending,
      tickets: sum.tickets + row.tickets,
      attendance: sum.attendance + row.attendance,
      results: sum.results + row.results,
    }),
    { stage: "Total", matches: 0, complete: 0, open: 0, pending: 0, tickets: 0, attendance: 0, results: 0 },
  );
  const current = stages.find((row) => row.complete < row.matches);
  return { stages, totals, currentStage: current?.stage ?? null };
}

// ---------------------------------------------------------------- to do

export type Priority = "high" | "medium" | "low";

export type TodoCheck =
  | "complete-no-attendance"
  | "schedule-overdue"
  | "schedule-soon-unstaffed"
  | "ticket-open-complete"
  | "result-no-attendance"
  | "attendance-no-recordings"
  | "open-no-ticket";

export const todoChecks: Record<TodoCheck, { priority: Priority; label: string; fix: string }> = {
  "complete-no-attendance": { priority: "high", label: "Complete on the bracket, schedule had no attendance", fix: "/attendance mark" },
  "schedule-overdue": { priority: "high", label: "Schedule passed, no result declared", fix: "/schedule results add" },
  "schedule-soon-unstaffed": { priority: "high", label: "Schedule in the next 24 h without judge or recorder", fix: "/schedule update" },
  "ticket-open-complete": { priority: "medium", label: "Ticket still open, match complete", fix: "/ticket close" },
  "result-no-attendance": { priority: "medium", label: "Result declared, no attendance", fix: "/attendance mark" },
  "attendance-no-recordings": { priority: "low", label: "Attendance without recording links", fix: "/link add" },
  "open-no-ticket": { priority: "low", label: "Open match without a ticket", fix: "/room create" },
};

const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export type TodoItem = {
  check: TodoCheck;
  priority: Priority;
  label: string;
  fix: string;
  matchId: number;
  stage: string;
  match: string;
  channelId: string | null;
  detail: string;
};

export const SOON_HOURS = 24;

function utc(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function buildTodo(input: {
  matches: BracketMatch[];
  rooms: RoomRow[];
  marks: Pick<Attendance, "challongeMatchId" | "links" | "remark">[];
  schedules: Pick<Schedule, "challongeMatchId" | "channelId" | "scheduledAt" | "results" | "judgeId" | "recorderId">[];
  now: Date;
}): TodoItem[] {
  const context = stageContext(input.matches);
  const byId = new Map(input.matches.map((match) => [match.challongeMatchId, match]));
  const roomById = new Map(input.rooms.map((room) => [room.challongeMatchId, room]));
  const marked = new Map(input.marks.map((mark) => [mark.challongeMatchId, mark]));
  const scheduled = new Set(input.schedules.map((schedule) => schedule.challongeMatchId));
  const now = input.now.getTime();
  const soon = now + SOON_HOURS * 60 * 60 * 1000;
  const items: TodoItem[] = [];

  const push = (check: TodoCheck, matchId: number, channelId: string | null, detail: string) => {
    const match = byId.get(matchId);
    items.push({
      check,
      ...todoChecks[check],
      matchId,
      stage: stageLabel(match, context),
      match: matchTitle(match, matchId),
      channelId,
      detail,
    });
  };

  for (const match of input.matches) {
    const id = match.challongeMatchId;
    const room = roomById.get(id);
    const state = stateOf(match);
    // Attendance needs a schedule: a match settled without one (forfeit, DQ, manual bracket edit) had no staff to mark.
    if (state === "complete" && room && scheduled.has(id) && !marked.has(id)) {
      push("complete-no-attendance", id, room.channelId, "Staff for this ticket are not on the board.");
    }
    if (state === "complete" && room?.status === "open") {
      push("ticket-open-complete", id, room.channelId, "The bracket is done but the ticket was not archived.");
    }
    if (state === "open" && !room) {
      push("open-no-ticket", id, null, "Both sides are set and no battle ticket exists.");
    }
  }

  for (const schedule of input.schedules) {
    const at = schedule.scheduledAt.getTime();
    const id = schedule.challongeMatchId;
    if (!schedule.results && at <= now) {
      push("schedule-overdue", id, schedule.channelId, `Scheduled ${utc(schedule.scheduledAt)}.`);
    }
    if (at > now && at <= soon && (!schedule.judgeId || !schedule.recorderId)) {
      const missing = !schedule.judgeId && !schedule.recorderId ? "judge and recorder" : !schedule.judgeId ? "judge" : "recorder";
      push("schedule-soon-unstaffed", id, schedule.channelId, `Starts ${utc(schedule.scheduledAt)}; missing ${missing}.`);
    }
    if (schedule.results && !marked.has(id)) {
      push("result-no-attendance", id, schedule.channelId, `Result declared ${utc(schedule.results.declaredAt)}.`);
    }
  }

  for (const mark of input.marks) {
    if (mark.links.length === 0 && !isDefaultWin(mark.remark)) {
      push("attendance-no-recordings", mark.challongeMatchId, roomById.get(mark.challongeMatchId)?.channelId ?? null, "No recording was linked.");
    }
  }

  return items.sort(
    (left, right) =>
      priorityRank[left.priority] - priorityRank[right.priority] ||
      compareKeys(sortKey(byId.get(left.matchId), left.matchId), sortKey(byId.get(right.matchId), right.matchId)) ||
      left.check.localeCompare(right.check),
  );
}

/** Count per check, in the order the checks are declared. */
export function todoSummary(items: TodoItem[]): Array<{ check: TodoCheck; label: string; priority: Priority; count: number }> {
  return (Object.keys(todoChecks) as TodoCheck[])
    .map((check) => ({ check, ...todoChecks[check], count: items.filter((item) => item.check === check).length }))
    .filter((row) => row.count > 0);
}

// ---------------------------------------------------------------- schedules

export type ScheduleStatus = "Completed" | "Overdue" | "Upcoming";

export function scheduleStatusOf(schedule: Pick<Schedule, "results" | "scheduledAt">, now: Date): ScheduleStatus {
  if (schedule.results) {
    return "Completed";
  }
  return schedule.scheduledAt.getTime() <= now.getTime() ? "Overdue" : "Upcoming";
}

export function confirmedLabel(schedule: Pick<Schedule, "judgeId" | "recorderId" | "confirmations">): string {
  const judge = Boolean(schedule.judgeId) && schedule.confirmations.judge;
  const recorder = Boolean(schedule.recorderId) && schedule.confirmations.recorder;
  if (judge && recorder) {
    return "Both";
  }
  if (judge) {
    return "Judge";
  }
  if (recorder) {
    return "Recorder";
  }
  return "None";
}
