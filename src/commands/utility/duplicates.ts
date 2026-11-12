import { type Attachment, type ChatInputCommandInteraction } from "discord.js";
import { emojis } from "../../emojis.js";
import { actorMatches } from "../../lib/command-access.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import { isComparableGameId, loadOfficialBannedGameIds, normalizeGameId } from "../tournament/banned-ids.js";
import { SheetError } from "../tournament/sheet.js";
import { escapeDiscord } from "../room/labels.js";
import { actorFooter, deferUtility, respondUtility, utilityCard, utilityError } from "./view.js";

const MAX_LISTED = 25;
const MAX_FILE_BYTES = 512 * 1024;

type IdKind = "discord" | "game";

export type DuplicateHit = { kind: IdKind; value: string; count: number };

export type DuplicatesReport = {
  total: number;
  duplicates: DuplicateHit[];
  banned: string[];
  invalid: string[];
};

function classify(token: string): { kind: IdKind; key: string } | null {
  if (/^\d{17,20}$/.test(token)) {
    return { kind: "discord", key: token };
  }
  if (isComparableGameId(token)) {
    return { kind: "game", key: normalizeGameId(token) };
  }
  return null;
}

/** Splits by whitespace; Discord IDs match exactly, game IDs ignore case. Order of first appearance. */
export function checkIds(input: string, bannedGameIds: Set<string>): DuplicatesReport {
  const tokens = input.split(/\s+/).filter(Boolean);
  const seen = new Map<string, DuplicateHit>();
  const banned: string[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    const parsed = classify(token);
    if (!parsed) {
      if (!invalid.includes(token)) {
        invalid.push(token);
      }
      continue;
    }
    const key = `${parsed.kind}:${parsed.key}`;
    const hit = seen.get(key);
    if (hit) {
      hit.count += 1;
      continue;
    }
    seen.set(key, { kind: parsed.kind, value: parsed.key, count: 1 });
    if (parsed.kind === "game" && bannedGameIds.has(parsed.key)) {
      banned.push(parsed.key);
    }
  }

  return {
    total: tokens.length,
    duplicates: [...seen.values()].filter((hit) => hit.count > 1),
    banned,
    invalid,
  };
}

function listed(lines: string[]): string {
  const shown = lines.slice(0, MAX_LISTED).join("\n");
  return lines.length > MAX_LISTED ? `${shown}\n-# and ${lines.length - MAX_LISTED} more` : shown;
}

function duplicateLine(hit: DuplicateHit): string {
  const who = hit.kind === "discord" ? `${formatUser(hit.value)} \`${hit.value}\`` : `Game ID \`${hit.value}\``;
  return `- ${who} · **${hit.count}** times`;
}

function isTxt(file: Attachment): boolean {
  return file.name.toLowerCase().endsWith(".txt") || (file.contentType ?? "").startsWith("text/plain");
}

async function readTxt(file: Attachment): Promise<string | null> {
  const response = await fetch(file.url, { redirect: "follow" }).catch(() => null);
  return response?.ok ? response.text() : null;
}

export async function handleDuplicates(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await actorMatches(interaction, { admin: true, organiser: true }))) {
    await respondUtility(
      interaction,
      utilityError("Admin or organiser required", "You need **Admin** or **Organiser** to check an ID list."),
    );
    return;
  }

  const typed = interaction.options.getString("ids")?.trim() || null;
  const file = interaction.options.getAttachment("file");
  if (typed && file) {
    await respondUtility(
      interaction,
      utilityError("Pick one source", "Use **ids** or **file**, not both at the same time."),
    );
    return;
  }
  if (!typed && !file) {
    await respondUtility(
      interaction,
      utilityError("No list given", "Write the IDs in **ids** or attach a `.txt` in **file**."),
    );
    return;
  }
  if (file && !isTxt(file)) {
    await respondUtility(
      interaction,
      utilityError("Need a .txt", "Attach a `.txt` with the Discord IDs or game IDs separated by spaces."),
    );
    return;
  }
  if (file && file.size > MAX_FILE_BYTES) {
    await respondUtility(
      interaction,
      utilityError("File too large", `Keep the \`.txt\` under **${MAX_FILE_BYTES / 1024} KB**.`),
    );
    return;
  }

  await deferUtility(interaction, true);

  const input = file ? await readTxt(file) : typed;
  if (input === null) {
    await respondUtility(interaction, utilityError("Could not read file", "Discord did not hand me the `.txt`. Try again."));
    return;
  }

  let bannedGameIds: Set<string>;
  try {
    bannedGameIds = await loadOfficialBannedGameIds();
  } catch (error) {
    const reason = error instanceof SheetError ? error.message : "The official banned-ID list could not be read.";
    await respondUtility(interaction, utilityError("Banned list unavailable", reason));
    return;
  }

  const report = checkIds(input, bannedGameIds);
  const checked = report.total - report.invalid.length;
  if (checked === 0) {
    await respondUtility(
      interaction,
      utilityError(
        "No IDs found",
        `${file ? "The `.txt`" : "Your list"} has no Discord IDs or game IDs. Separate them with spaces.`,
      ),
    );
    return;
  }

  const clean = report.duplicates.length === 0 && report.banned.length === 0;
  const blocks: string[] = [];
  if (report.duplicates.length > 0) {
    blocks.push(`### ${emojis.alert} Duplicated\n${listed(report.duplicates.map(duplicateLine))}`);
  }
  if (report.banned.length > 0) {
    blocks.push(
      `### ${emojis.banned} On the banned game-ID list\n${listed(report.banned.map((id) => `- Game ID \`${id}\``))}`,
    );
  }
  if (report.invalid.length > 0) {
    blocks.push(
      `-# Skipped, not a Discord or game ID: ${report.invalid
        .slice(0, MAX_LISTED)
        .map((token) => `\`${escapeDiscord(token).replace(/`/g, "")}\``)
        .join(" ")}`,
    );
  }
  if (clean) {
    blocks.unshift("No ID repeats and none is on the banned game-ID list.");
  }

  const title = clean ? `${emojis.success} List Is Clean` : `${emojis.alert} Issues Found`;
  await respondUtility(
    interaction,
    utilityCard({
      color: clean ? embedColors.success : embedColors.error,
      heading: `## ${title}\n-# ${checked} ${checked === 1 ? "ID" : "IDs"} checked`,
      blocks,
      footer: actorFooter("Checked", interaction.user.id),
      ephemeral: true,
    }),
  );
}
