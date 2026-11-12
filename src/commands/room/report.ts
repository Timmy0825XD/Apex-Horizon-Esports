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
const warnColor = 0xe67e22;

export type CreationReportOptions = {
  /** Replaces the default title, e.g. `Auto-room On`. */
  title?: string;
  /** `-#` line under the title, e.g. `Group B · Round 3`. */
  scope?: string | null;
  /** Extra lines after the counts. */
  intro?: string[];
  actorId: string;
  /** Footer verb: `Opened`, `Turned on`. */
  verb: string;
};

function uniqueIssues(rows: Array<{ issues: CaptainIssue[] }>): CaptainIssue[] {
  const seen = new Set<string>();
  const issues: CaptainIssue[] = [];
  for (const row of rows) {
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

function issueLine(issue: CaptainIssue): string {
  const team = `**${escapeDiscord(issue.teamName.trim() || "Unknown")}**`;
  if (issue.kind === "absent" && issue.discordId) {
    return `- ${formatUser(issue.discordId)} · ${team}`;
  }
  const tag = `**${escapeDiscord(issue.discordTag.trim() || "Unknown")}**`;
  const raw = issue.rawId.trim();
  return raw ? `- ${tag} · ${team} · \`${escapeDiscord(raw)}\`` : `- ${tag} · ${team}`;
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

function count(value: number, one: string, many: string): string {
  return value === 1 ? `**1** ${one}` : `**${value}** ${many}`;
}

export function creationReport(
  guild: Guild,
  tournamentName: string,
  result: OpenTicketsResult,
  options: CreationReportOptions,
): InteractionReplyOptions {
  const created = result.created.length;
  const held = result.capacity.overflow;
  const errors = result.failed.length - held;
  const withoutCaptain = result.created.filter((ticket) => ticket.absent.length > 0).length;
  const clean = errors === 0 && held === 0 && result.welcomeFailed === 0 && withoutCaptain === 0;
  const sheetMisses = result.failed.filter((row) => row.sheetMiss).length;
  const channelErrors = result.failed.filter((row) => row.code === "discord" || row.code === "duplicate").length;
  const issues = uniqueIssues([...result.failed, ...result.created.map((ticket) => ({ issues: ticket.absent }))]);
  const absent = issues.filter((issue) => issue.kind === "absent");
  const invalid = issues.filter((issue) => issue.kind === "invalid");

  const tone = created > 0 && clean ? "success" : created > 0 || options.title ? "warn" : "error";
  const emoji = tone === "success" ? emojis.success : tone === "error" ? emojis.error : emojis.info;
  const color = tone === "success" ? embedColors.success : tone === "error" ? embedColors.error : warnColor;
  const title =
    options.title ?? (created > 0 && clean ? "Battle Tickets Created" : created > 0 ? "Battle Tickets Opened" : "No Tickets Opened");
  const heading = options.scope ? `## ${emoji} ${title}\n-# ${options.scope}` : `## ${emoji} ${title}`;
  const tournamentLine = `${emojis.torneo} **${escapeDiscord(tournamentName)}**`;

  const container = new ContainerBuilder().setAccentColor(color);
  const icon = guild.iconURL({ extension: "png", size: 128 });
  if (icon) {
    container.addSectionComponents(headingWithThumbnail(heading, icon, tournamentLine));
  } else {
    container.addTextDisplayComponents(textBlock(heading), textBlock(tournamentLine));
  }
  container.addSeparatorComponents(divider());
  if (options.intro?.length) {
    container.addTextDisplayComponents(textBlock(options.intro.join("\n")));
  }

  const result_ = [
    `${emojis.channels} **Created** \`${created}\` · **Errors** \`${errors}\` · **Waiting** \`${held}\``,
  ];
  if (sheetMisses > 0) {
    result_.push(`- ${count(sheetMisses, "match is", "matches are")} not on the stored sheet.`);
  }
  if (channelErrors > 0) {
    result_.push(`- ${count(channelErrors, "channel", "channels")} could not be created.`);
  }
  if (withoutCaptain > 0) {
    result_.push(
      `- ${count(withoutCaptain, "ticket", "tickets")} opened without a captain. The tournament organisers were pinged inside.`,
    );
  }
  if (result.welcomeFailed > 0) {
    result_.push(
      `- ${count(result.welcomeFailed, "ticket", "tickets")} opened, but the welcome message failed. The channel is still there.`,
    );
  }
  container.addTextDisplayComponents(textBlock(result_.join("\n")));

  const space = [
    `${emojis.categories} **Categories** \`${result.capacity.categories}\` · **Free slots** \`${result.capacity.slotsBefore}\` → \`${result.capacity.slotsAfter}\``,
  ];
  if (held > 0) {
    space.push(
      result.capacity.categories === 0
        ? `- ${count(held, "match is", "matches are")} still waiting. No open-ticket category is available.`
        : `- ${count(held, "match is", "matches are")} still waiting. The assigned categories are full (**50** channels each).`,
    );
  }
  container.addTextDisplayComponents(textBlock(space.join("\n")));

  if (absent.length > 0 || invalid.length > 0) {
    const groups = [`### ${emojis.error} Issues`];
    if (absent.length > 0) {
      groups.push(issueGroup("Not in this server", absent));
    }
    if (invalid.length > 0) {
      groups.push(issueGroup("Invalid Discord ID", invalid));
    }
    container.addSeparatorComponents(divider()).addTextDisplayComponents(textBlock(groups.join("\n")));
  }

  const available = formatHelpEntry("room available", roomCommandIdFor(guild.id));
  const at = Math.floor(Date.now() / 1000);
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`-# ${options.verb} by ${formatUser(options.actorId)} · <t:${at}:F> · waiting matches: ${available}`),
    );

  return {
    flags: [...v2Flags],
    allowedMentions: { parse: [] },
    components: [container],
  };
}
