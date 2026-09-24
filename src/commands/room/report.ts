import { ContainerBuilder, type Guild, type InteractionReplyOptions } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatHelpEntry, formatUser } from "../../lib/formatters.js";
import { roomCommandIdFor } from "../../lib/register-slash.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import type { CaptainIssue } from "./bracket.js";
import { escapeDiscord } from "./labels.js";
import type { OpenTicketsResult, TicketFailure } from "./open.js";

const ISSUE_LIMIT = 20;

export type CreationReportOptions = {
  title?: string;
  intro?: string[];
};

function uniqueIssues(failed: TicketFailure[]): CaptainIssue[] {
  const seen = new Set<string>();
  const issues: CaptainIssue[] = [];
  for (const row of failed) {
    for (const issue of row.issues) {
      const key = `${issue.kind}:${issue.discordId ?? issue.rawId}:${issue.discordTag.toLowerCase()}:${issue.teamName.toLowerCase()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      issues.push(issue);
    }
  }
  return issues;
}

function identityLabel(issue: CaptainIssue): string {
  const tag = escapeDiscord(issue.discordTag.trim() || "Unknown");
  const team = escapeDiscord(issue.teamName.trim() || "Unknown");
  return `(**${tag}** / **${team}**)`;
}

function issueLine(issue: CaptainIssue): string {
  const label = identityLabel(issue);
  if (issue.kind === "absent" && issue.discordId) {
    return `- ${formatUser(issue.discordId)} ${label}`;
  }
  const raw = issue.rawId.trim();
  return raw ? `- ${label} — \`${escapeDiscord(raw)}\`` : `- ${label}`;
}

function issueGroup(title: string, issues: CaptainIssue[]): string {
  const shown = issues.slice(0, ISSUE_LIMIT).map(issueLine);
  const extra = issues.length - shown.length;
  const lines = [`**${title}**`, ...shown];
  if (extra > 0) {
    lines.push(`*And **${extra}** more.*`);
  }
  return lines.join("\n");
}

export function creationReport(
  guild: Guild,
  tournamentName: string,
  result: OpenTicketsResult,
  options?: CreationReportOptions,
): InteractionReplyOptions {
  const created = result.created.length;
  const held = result.capacity.overflow;
  const errors = result.failed.length - held;
  const succeeded = created - result.welcomeFailed;
  const clean = errors === 0 && held === 0 && result.welcomeFailed === 0;
  const sheetMisses = result.failed.filter((row) => row.sheetMiss).length;
  const channelErrors = result.failed.filter((row) => row.code === "discord" || row.code === "duplicate").length;
  const issues = uniqueIssues(result.failed);
  const absent = issues.filter((issue) => issue.kind === "absent");
  const invalid = issues.filter((issue) => issue.kind === "invalid");
  const tone = options?.title ? (created > 0 && clean ? "success" : "info") : created > 0 && clean ? "success" : created > 0 ? "info" : "error";
  const title =
    options?.title ??
    (created > 0 && clean ? "Battle tickets created" : created > 0 ? "Battle tickets opened" : "No tickets opened");
  const emoji = tone === "success" ? emojis.success : tone === "error" ? emojis.error : emojis.info;
  const color = tone === "success" ? embedColors.success : tone === "error" ? embedColors.error : embedColors.info;
  const tournamentLine = `${emojis.torneo} **Tournament:** **${escapeDiscord(tournamentName)}**`;
  const container = new ContainerBuilder().setAccentColor(color);
  const icon = guild.iconURL({ extension: "png", size: 128 });
  if (icon) {
    container.addSectionComponents(headingWithThumbnail(`# ${emoji} ${title}`, icon, tournamentLine));
  } else {
    container.addTextDisplayComponents(textBlock(`# ${emoji} ${title}`), textBlock(tournamentLine));
  }
  if (options?.intro?.length) {
    container.addTextDisplayComponents(textBlock(options.intro.join("\n")));
  }

  const counts = [`**Created:** **${created}**`, `**Succeeded:** **${succeeded}**`, `**Errors:** **${errors}**`].join("  ·  ");
  const notes: string[] = [];
  if (sheetMisses > 0) {
    notes.push(
      sheetMisses === 1
        ? "**1** match is not on the stored sheet."
        : `**${sheetMisses}** matches are not on the stored sheet.`,
    );
  }
  if (channelErrors > 0) {
    notes.push(
      channelErrors === 1
        ? "**1** channel could not be created."
        : `**${channelErrors}** channels could not be created.`,
    );
  }
  if (result.welcomeFailed > 0) {
    notes.push(
      result.welcomeFailed === 1
        ? "**1** ticket opened, but the welcome message failed. The channel is still there."
        : `**${result.welcomeFailed}** tickets opened, but the welcome message failed. The channels are still there.`,
    );
  }

  container.addSeparatorComponents(divider()).addTextDisplayComponents(textBlock(`### ${emojis.channels} Result`), textBlock(counts));
  if (notes.length > 0) {
    container.addTextDisplayComponents(textBlock(notes.join("\n")));
  }

  const space = [
    `**Categories:** **${result.capacity.categories}**`,
    `**Free slots:** **${result.capacity.slotsBefore}** → **${result.capacity.slotsAfter}**`,
  ].join("  ·  ");
  const spaceNote =
    held > 0 && result.capacity.categories === 0
      ? held === 1
        ? "> **1** match is still waiting. No open-ticket category is available."
        : `> **${held}** matches are still waiting. No open-ticket category is available.`
      : held === 1
        ? "> **1** match is still waiting. The assigned categories cannot hold it (**50** channels each)."
        : held > 1
          ? `> **${held}** matches are still waiting. The assigned categories cannot hold them (**50** channels each).`
          : "";
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`### ${emojis.categories} Category space`), textBlock(space));
  if (spaceNote) {
    container.addTextDisplayComponents(textBlock(spaceNote));
  }

  if (absent.length > 0 || invalid.length > 0) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(textBlock(`### ${emojis.error} Issues`));
    if (absent.length > 0) {
      container.addTextDisplayComponents(textBlock(issueGroup("Not in this server", absent)));
    }
    if (invalid.length > 0) {
      container.addTextDisplayComponents(textBlock(issueGroup("Invalid Discord ID", invalid)));
    }
  }

  const available = formatHelpEntry("room available", roomCommandIdFor(guild.id));
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# ${emojis.info} Open matches still waiting are listed with ${available}.`));

  return {
    flags: [...v2Flags],
    allowedMentions: { parse: [] },
    components: [container],
  };
}
