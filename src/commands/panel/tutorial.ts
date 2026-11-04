import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { slashMention } from "../../lib/register-slash.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { helpCatalog } from "../bot/catalog.js";
import { catalogItem, lookFor } from "./guide-view.js";

export const MAX_GUIDES = 15;
const SESSION_MS = 10 * 60_000;

export const TUTORIAL_IDS = {
  family: "panel:tutorial:family",
  commands: "panel:tutorial:commands",
  send: "panel:tutorial:send",
  clear: "panel:tutorial:clear",
  cancel: "panel:tutorial:cancel",
} as const;

type Session = { family: number; queue: string[]; overflow: boolean; expiresAt: number };

/** One open panel per admin and server. The panel is ephemeral, so only its owner can press it. */
const sessions = new Map<string, Session>();

function sessionKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function sweep(now: number): void {
  for (const [key, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(key);
    }
  }
}

export function openSession(guildId: string, userId: string): Session {
  const now = Date.now();
  sweep(now);
  const session: Session = { family: 0, queue: [], overflow: false, expiresAt: now + SESSION_MS };
  sessions.set(sessionKey(guildId, userId), session);
  return session;
}

/** The live session, refreshed on use; null once it expired. */
export function touchSession(guildId: string, userId: string): Session | null {
  const now = Date.now();
  sweep(now);
  const session = sessions.get(sessionKey(guildId, userId));
  if (!session) {
    return null;
  }
  session.expiresAt = now + SESSION_MS;
  return session;
}

export function closeSession(guildId: string, userId: string): void {
  sessions.delete(sessionKey(guildId, userId));
}

function familySlashes(family: number): string[] {
  return helpCatalog[family]?.entries.map((entry) => entry.slash) ?? [];
}

export function pickFamily(session: Session, family: number): void {
  if (family >= 0 && family < helpCatalog.length) {
    session.family = family;
  }
  session.overflow = false;
}

/** Keeps picks from other families, drops what was deselected here and appends the new picks. */
export function pickCommands(session: Session, chosen: string[]): void {
  const here = familySlashes(session.family);
  const queue = session.queue.filter((slash) => !here.includes(slash) || chosen.includes(slash));
  for (const slash of chosen) {
    if (!queue.includes(slash)) {
      queue.push(slash);
    }
  }
  session.overflow = queue.length > MAX_GUIDES;
  session.queue = queue.slice(0, MAX_GUIDES);
}

export function clearQueue(session: Session): void {
  session.queue = [];
  session.overflow = false;
}

function familyMenu(session: Session): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(TUTORIAL_IDS.family)
      .setPlaceholder("Pick a command family")
      .addOptions(
        helpCatalog.map((family, index) => ({
          label: family.title,
          value: String(index),
          description: `${family.entries.length} commands · ${family.description}`.slice(0, 100),
          emoji: customEmoji(lookFor(family.title).emoji),
          default: index === session.family,
        })),
      ),
  );
}

function commandMenu(session: Session): ActionRowBuilder<StringSelectMenuBuilder> {
  const family = helpCatalog[session.family] ?? helpCatalog[0];
  const options = (family?.entries ?? []).map((entry) => ({
    label: `/${entry.slash}`,
    value: entry.slash,
    description: entry.summary.slice(0, 100),
    default: session.queue.includes(entry.slash),
  }));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(TUTORIAL_IDS.commands)
      .setPlaceholder(`Pick ${family?.title ?? ""} commands`)
      .setMinValues(0)
      .setMaxValues(options.length)
      .addOptions(options),
  );
}

function controls(session: Session): ActionRowBuilder<ButtonBuilder> {
  const count = session.queue.length;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TUTORIAL_IDS.send)
      .setStyle(ButtonStyle.Success)
      .setLabel(count > 0 ? `Send ${count} guide${count === 1 ? "" : "s"}` : "Send guides")
      .setDisabled(count === 0),
    new ButtonBuilder()
      .setCustomId(TUTORIAL_IDS.clear)
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Clear queue")
      .setDisabled(count === 0),
    new ButtonBuilder().setCustomId(TUTORIAL_IDS.cancel).setStyle(ButtonStyle.Danger).setLabel("Cancel"),
  );
}

function queueText(session: Session, guildId: string | null): string {
  const heading = `### Queue · ${session.queue.length} of ${MAX_GUIDES}`;
  if (session.queue.length === 0) {
    return `${heading}\n*Nothing queued yet. Pick a family, then the commands to explain.*`;
  }
  const lines = session.queue.map((slash, index) => {
    const family = catalogItem(slash)?.family.title;
    return `${index + 1}. ${slashMention(guildId, slash)}${family ? ` · *${family}*` : ""}`;
  });
  return `${heading}\n${lines.join("\n")}`;
}

export function buildTutorialPanel(session: Session, guildId: string | null) {
  const container = new ContainerBuilder()
    .setAccentColor(lookFor("Panel").color)
    .addTextDisplayComponents(
      textBlock(`## ${emojis.help} Staff Guides`),
      textBlock(
        "Pick the commands you want to explain to the team. Each one is posted in this channel as its own guide, in the order of the queue.",
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(familyMenu(session), commandMenu(session))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(queueText(session, guildId)));

  if (session.overflow) {
    container.addTextDisplayComponents(
      textBlock(`${emojis.alert} Only **${MAX_GUIDES}** guides fit in one send. The last picks were left out.`),
    );
  }

  container
    .addActionRowComponents(controls(session))
    .addTextDisplayComponents(
      textBlock("-# Only you can see this panel. Deselect a command to take it out. It expires after 10 minutes without use."),
    );

  return { flags: v2Flags, components: [container] };
}

export function buildExpiredPanel() {
  const container = new ContainerBuilder()
    .setAccentColor(lookFor("Panel").color)
    .addTextDisplayComponents(
      textBlock(`## ${emojis.info} Panel Expired`),
      textBlock("This guide picker was idle for 10 minutes. Run the command again to start a new queue."),
    );
  return { flags: v2Flags, components: [container] };
}
