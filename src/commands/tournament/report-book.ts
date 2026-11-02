import {
  Workbook,
  type Alignment,
  type Borders,
  type Cell,
  type Fill,
  type Font,
  type Worksheet,
} from "exceljs";

const FONT = "Calibri";

const INK = "FF0E1A2B";
const INK_SOFT = "FF16263A";
const GOLD = "FFC6A15A";
const PAPER = "FFF4EFE4";
const IVORY = "FFFBF7F0";
const WHITE = "FFFFFFFF";
const LINE = "FFE4D7C6";
const MUTED = "FF6E655C";
const INK_TEXT = "FF1C1915";
const LINK = "FF1A5276";
const TEAL = "FF1B6B5A";
const TEAL_DEEP = "FF134E42";
const COPPER = "FF9A5B2E";
const COPPER_DEEP = "FF6E3E1C";
const VIOLET = "FF4C3A78";
const VIOLET_DEEP = "FF352858";
const CLAY = "FF8E3D32";
const CLAY_DEEP = "FF6B2C24";
const SLATE = "FF2F5D7C";
const SLATE_DEEP = "FF22465E";
const STONE = "FF5B5045";
const WIN = "FFE5F3EA";
const TIE = "FFF8F0DC";
const DW = "FFF8E6E3";

const HAIR = { style: "thin" as const, color: { argb: LINE } };
const GRID: Partial<Borders> = { top: HAIR, left: HAIR, bottom: HAIR, right: HAIR };

export type AttendanceLine = {
  stage: string;
  matchId: number;
  match: string;
  ticket: string;
  judge: string;
  judgeId: string;
  recorder: string;
  recorderId: string;
  bothSeats: boolean;
  team1: number;
  team2: number;
  games: number;
  winner: string;
  tie: boolean;
  remark: string;
  defaultWin: boolean;
  recordings: string[];
  proof: string[];
  resultDeclared: boolean;
  markedBy: string;
  markedAt: string;
};

export type WorkLine = {
  username: string;
  userId: string;
  both: number;
  judge: number;
  recorder: number;
  defaultWins: number;
  totalRounds: number;
  gamesBoth: number;
  gamesJudge: number;
  gamesRecorder: number;
  totalGames: number;
};

export type ResultLine = {
  stage: string;
  matchId: number;
  match: string;
  state: string;
  team1: number;
  team2: number;
  winner: string;
  tie: boolean;
  outcome: string;
  defaultWin: boolean;
  judge: string;
  judgeId: string;
  recorder: string;
  recorderId: string;
  declaredBy: string;
  declaredById: string;
  declaredAt: string;
  scheduledAt: string;
  resultAfter: number | null;
  attendanceMarked: boolean;
  notes: string;
  scheduleNote: string;
  transcript: string | null;
  recordings: string[];
  proof: string[];
};

export type ConfigEntry =
  | { kind: "section"; title: string }
  | { kind: "field"; label: string; value: string; link?: string };

export type OverviewKpi = { value: string; label: string };

export type OverviewStage = {
  stage: string;
  matches: number;
  complete: number;
  open: number;
  pending: number;
  tickets: number;
  attendance: number;
  results: number;
};

export type OverviewBook = {
  source: string;
  kpis: OverviewKpi[];
  stages: OverviewStage[];
  totals: OverviewStage;
  topStaff: Array<{ username: string; rounds: number; games: number }>;
  schedules: Array<{ label: string; value: string }>;
};

export type TodoLine = {
  priority: "high" | "medium" | "low";
  check: string;
  stage: string;
  matchId: number;
  match: string;
  ticket: string;
  fix: string;
  detail: string;
};

export type ScheduleLine = {
  stage: string;
  matchId: number;
  match: string;
  status: "Completed" | "Overdue" | "Upcoming";
  scheduledAt: string;
  declaredAt: string;
  resultAfter: number | null;
  judge: string;
  recorder: string;
  confirmed: string;
  score: string;
  ticket: string;
  note: string;
};

export type TournamentReportBook = {
  tournamentName: string;
  generatedLabel: string;
  payModeLabel: string;
  overview: OverviewBook;
  todo: TodoLine[];
  schedules: ScheduleLine[];
  attendance: AttendanceLine[];
  work: WorkLine[];
  results: ResultLine[];
  config: ConfigEntry[];
};

type Align = "left" | "center";

type Column = {
  header: string;
  width: number;
  group: string;
  align: Align;
};

type Theme = {
  name: string;
  title: string;
  subtitle: string;
  meta: string;
  accent: string;
  accentDeep: string;
  columns: Column[];
  freezeColumns: number;
};

function solid(argb: string): Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function face(size: number, color: string, bold = false, italic = false): Font {
  return { name: FONT, size, color: { argb: color }, bold, italic } as Font;
}

function urlsOf(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => /^https?:\/\//i.test(value));
}

function safeText(value: string): string {
  if (value === "—" || value.length === 0) {
    return value;
  }
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function paint(cell: Cell, fill: string, font: Font, align: Align, wrap = false): void {
  cell.fill = solid(fill);
  cell.font = font;
  cell.alignment = { vertical: "middle", horizontal: align, wrapText: wrap };
  cell.border = GRID;
}

function writeLinks(cell: Cell, urls: string[], singleLabel: string, fill: string): number {
  const clean = urlsOf(urls);
  cell.fill = solid(fill);
  cell.border = GRID;
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: clean.length > 1 } as Alignment;
  if (clean.length === 0) {
    cell.value = "—";
    cell.font = face(10, MUTED);
    return 1;
  }
  cell.note = clean.join("\n");
  if (clean.length === 1) {
    cell.value = { text: singleLabel, hyperlink: clean[0], tooltip: clean[0] };
    cell.font = { ...face(10, LINK), underline: "single" };
    return 1;
  }
  cell.value = clean.join("\n");
  cell.font = face(10, LINK);
  return clean.length;
}

function writeText(cell: Cell, value: string, fill: string, align: Align, color = INK_TEXT, bold = false): void {
  const safe = safeText(value);
  cell.value = safe;
  paint(cell, fill, face(10, color, bold), align, safe.length > 42);
}

function writeId(cell: Cell, value: string, fill: string): void {
  const safe = safeText(value);
  cell.value = safe;
  cell.numFmt = "@";
  paint(cell, fill, face(10, safe === "—" ? MUTED : INK_TEXT), "left");
}

function writeNumber(cell: Cell, value: number, fill: string, bold = false): void {
  cell.value = value;
  cell.numFmt = "0";
  paint(cell, fill, face(10, INK_TEXT, bold), "center");
}

function mergeFill(sheet: Worksheet, row: number, columns: number, fill: string): void {
  sheet.mergeCells(row, 1, row, columns);
  for (let column = 1; column <= columns; column += 1) {
    const cell = sheet.getCell(row, column);
    cell.fill = solid(fill);
    cell.border = {};
  }
}

/** Rows 1-4: title, subtitle, meta line and the gold rule. Shared by every sheet. */
function banner(sheet: Worksheet, width: number, titleText: string, subtitleText: string, metaText: string): void {
  mergeFill(sheet, 1, width, INK);
  const title = sheet.getCell(1, 1);
  title.value = titleText;
  title.font = face(20, WHITE, true);
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 36;

  mergeFill(sheet, 2, width, INK_SOFT);
  const subtitle = sheet.getCell(2, 1);
  subtitle.value = subtitleText;
  subtitle.font = face(10, "FFE7D7B8", false, true);
  subtitle.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
  sheet.getRow(2).height = 46;

  mergeFill(sheet, 3, width, INK_SOFT);
  const meta = sheet.getCell(3, 1);
  meta.value = safeText(metaText);
  meta.font = face(10, GOLD);
  meta.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(3).height = 20;

  mergeFill(sheet, 4, width, GOLD);
  sheet.getRow(4).height = 6;
}

function prepare(workbook: Workbook, theme: Theme): { sheet: Worksheet; headerRow: number; firstDataRow: number } {
  const sheet = workbook.addWorksheet(theme.name, {
    properties: { defaultRowHeight: 20, showGridLines: false },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.7, bottom: 0.55, header: 0.28, footer: 0.28 },
    },
    headerFooter: {
      oddHeader: `&L&8&K8C6A2F${theme.title}&R&8&K6E655CApex Horizon`,
      oddFooter: `&L&8Staff report&C&8${theme.name}&R&8Page &P of &N`,
    },
    views: [
      {
        state: "frozen",
        ySplit: 6,
        xSplit: theme.freezeColumns,
        showGridLines: false,
        zoomScale: 110,
        activeCell: "A7",
      },
    ],
  });
  sheet.properties.tabColor = { argb: theme.accent };
  sheet.pageSetup.printTitlesRow = "5:6";

  const width = theme.columns.length;
  theme.columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
  });

  banner(sheet, width, theme.title, theme.subtitle, theme.meta);

  const groupRow = sheet.getRow(5);
  groupRow.height = 18;
  let cursor = 1;
  while (cursor <= width) {
    const group = theme.columns[cursor - 1]?.group ?? "";
    let end = cursor;
    while (end < width && theme.columns[end]?.group === group) {
      end += 1;
    }
    if (end > cursor) {
      sheet.mergeCells(5, cursor, 5, end);
    }
    for (let column = cursor; column <= end; column += 1) {
      const cell = sheet.getCell(5, column);
      cell.fill = solid(theme.accentDeep);
      cell.font = face(9, GOLD, true);
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: theme.accentDeep } },
        left: { style: "thin", color: { argb: theme.accentDeep } },
        right: { style: "thin", color: { argb: theme.accentDeep } },
        bottom: { style: "thin", color: { argb: theme.accentDeep } },
      };
    }
    sheet.getCell(5, cursor).value = group.toUpperCase();
    cursor = end + 1;
  }

  const header = sheet.getRow(6);
  header.height = 24;
  theme.columns.forEach((column, index) => {
    const cell = sheet.getCell(6, index + 1);
    cell.value = column.header;
    cell.fill = solid(theme.accent);
    cell.font = face(10, WHITE, true);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: theme.accent } },
      left: { style: "thin", color: { argb: "33FFFFFF" } },
      right: { style: "thin", color: { argb: "33FFFFFF" } },
      bottom: { style: "medium", color: { argb: GOLD } },
    };
  });

  return { sheet, headerRow: 6, firstDataRow: 7 };
}

function finishTable(sheet: Worksheet, headerRow: number, lastDataRow: number, columns: number): void {
  if (lastDataRow < headerRow + 1) {
    return;
  }
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: lastDataRow, column: columns },
  };
}

function emptyNote(sheet: Worksheet, row: number, columns: number, message: string): void {
  sheet.mergeCells(row, 1, row, columns);
  for (let column = 1; column <= columns; column += 1) {
    const cell = sheet.getCell(row, column);
    cell.fill = solid(IVORY);
    cell.border = GRID;
  }
  const cell = sheet.getCell(row, 1);
  cell.value = message;
  cell.font = face(11, MUTED, false, true);
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(row).height = 28;
}

function totalLabel(cell: Cell, value: string): void {
  cell.value = value;
  paint(cell, INK, face(10, GOLD, true), "left");
  cell.border = {
    ...GRID,
    top: { style: "medium", color: { argb: GOLD } },
  };
}

function totalBlank(cell: Cell): void {
  cell.value = "";
  paint(cell, INK, face(10, GOLD, true), "center");
  cell.border = {
    ...GRID,
    top: { style: "medium", color: { argb: GOLD } },
  };
}

function totalNumber(cell: Cell, value: number): void {
  cell.value = value;
  cell.numFmt = "0";
  paint(cell, INK, face(10, GOLD, true), "center");
  cell.border = {
    ...GRID,
    top: { style: "medium", color: { argb: GOLD } },
  };
}

function rowHeight(lines: number): number {
  return Math.min(64, Math.max(22, lines * 16));
}

/** Writes one row left to right, so adding a column never shifts hand-written indexes. */
function rowWriter(sheet: Worksheet, rowNumber: number) {
  let column = 0;
  return () => {
    column += 1;
    return sheet.getCell(rowNumber, column);
  };
}

function yesNo(cell: Cell, value: boolean, fill: string): void {
  writeText(cell, value ? "Yes" : "No", value ? fill : DW, "center", value ? INK_TEXT : CLAY, !value);
}

function minutesCell(cell: Cell, minutes: number | null, fill: string): void {
  if (minutes == null) {
    writeText(cell, "—", fill, "center", MUTED);
    return;
  }
  writeNumber(cell, minutes, fill);
}

const attendanceColumns: Column[] = [
  { group: "Match", header: "Stage", width: 22, align: "left" },
  { group: "Match", header: "Match ID", width: 12, align: "center" },
  { group: "Match", header: "Match", width: 38, align: "left" },
  { group: "Match", header: "Ticket", width: 30, align: "left" },
  { group: "Staff", header: "Judge", width: 22, align: "left" },
  { group: "Staff", header: "Judge ID", width: 22, align: "left" },
  { group: "Staff", header: "Recorder", width: 22, align: "left" },
  { group: "Staff", header: "Recorder ID", width: 22, align: "left" },
  { group: "Staff", header: "Duty", width: 14, align: "center" },
  { group: "Score", header: "Team 1", width: 11, align: "center" },
  { group: "Score", header: "Team 2", width: 11, align: "center" },
  { group: "Score", header: "Games", width: 10, align: "center" },
  { group: "Score", header: "Winner", width: 28, align: "left" },
  { group: "Score", header: "Remark", width: 15, align: "center" },
  { group: "Record", header: "Recordings", width: 22, align: "left" },
  { group: "Record", header: "Score proof", width: 20, align: "left" },
  { group: "Record", header: "Result declared", width: 15, align: "center" },
  { group: "Record", header: "Marked by", width: 22, align: "left" },
  { group: "Record", header: "Marked at", width: 22, align: "center" },
];

const workColumns: Column[] = [
  { group: "Person", header: "Username", width: 28, align: "left" },
  { group: "Person", header: "Discord ID", width: 22, align: "left" },
  { group: "Rounds", header: "Both seats", width: 14, align: "center" },
  { group: "Rounds", header: "Judge", width: 12, align: "center" },
  { group: "Rounds", header: "Recorder", width: 14, align: "center" },
  { group: "Rounds", header: "Default wins", width: 15, align: "center" },
  { group: "Rounds", header: "Total", width: 12, align: "center" },
  { group: "Games", header: "Both seats", width: 14, align: "center" },
  { group: "Games", header: "Judge", width: 12, align: "center" },
  { group: "Games", header: "Recorder", width: 14, align: "center" },
  { group: "Games", header: "Total", width: 12, align: "center" },
];

const resultColumns: Column[] = [
  { group: "Match", header: "Stage", width: 22, align: "left" },
  { group: "Match", header: "Match ID", width: 12, align: "center" },
  { group: "Match", header: "Match", width: 38, align: "left" },
  { group: "Match", header: "State", width: 14, align: "center" },
  { group: "Score", header: "Team 1", width: 11, align: "center" },
  { group: "Score", header: "Team 2", width: 11, align: "center" },
  { group: "Score", header: "Winner", width: 28, align: "left" },
  { group: "Score", header: "Outcome", width: 16, align: "center" },
  { group: "Staff", header: "Judge", width: 22, align: "left" },
  { group: "Staff", header: "Judge ID", width: 22, align: "left" },
  { group: "Staff", header: "Recorder", width: 22, align: "left" },
  { group: "Staff", header: "Recorder ID", width: 22, align: "left" },
  { group: "Declaration", header: "Declared by", width: 22, align: "left" },
  { group: "Declaration", header: "Declared by ID", width: 22, align: "left" },
  { group: "Declaration", header: "Declared at", width: 22, align: "center" },
  { group: "Declaration", header: "Scheduled", width: 22, align: "center" },
  { group: "Declaration", header: "Result after (min)", width: 16, align: "center" },
  { group: "Declaration", header: "Attendance marked", width: 16, align: "center" },
  { group: "Declaration", header: "Notes", width: 36, align: "left" },
  { group: "Declaration", header: "Schedule note", width: 28, align: "left" },
  { group: "Evidence", header: "Transcript", width: 20, align: "left" },
  { group: "Evidence", header: "Recordings", width: 22, align: "left" },
  { group: "Evidence", header: "Proof", width: 18, align: "left" },
];

const todoColumns: Column[] = [
  { group: "Item", header: "Priority", width: 12, align: "center" },
  { group: "Item", header: "Check", width: 44, align: "left" },
  { group: "Match", header: "Stage", width: 22, align: "left" },
  { group: "Match", header: "Match ID", width: 12, align: "center" },
  { group: "Match", header: "Match", width: 36, align: "left" },
  { group: "Match", header: "Ticket", width: 30, align: "left" },
  { group: "Action", header: "Fix with", width: 20, align: "left" },
  { group: "Action", header: "Detail", width: 46, align: "left" },
];

const scheduleColumns: Column[] = [
  { group: "Match", header: "Stage", width: 22, align: "left" },
  { group: "Match", header: "Match ID", width: 12, align: "center" },
  { group: "Match", header: "Match", width: 36, align: "left" },
  { group: "Match", header: "Status", width: 14, align: "center" },
  { group: "Time", header: "Scheduled", width: 22, align: "center" },
  { group: "Time", header: "Result declared", width: 22, align: "center" },
  { group: "Time", header: "Result after (min)", width: 16, align: "center" },
  { group: "Staff", header: "Judge", width: 22, align: "left" },
  { group: "Staff", header: "Recorder", width: 22, align: "left" },
  { group: "Staff", header: "Confirmed", width: 13, align: "center" },
  { group: "Outcome", header: "Score", width: 11, align: "center" },
  { group: "Outcome", header: "Ticket", width: 30, align: "left" },
  { group: "Outcome", header: "Schedule note", width: 30, align: "left" },
];

const overviewColumns: Column[] = [
  { group: "", header: "Stage", width: 24, align: "left" },
  { group: "", header: "Matches", width: 11, align: "center" },
  { group: "", header: "Complete", width: 11, align: "center" },
  { group: "", header: "Open", width: 11, align: "center" },
  { group: "", header: "Pending", width: 11, align: "center" },
  { group: "", header: "Progress", width: 16, align: "left" },
  { group: "", header: "Done", width: 10, align: "center" },
  { group: "", header: "Tickets", width: 11, align: "center" },
  { group: "", header: "Attendance", width: 13, align: "center" },
  { group: "", header: "Results", width: 11, align: "center" },
];

function progressBar(done: number, total: number): string {
  const filled = total === 0 ? 0 : Math.round((done / total) * 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

function sectionBar(sheet: Worksheet, row: number, columns: number, title: string): void {
  mergeFill(sheet, row, columns, INK);
  const cell = sheet.getCell(row, 1);
  cell.value = title.toUpperCase();
  cell.font = face(10, GOLD, true);
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(row).height = 22;
}

function tableHeader(sheet: Worksheet, row: number, headers: string[], accent: string): void {
  headers.forEach((header, index) => {
    const cell = sheet.getCell(row, index + 1);
    cell.value = header;
    cell.fill = solid(accent);
    cell.font = face(10, WHITE, true);
    cell.alignment = { vertical: "middle", horizontal: index === 0 ? "left" : "center", wrapText: true, indent: index === 0 ? 1 : 0 };
    cell.border = { bottom: { style: "medium", color: { argb: GOLD } } };
  });
  sheet.getRow(row).height = 22;
}

function addOverview(workbook: Workbook, book: TournamentReportBook): void {
  const width = overviewColumns.length;
  const sheet = workbook.addWorksheet("Overview", {
    properties: { defaultRowHeight: 20, showGridLines: false },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.7, bottom: 0.55, header: 0.28, footer: 0.28 },
    },
    headerFooter: {
      oddHeader: `&L&8&K8C6A2FTournament overview&R&8&K6E655CApex Horizon`,
      oddFooter: `&L&8Staff report&C&8Overview&R&8Page &P of &N`,
    },
    views: [{ state: "frozen", ySplit: 4, showGridLines: false, zoomScale: 110, activeCell: "A6" }],
  });
  sheet.properties.tabColor = { argb: INK };
  overviewColumns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
  });
  banner(
    sheet,
    width,
    "Tournament overview",
    "Where the bracket stands, what was recorded, and who carried the work. The To do sheet lists what still needs a hand.",
    `${book.tournamentName}   ·   ${book.overview.source}   ·   ${book.generatedLabel}`,
  );

  // KPI tiles: two columns each, value on top, caption below.
  book.overview.kpis.slice(0, 5).forEach((kpi, index) => {
    const from = index * 2 + 1;
    for (const [row, text, font] of [
      [6, kpi.value, face(18, INK_TEXT, true)],
      [7, kpi.label, face(9, MUTED)],
    ] as const) {
      sheet.mergeCells(row, from, row, from + 1);
      const cell = sheet.getCell(row, from);
      cell.value = safeText(text);
      cell.font = font;
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
      for (const column of [from, from + 1]) {
        const part = sheet.getCell(row, column);
        part.fill = solid(IVORY);
        part.border = row === 6 ? { top: { style: "medium", color: { argb: GOLD } } } : { bottom: HAIR };
      }
    }
  });
  sheet.getRow(6).height = 32;
  sheet.getRow(7).height = 20;

  let row = 9;
  sectionBar(sheet, row, width, "By stage");
  row += 1;
  tableHeader(sheet, row, overviewColumns.map((column) => column.header), TEAL);
  row += 1;
  const stageRows = [...book.overview.stages, book.overview.totals];
  stageRows.forEach((stage, index) => {
    const isTotal = index === stageRows.length - 1;
    const fill = isTotal ? PAPER : index % 2 === 0 ? IVORY : WHITE;
    const next = rowWriter(sheet, row);
    writeText(next(), stage.stage, fill, "left", INK_TEXT, isTotal);
    for (const value of [stage.matches, stage.complete, stage.open, stage.pending]) {
      writeNumber(next(), value, fill, isTotal);
    }
    writeText(next(), progressBar(stage.complete, stage.matches), fill, "left", TEAL);
    const done = next();
    done.value = stage.matches === 0 ? 0 : stage.complete / stage.matches;
    done.numFmt = "0%";
    paint(done, fill, face(10, INK_TEXT, true), "center");
    for (const value of [stage.tickets, stage.attendance, stage.results]) {
      writeNumber(next(), value, fill, isTotal);
    }
    row += 1;
  });
  if (book.overview.stages.length === 0) {
    emptyNote(sheet, row, width, "The bracket has no matches yet.");
    row += 1;
  }

  row += 1;
  sectionBar(sheet, row, width, "Most active staff");
  row += 1;
  tableHeader(sheet, row, ["Person", "Rounds", "Games"], COPPER);
  row += 1;
  if (book.overview.topStaff.length === 0) {
    emptyNote(sheet, row, 3, "No staff work has been marked yet.");
    row += 1;
  }
  book.overview.topStaff.forEach((person, index) => {
    const fill = index % 2 === 0 ? IVORY : WHITE;
    writeText(sheet.getCell(row, 1), person.username, fill, "left", INK_TEXT, true);
    writeNumber(sheet.getCell(row, 2), person.rounds, fill);
    writeNumber(sheet.getCell(row, 3), person.games, fill);
    row += 1;
  });

  row += 1;
  sectionBar(sheet, row, width, "Schedules");
  row += 1;
  book.overview.schedules.forEach((entry, index) => {
    const fill = index % 2 === 0 ? IVORY : WHITE;
    sheet.mergeCells(row, 1, row, 2);
    const label = sheet.getCell(row, 1);
    label.value = entry.label;
    paint(label, PAPER, face(10, INK_TEXT, true), "left");
    sheet.mergeCells(row, 3, row, 4);
    writeText(sheet.getCell(row, 3), entry.value, fill, "center", INK_TEXT, true);
    row += 1;
  });
}

const priorityStyle: Record<TodoLine["priority"], { label: string; fill: string; color: string }> = {
  high: { label: "High", fill: DW, color: CLAY },
  medium: { label: "Medium", fill: TIE, color: COPPER },
  low: { label: "Low", fill: IVORY, color: SLATE },
};

function addTodo(workbook: Workbook, book: TournamentReportBook): void {
  const count = book.todo.length;
  const high = book.todo.filter((item) => item.priority === "high").length;
  const { sheet, headerRow, firstDataRow } = prepare(workbook, {
    name: "To do",
    title: "To do",
    subtitle:
      "Cases that need a hand, sorted by priority and then bracket order. Each row names the match, its ticket, and the command that settles it. Matches settled without a ticket (forfeits) are not asked for attendance.",
    meta: `${book.tournamentName}   ·   ${count === 1 ? "1 item" : `${count} items`}   ·   ${high} high   ·   ${book.generatedLabel}`,
    accent: CLAY,
    accentDeep: CLAY_DEEP,
    columns: todoColumns,
    freezeColumns: 2,
  });
  if (count === 0) {
    emptyNote(sheet, firstDataRow, todoColumns.length, "Nothing to fix. Every check passed.");
    return;
  }
  book.todo.forEach((item, index) => {
    const rowNumber = firstDataRow + index;
    const fill = index % 2 === 0 ? IVORY : WHITE;
    const style = priorityStyle[item.priority];
    const next = rowWriter(sheet, rowNumber);
    writeText(next(), style.label, style.fill, "center", style.color, true);
    writeText(next(), item.check, fill, "left", INK_TEXT, true);
    writeText(next(), item.stage, fill, "left");
    writeNumber(next(), item.matchId, fill);
    writeText(next(), item.match, fill, "left");
    writeText(next(), item.ticket, fill, "left", item.ticket === "—" ? MUTED : INK_TEXT);
    writeText(next(), item.fix, fill, "left", LINK);
    writeText(next(), item.detail, fill, "left", MUTED);
    sheet.getRow(rowNumber).height = rowHeight(Math.max(1, Math.ceil(item.detail.length / 46)));
  });
  finishTable(sheet, headerRow, firstDataRow + count - 1, todoColumns.length);
}

const statusStyle: Record<ScheduleLine["status"], { fill: string; color: string }> = {
  Completed: { fill: WIN, color: INK_TEXT },
  Overdue: { fill: DW, color: CLAY },
  Upcoming: { fill: TIE, color: COPPER },
};

function addSchedules(workbook: Workbook, book: TournamentReportBook): void {
  const count = book.schedules.length;
  const tally = (status: ScheduleLine["status"]) => book.schedules.filter((line) => line.status === status).length;
  const { sheet, headerRow, firstDataRow } = prepare(workbook, {
    name: "Schedules",
    title: "Schedules",
    subtitle:
      "Every schedule, with or without a result, in bracket order. Result after counts minutes from the scheduled time to the declaration. Confirmed shows who pressed Present before the match started.",
    meta: `${book.tournamentName}   ·   ${count} schedules   ·   ${tally("Completed")} completed · ${tally("Overdue")} overdue · ${tally("Upcoming")} upcoming   ·   ${book.generatedLabel}`,
    accent: SLATE,
    accentDeep: SLATE_DEEP,
    columns: scheduleColumns,
    freezeColumns: 3,
  });
  if (count === 0) {
    emptyNote(sheet, firstDataRow, scheduleColumns.length, "No schedules have been created for this tournament yet.");
    return;
  }
  book.schedules.forEach((line, index) => {
    const rowNumber = firstDataRow + index;
    const fill = index % 2 === 0 ? IVORY : WHITE;
    const style = statusStyle[line.status];
    const next = rowWriter(sheet, rowNumber);
    writeText(next(), line.stage, fill, "left");
    writeNumber(next(), line.matchId, fill);
    writeText(next(), line.match, fill, "left");
    writeText(next(), line.status, style.fill, "center", style.color, true);
    writeText(next(), line.scheduledAt, fill, "center");
    writeText(next(), line.declaredAt, fill, "center", line.declaredAt === "—" ? MUTED : INK_TEXT);
    minutesCell(next(), line.resultAfter, fill);
    writeText(next(), line.judge, fill, "left", line.judge === "Open" ? CLAY : INK_TEXT);
    writeText(next(), line.recorder, fill, "left", line.recorder === "Open" ? CLAY : INK_TEXT);
    writeText(next(), line.confirmed, fill, "center", line.confirmed === "None" ? MUTED : INK_TEXT);
    writeText(next(), line.score, fill, "center", line.score === "—" ? MUTED : INK_TEXT, line.score !== "—");
    writeText(next(), line.ticket, fill, "left", line.ticket === "—" ? MUTED : INK_TEXT);
    writeText(next(), line.note, fill, "left", line.note === "—" ? MUTED : INK_TEXT);
    sheet.getRow(rowNumber).height = rowHeight(Math.max(1, Math.ceil(line.note.length / 30)));
  });
  finishTable(sheet, headerRow, firstDataRow + count - 1, scheduleColumns.length);
}

function addAttendance(workbook: Workbook, book: TournamentReportBook): void {
  const count = book.attendance.length;
  const marks = count === 1 ? "1 active mark" : `${count} active marks`;
  const { sheet, headerRow, firstDataRow } = prepare(workbook, {
    name: "Attendance",
    title: "Attendance report",
    subtitle: "Active marks only. Deleted attendance is left out. Score proof is taken from the result declaration of the same match, when one exists.",
    meta: `${book.tournamentName}   ·   ${marks}   ·   ${book.generatedLabel}`,
    accent: TEAL,
    accentDeep: TEAL_DEEP,
    columns: attendanceColumns,
    freezeColumns: 3,
  });

  if (count === 0) {
    emptyNote(sheet, firstDataRow, attendanceColumns.length, "No attendance has been marked for this tournament yet.");
    return;
  }

  const scoreColumn = attendanceColumns.findIndex((column) => column.header === "Team 1") + 1;
  let team1 = 0;
  let team2 = 0;
  let games = 0;
  book.attendance.forEach((line, index) => {
    const rowNumber = firstDataRow + index;
    const fill = index % 2 === 0 ? IVORY : WHITE;
    const next = rowWriter(sheet, rowNumber);
    writeText(next(), line.stage, fill, "left");
    writeNumber(next(), line.matchId, fill);
    writeText(next(), line.match, fill, "left");
    writeText(next(), line.ticket, fill, "left", line.ticket === "—" ? MUTED : INK_TEXT);
    writeText(next(), line.judge, fill, "left");
    writeId(next(), line.judgeId, fill);
    writeText(next(), line.recorder, fill, "left");
    writeId(next(), line.recorderId, fill);
    writeText(next(), line.bothSeats ? "Both seats" : "Split", line.bothSeats ? TIE : fill, "center", INK_TEXT, line.bothSeats);
    writeNumber(next(), line.team1, fill);
    writeNumber(next(), line.team2, fill);
    writeNumber(next(), line.games, fill, true);
    writeText(next(), line.winner, line.tie ? TIE : WIN, "left", INK_TEXT, !line.tie);
    writeText(next(), line.remark, line.defaultWin ? DW : fill, "center", line.defaultWin ? CLAY : MUTED, line.defaultWin);
    const recordingLines = writeLinks(next(), line.recordings, "Open recording", fill);
    const proofLines = writeLinks(next(), line.proof, "Open proof", fill);
    yesNo(next(), line.resultDeclared, fill);
    writeText(next(), line.markedBy, fill, "left");
    writeText(next(), line.markedAt, fill, "center");
    sheet.getRow(rowNumber).height = rowHeight(Math.max(recordingLines, proofLines));
    team1 += line.team1;
    team2 += line.team2;
    games += line.games;
  });

  const last = firstDataRow + count - 1;
  finishTable(sheet, headerRow, last, attendanceColumns.length);
  const total = last + 1;
  sheet.getRow(total).height = 24;
  for (let column = 1; column <= attendanceColumns.length; column += 1) {
    totalBlank(sheet.getCell(total, column));
  }
  totalLabel(sheet.getCell(total, 1), "TOTAL");
  totalLabel(sheet.getCell(total, 3), count === 1 ? "1 mark" : `${count} marks`);
  totalNumber(sheet.getCell(total, scoreColumn), team1);
  totalNumber(sheet.getCell(total, scoreColumn + 1), team2);
  totalNumber(sheet.getCell(total, scoreColumn + 2), games);
}

function addWork(workbook: Workbook, book: TournamentReportBook): void {
  const people = book.work.length;
  const who = people === 1 ? "1 person" : `${people} people`;
  const { sheet, headerRow, firstDataRow } = prepare(workbook, {
    name: "Work count",
    title: "Staff work",
    subtitle:
      "A round is one attendance mark. Games are team 1 + team 2. The same person on both seats counts only under Both seats. Default wins stay inside those seats and are listed again so they can be spotted. That column is not added to Total rounds. Its total counts one per person who sat the mark.",
    meta: `${book.tournamentName}   ·   ${book.payModeLabel}   ·   Default wins included   ·   ${who}   ·   ${book.generatedLabel}`,
    accent: COPPER,
    accentDeep: COPPER_DEEP,
    columns: workColumns,
    freezeColumns: 2,
  });

  if (people === 0) {
    emptyNote(sheet, firstDataRow, workColumns.length, "No staff work has been marked for this tournament yet.");
    return;
  }

  const totals = {
    both: 0,
    judge: 0,
    recorder: 0,
    defaultWins: 0,
    totalRounds: 0,
    gamesBoth: 0,
    gamesJudge: 0,
    gamesRecorder: 0,
    totalGames: 0,
  };

  book.work.forEach((line, index) => {
    const rowNumber = firstDataRow + index;
    const fill = index % 2 === 0 ? IVORY : WHITE;
    const row = sheet.getRow(rowNumber);
    row.height = 22;
    writeText(sheet.getCell(rowNumber, 1), line.username, fill, "left", INK_TEXT, true);
    writeId(sheet.getCell(rowNumber, 2), line.userId, fill);
    writeNumber(sheet.getCell(rowNumber, 3), line.both, line.both > 0 ? TIE : fill, line.both > 0);
    writeNumber(sheet.getCell(rowNumber, 4), line.judge, fill);
    writeNumber(sheet.getCell(rowNumber, 5), line.recorder, fill);
    writeNumber(sheet.getCell(rowNumber, 6), line.defaultWins, line.defaultWins > 0 ? DW : fill, line.defaultWins > 0);
    writeNumber(sheet.getCell(rowNumber, 7), line.totalRounds, fill, true);
    writeNumber(sheet.getCell(rowNumber, 8), line.gamesBoth, line.gamesBoth > 0 ? TIE : fill);
    writeNumber(sheet.getCell(rowNumber, 9), line.gamesJudge, fill);
    writeNumber(sheet.getCell(rowNumber, 10), line.gamesRecorder, fill);
    writeNumber(sheet.getCell(rowNumber, 11), line.totalGames, fill, true);
    totals.both += line.both;
    totals.judge += line.judge;
    totals.recorder += line.recorder;
    totals.defaultWins += line.defaultWins;
    totals.totalRounds += line.totalRounds;
    totals.gamesBoth += line.gamesBoth;
    totals.gamesJudge += line.gamesJudge;
    totals.gamesRecorder += line.gamesRecorder;
    totals.totalGames += line.totalGames;
  });

  const last = firstDataRow + people - 1;
  finishTable(sheet, headerRow, last, workColumns.length);
  const total = last + 1;
  sheet.getRow(total).height = 24;
  totalLabel(sheet.getCell(total, 1), "TOTAL");
  totalBlank(sheet.getCell(total, 2));
  totalNumber(sheet.getCell(total, 3), totals.both);
  totalNumber(sheet.getCell(total, 4), totals.judge);
  totalNumber(sheet.getCell(total, 5), totals.recorder);
  totalNumber(sheet.getCell(total, 6), totals.defaultWins);
  totalNumber(sheet.getCell(total, 7), totals.totalRounds);
  totalNumber(sheet.getCell(total, 8), totals.gamesBoth);
  totalNumber(sheet.getCell(total, 9), totals.gamesJudge);
  totalNumber(sheet.getCell(total, 10), totals.gamesRecorder);
  totalNumber(sheet.getCell(total, 11), totals.totalGames);
}

function addResults(workbook: Workbook, book: TournamentReportBook): void {
  const count = book.results.length;
  const declared = count === 1 ? "1 declared result" : `${count} declared results`;
  const { sheet, headerRow, firstDataRow } = prepare(workbook, {
    name: "Results",
    title: "Completed results",
    subtitle:
      "Scores declared on a schedule, in bracket order. Judge and recorder are the people assigned on that schedule. Outcome is a default win when the active attendance remark is DW, a tie when the scores match, and a decision otherwise.",
    meta: `${book.tournamentName}   ·   ${declared}   ·   ${book.generatedLabel}`,
    accent: VIOLET,
    accentDeep: VIOLET_DEEP,
    columns: resultColumns,
    freezeColumns: 3,
  });

  if (count === 0) {
    emptyNote(sheet, firstDataRow, resultColumns.length, "No results have been declared for this tournament yet.");
    return;
  }

  book.results.forEach((line, index) => {
    const rowNumber = firstDataRow + index;
    const fill = index % 2 === 0 ? IVORY : WHITE;
    const outcomeFill = line.defaultWin ? DW : line.tie ? TIE : fill;
    const next = rowWriter(sheet, rowNumber);
    writeText(next(), line.stage, fill, "left");
    writeNumber(next(), line.matchId, fill);
    writeText(next(), line.match, fill, "left");
    writeText(next(), line.state, fill, "center");
    writeNumber(next(), line.team1, fill);
    writeNumber(next(), line.team2, fill);
    writeText(next(), line.winner, line.tie ? TIE : WIN, "left", INK_TEXT, !line.tie);
    writeText(next(), line.outcome, outcomeFill, "center", line.defaultWin ? CLAY : INK_TEXT, line.defaultWin || line.tie);
    writeText(next(), line.judge, fill, "left");
    writeId(next(), line.judgeId, fill);
    writeText(next(), line.recorder, fill, "left");
    writeId(next(), line.recorderId, fill);
    writeText(next(), line.declaredBy, fill, "left");
    writeId(next(), line.declaredById, fill);
    writeText(next(), line.declaredAt, fill, "center");
    writeText(next(), line.scheduledAt, fill, "center");
    minutesCell(next(), line.resultAfter, fill);
    yesNo(next(), line.attendanceMarked, fill);
    writeText(next(), line.notes, fill, "left");
    writeText(next(), line.scheduleNote, fill, "left");
    const transcriptLines = writeLinks(next(), line.transcript ? [line.transcript] : [], "Open transcript", fill);
    const recordingLines = writeLinks(next(), line.recordings, "Open recording", fill);
    const proofLines = writeLinks(next(), line.proof, "Open proof", fill);
    const noteLines = Math.max(1, Math.ceil(line.notes.length / 36), Math.ceil(line.scheduleNote.length / 28));
    sheet.getRow(rowNumber).height = rowHeight(Math.max(transcriptLines, recordingLines, proofLines, noteLines));
  });

  finishTable(sheet, headerRow, firstDataRow + count - 1, resultColumns.length);
}

function addConfiguration(workbook: Workbook, book: TournamentReportBook): void {
  const sheet = workbook.addWorksheet("Configuration", {
    properties: { defaultRowHeight: 20, showGridLines: false },
    pageSetup: {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      horizontalCentered: true,
      margins: { left: 0.6, right: 0.6, top: 0.7, bottom: 0.55, header: 0.28, footer: 0.28 },
    },
    headerFooter: {
      oddHeader: `&L&8&K8C6A2FTournament configuration&R&8&K6E655CApex Horizon`,
      oddFooter: `&L&8Staff report&C&8Configuration&R&8Page &P of &N`,
    },
    views: [{ state: "frozen", ySplit: 4, showGridLines: false, zoomScale: 120, activeCell: "A5" }],
  });
  sheet.properties.tabColor = { argb: STONE };
  sheet.getColumn(1).width = 32;
  sheet.getColumn(2).width = 78;

  mergeFill(sheet, 1, 2, INK);
  const title = sheet.getCell(1, 1);
  title.value = "Tournament configuration";
  title.font = face(20, WHITE, true);
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 36;

  mergeFill(sheet, 2, 2, INK_SOFT);
  const subtitle = sheet.getCell(2, 1);
  subtitle.value = "Roles, channels, categories, and how far this world has progressed. The API key stays encrypted and is not written here.";
  subtitle.font = face(10, "FFE7D7B8", false, true);
  subtitle.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
  sheet.getRow(2).height = 48;

  mergeFill(sheet, 3, 2, INK_SOFT);
  const meta = sheet.getCell(3, 1);
  meta.value = safeText(`${book.tournamentName}   ·   ${book.generatedLabel}`);
  meta.font = face(10, GOLD);
  meta.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(3).height = 20;

  mergeFill(sheet, 4, 2, GOLD);
  sheet.getRow(4).height = 6;

  let row = 5;
  let fieldIndex = 0;
  for (const entry of book.config) {
    if (entry.kind === "section") {
      if (row > 5) {
        sheet.getRow(row).height = 10;
        sheet.getCell(row, 1).fill = solid(WHITE);
        sheet.getCell(row, 2).fill = solid(WHITE);
        row += 1;
      }
      sheet.mergeCells(row, 1, row, 2);
      const cell = sheet.getCell(row, 1);
      cell.value = entry.title.toUpperCase();
      cell.font = face(10, GOLD, true);
      cell.fill = solid(INK);
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      sheet.getCell(row, 2).fill = solid(INK);
      sheet.getCell(row, 2).border = {};
      cell.border = {};
      sheet.getRow(row).height = 22;
      row += 1;
      fieldIndex = 0;
      continue;
    }

    const fill = fieldIndex % 2 === 0 ? IVORY : WHITE;
    const label = sheet.getCell(row, 1);
    label.value = entry.label;
    paint(label, PAPER, face(10, INK_TEXT, true), "left");
    const value = sheet.getCell(row, 2);
    const shown = safeText(entry.value);
    if (entry.link) {
      value.value = { text: shown, hyperlink: entry.link, tooltip: entry.link };
      value.numFmt = "@";
      paint(value, fill, { ...face(10, LINK), underline: "single" }, "left", true);
    } else {
      value.value = shown;
      value.numFmt = "@";
      paint(value, fill, face(10, shown === "Not configured" || shown === "—" ? MUTED : INK_TEXT), "left", shown.length > 70);
    }
    const lines = Math.max(1, Math.ceil(entry.value.length / 78));
    sheet.getRow(row).height = rowHeight(lines);
    fieldIndex += 1;
    row += 1;
  }
}

export async function buildTournamentReport(book: TournamentReportBook): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = "Apex Horizon";
  workbook.lastModifiedBy = "Apex Horizon";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = `${book.tournamentName} report`;
  workbook.subject = "Tournament operations report";
  workbook.description = "Overview, to do, schedules, attendance, staff work, declared results, and configuration.";
  addOverview(workbook, book);
  addTodo(workbook, book);
  addSchedules(workbook, book);
  addAttendance(workbook, book);
  addWork(workbook, book);
  addResults(workbook, book);
  addConfiguration(workbook, book);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
