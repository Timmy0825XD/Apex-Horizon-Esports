import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type User,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { formatUser } from "../../lib/formatters.js";
import { escapeDiscord } from "../room/labels.js";
import { BAN_DURATIONS } from "../user/durations.js";
import type { BanRequest, RosterHit } from "./store.js";

const COLORS = { pending: 0xf0b232, banned: 0xd8453d, unbanned: 0x3fae6a, dismissed: 0x80848e } as const;

/** What the card knows about the person behind the ID, read when the card is drawn. */
export type Target = {
  user: User | null;
  inServer: boolean;
  /** Present when the person is banned here: the tracked duration, or "Discord ban" when the bot did not record it. */
  bannedHere: string | null;
  hits: RosterHit[];
  /** Why this ID cannot be acted on (unknown account, owner, a bot…); null when it can. */
  blocker: string | null;
};

export function announcementLink(request: Pick<BanRequest, "guildId" | "channelId" | "sourceMessageId">): string {
  return `https://discord.com/channels/${request.guildId}/${request.channelId}/${request.sourceMessageId}`;
}

function utcStamp(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function text(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

function separator(): SeparatorBuilder {
  return new SeparatorBuilder().setDivider(true);
}

function heading(card: ContainerBuilder, content: string, user: User | null): void {
  if (user) {
    card.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(content))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 128 }))),
    );
    return;
  }
  card.addTextDisplayComponents(text(content));
}

export function rosterAlert(hits: RosterHit[], past = false): string | null {
  if (hits.length === 0) {
    return null;
  }
  const lines = hits.map(
    (hit) => `**${escapeDiscord(hit.tournamentName)}** · team **${escapeDiscord(hit.teamName)}** (${hit.slot})`,
  );
  const title = past ? "Was on an active tournament roster" : "Plays in an active tournament";
  return [`${emojis.alert} **${title}**`, ...lines].join("\n");
}

function identity(request: BanRequest): string {
  return `${formatUser(request.userId)} · \`${request.userId}\``;
}

function statusLine(request: BanRequest, target: Target): string {
  if (target.blocker) {
    return `${emojis.error} ${target.blocker}`;
  }
  const presence = target.inServer ? "In this server" : "Not in this server";
  if (request.kind === "unban") {
    return `${presence} · banned here (**${target.bannedHere ?? "Discord ban"}**)`;
  }
  return `${presence} · not banned here yet`;
}

function reasonLine(request: BanRequest): string {
  return `**Reason** ${request.reason ? escapeDiscord(request.reason) : "*Not stated in the announcement*"}`;
}

type Mode = "buttons" | "duration";

/** The card waiting for a decision. In "duration" mode the buttons give way to the duration list. */
export function pendingCard(request: BanRequest, target: Target, mode: Mode = "buttons"): ContainerBuilder {
  const unban = request.kind === "unban";
  const card = new ContainerBuilder().setAccentColor(COLORS.pending);
  const title = unban ? `### ${emojis.success} Unban request` : `### ${emojis.banned} Ban request`;
  heading(card, `${title}\n${identity(request)}\n${statusLine(request, target)}`, target.user);
  card.addSeparatorComponents(separator());
  card.addTextDisplayComponents(text(reasonLine(request)));
  const alert = rosterAlert(target.hits);
  if (alert) {
    card.addTextDisplayComponents(text(alert));
  }
  card.addSeparatorComponents(separator());
  if (!unban) {
    card.addTextDisplayComponents(text(`**Duration** ${request.duration}`));
  }
  card.addTextDisplayComponents(
    text(`-# From the ${unban ? "unban" : "ban"} announcement · [Jump to message](${announcementLink(request)})`),
  );

  if (mode === "duration" && !unban) {
    card.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`banwatch:pick:${request.id}`)
          .setPlaceholder("Pick a ban duration")
          .addOptions(BAN_DURATIONS.map((duration) => ({ label: duration, value: duration, default: duration === request.duration }))),
      ).toJSON(),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`banwatch:back:${request.id}`).setLabel("Back").setStyle(ButtonStyle.Secondary),
      ),
    );
    return card;
  }

  const blocked = Boolean(target.blocker);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`banwatch:confirm:${request.id}`)
      .setLabel(unban ? "Confirm unban" : "Confirm ban")
      .setStyle(ButtonStyle.Success)
      .setDisabled(blocked),
  );
  if (!unban) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`banwatch:duration:${request.id}`)
        .setLabel("Change duration")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(blocked),
    );
  }
  row.addComponents(
    new ButtonBuilder().setCustomId(`banwatch:cancel:${request.id}`).setLabel("Cancel").setStyle(ButtonStyle.Danger),
  );
  card.addActionRowComponents(row);
  return card;
}

/** The record left after the decision. */
export function resultCard(input: {
  request: BanRequest;
  target: Target;
  outcome: "banned" | "unbanned" | "dismissed";
  actorId: string;
  expiresAt?: Date | null;
  note?: string;
  at?: Date;
}): ContainerBuilder {
  const { request, target, outcome } = input;
  const at = input.at ?? new Date();
  const card = new ContainerBuilder().setAccentColor(COLORS[outcome]);
  const title =
    outcome === "banned"
      ? `### ${emojis.banned} Player banned\nThe ban announcement was applied in this server.`
      : outcome === "unbanned"
        ? `### ${emojis.success} Player unbanned\nThe unban announcement was applied in this server.`
        : `### Request dismissed\nNo change was made in this server.`;
  heading(card, `${title}\n${identity(request)}`, target.user);
  card.addSeparatorComponents(separator());

  const lines: string[] = [];
  if (outcome === "banned") {
    const expires = input.expiresAt ? ` · expires <t:${Math.floor(input.expiresAt.getTime() / 1000)}:D>` : "";
    lines.push(`**Duration** ${request.duration}${expires}`);
  }
  if (request.kind === "ban") {
    lines.push(reasonLine(request));
  }
  if (input.note) {
    lines.push(`*${input.note}*`);
  }
  if (lines.length > 0) {
    card.addTextDisplayComponents(text(lines.join("\n")));
  }
  const alert = rosterAlert(target.hits, outcome === "banned");
  if (alert) {
    card.addTextDisplayComponents(text(alert));
  }
  card.addSeparatorComponents(separator());
  const verb = outcome === "dismissed" ? "Dismissed" : "Approved";
  card.addTextDisplayComponents(
    text(`-# ${verb} by ${formatUser(input.actorId)} · ${utcStamp(at)} · [Jump to announcement](${announcementLink(request)})`),
  );
  return card;
}

/** One ping per announcement; deleted when its last card is decided. */
export function pingContent(roleId: string, kind: BanRequest["kind"], count: number, onRoster: number): string {
  const noun = kind === "unban" ? "unban" : "ban";
  const lines = [
    `<@&${roleId}> **${count}** ${noun} ${count === 1 ? "request" : "requests"} from this announcement ${count === 1 ? "needs" : "need"} a decision above.`,
  ];
  if (onRoster > 0) {
    lines.push(
      `${emojis.alert} **${onRoster}** of them ${onRoster === 1 ? "plays" : "play"} in an active tournament. Check the team before deciding.`,
    );
  }
  return lines.join("\n");
}
