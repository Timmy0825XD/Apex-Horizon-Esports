import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SectionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Guild,
  type ModalSubmitInteraction,
  type Role,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { decryptSecret } from "../../lib/crypto.js";
import { customEmoji, emojiAssetUrl } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { fetchChallongeTournament } from "../../lib/challonge.js";
import { formatRole, formatUser } from "../../lib/formatters.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import type { TournamentRecord } from "../tournament/fields.js";
import { findTournamentById } from "../tournament/store.js";
import { escapeDiscord } from "../room/labels.js";

/** Same accent as the Tournament family guides. */
const TOURNAMENT_ACCENT = 0xd4a017;
const MAX_ROUNDS = 25;
const YEAR_ROLL_MS = 180 * 24 * 60 * 60 * 1000;
export const DEADLINE_MODAL_PREFIX = "panel:deadline:";

export interface RoundWindow {
  start: Date;
  end: Date;
}

type ParsedRounds = { ok: true; rounds: RoundWindow[] } | { ok: false; error: string };

function error(title: string, body: string) {
  return {
    flags: [...v2Flags, MessageFlags.Ephemeral] as const,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(textBlock(`## ${emojis.error} ${title}`), textBlock(body)),
    ],
  };
}

function footer(userId: string): string {
  return `-# Posted by ${formatUser(userId)} · <t:${Math.floor(Date.now() / 1000)}:f>`;
}

function eyebrow(tournament: TournamentRecord): string {
  return `-# ${escapeDiscord(tournament.name)}`;
}

function httpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function isYoutubeUrl(raw: string): boolean {
  const url = httpsUrl(raw);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com");
}

function linkButton(label: string, url: string, emoji?: string): ButtonBuilder {
  const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
  return emoji ? button.setEmoji(customEmoji(emoji)) : button;
}

async function loadTournament(interaction: ChatInputCommandInteraction): Promise<TournamentRecord | null> {
  const id = interaction.options.getString("tournament", true);
  const tournament = interaction.guildId ? await findTournamentById(interaction.guildId, id).catch(() => null) : null;
  if (!tournament) {
    await interaction.reply(error("Unknown tournament", "Pick a tournament from the autocomplete list."));
  }
  return tournament;
}

// ---------- rules ----------

export function buildRulesPanel(input: {
  tournament: TournamentRecord;
  guild: Guild;
  spanish: string;
  english: string;
  actorId: string;
}): ContainerBuilder {
  const heading = `${eyebrow(input.tournament)}\n## ${emojis.rules} Tournament Rules`;
  const icon = input.guild.iconURL({ extension: "png", size: 128 });
  const container = new ContainerBuilder().setAccentColor(TOURNAMENT_ACCENT);
  if (icon) {
    container.addSectionComponents(headingWithThumbnail(heading, icon));
  } else {
    container.addTextDisplayComponents(textBlock(heading));
  }
  return container
    .addTextDisplayComponents(
      textBlock(
        [
          "Read the rules before your first match. Both versions say the same; pick your language.",
          "-# Lee las reglas antes de tu primer partido. Las dos versiones dicen lo mismo; elige tu idioma.",
        ].join("\n"),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        linkButton("Reglas en español", input.spanish, emojis.spanish),
        linkButton("English rules", input.english, emojis.english),
      ),
    )
    .addTextDisplayComponents(textBlock(footer(input.actorId)));
}

async function runRules(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const spanish = httpsUrl(interaction.options.getString("spanish", true));
  const english = httpsUrl(interaction.options.getString("english", true));
  if (!spanish || !english) {
    await interaction.reply(error("Invalid link", "Both rules links must be full `https://` links."));
    return;
  }
  const tournament = await loadTournament(interaction);
  if (!tournament) return;
  await interaction.reply({
    flags: v2Flags,
    components: [buildRulesPanel({ tournament, guild, spanish: spanish.href, english: english.href, actorId: interaction.user.id })],
    allowedMentions: { parse: [] },
  });
}

// ---------- bracket ----------

export function buildBracketPanel(input: {
  tournament: TournamentRecord;
  bracketUrl: string;
  shuffleUrl: string;
  actorId: string;
}): ContainerBuilder {
  const heading = `${eyebrow(input.tournament)}\n## ${emojis.torneo} Bracket`;
  const challongeIcon = emojiAssetUrl(emojis.challonge);
  const container = new ContainerBuilder().setAccentColor(TOURNAMENT_ACCENT);
  if (challongeIcon) {
    container.addSectionComponents(headingWithThumbnail(heading, challongeIcon));
  } else {
    container.addTextDisplayComponents(textBlock(heading));
  }
  return container
    .addSeparatorComponents(divider())
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(textBlock("### Challonge bracket\n-# Every match, result and the next round as it updates."))
        .setButtonAccessory(linkButton("Open bracket", input.bracketUrl, emojis.challonge)),
      new SectionBuilder()
        .addTextDisplayComponents(textBlock("### Team shuffle evidence\n-# The recorded shuffle that seeded the teams into the bracket."))
        .setButtonAccessory(linkButton("Watch on YouTube", input.shuffleUrl, emojis.link)),
    )
    .addTextDisplayComponents(textBlock(footer(input.actorId)));
}

async function runBracket(interaction: ChatInputCommandInteraction): Promise<void> {
  const shuffle = interaction.options.getString("shuffle", true).trim();
  if (!isYoutubeUrl(shuffle)) {
    await interaction.reply(error("Invalid video link", "The shuffle video must be a YouTube link (`youtube.com` or `youtu.be`)."));
    return;
  }
  const tournament = await loadTournament(interaction);
  if (!tournament) return;
  await interaction.deferReply();
  let bracketUrl: string | undefined;
  try {
    bracketUrl = (await fetchChallongeTournament(tournament.challongeId, decryptSecret(tournament.challongeKeyEnc))).fullUrl;
  } catch (cause) {
    console.error("Panel bracket link lookup failed", cause);
  }
  const safeBracket = bracketUrl ? httpsUrl(bracketUrl) : null;
  if (!safeBracket) {
    await interaction.deleteReply().catch(() => undefined);
    await interaction.followUp(
      error("Bracket link unavailable", `Challonge did not return the bracket link for **${escapeDiscord(tournament.name)}**. Check the tournament's Challonge ID and API key, then try again.`),
    );
    return;
  }
  await interaction.editReply({
    flags: v2Flags,
    components: [buildBracketPanel({ tournament, bracketUrl: safeBracket.href, shuffleUrl: httpsUrl(shuffle)!.href, actorId: interaction.user.id })],
    allowedMentions: { parse: [] },
  });
}

// ---------- deadline ----------

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dayMonth(date: Date): string {
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;
}

/**
 * One round per line, `dd/mm - dd/mm` (an optional `/yyyy` is accepted). Without a year, the first
 * date takes `now`'s year and the year moves forward when a date jumps back by months (December → January).
 */
export function parseRounds(text: string, now = new Date()): ParsedRounds {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { ok: false, error: "Write at least one round." };
  }
  if (lines.length > MAX_ROUNDS) {
    return { ok: false, error: `Up to **${MAX_ROUNDS}** rounds per panel.` };
  }
  let year = now.getUTCFullYear();
  let previous: Date | null = null;
  const dateAt = (day: number, month: number, explicitYear: number | null): Date | null => {
    let candidate = new Date(Date.UTC(explicitYear ?? year, month - 1, day));
    // Only a jump back of months (December → January) means a new year; a few days back is an overlap.
    if (explicitYear == null && previous && previous.getTime() - candidate.getTime() > YEAR_ROLL_MS) {
      year += 1;
      candidate = new Date(Date.UTC(year, month - 1, day));
    }
    if (candidate.getUTCDate() !== day || candidate.getUTCMonth() !== month - 1) {
      return null;
    }
    if (explicitYear != null) year = explicitYear;
    return candidate;
  };
  const rounds: RoundWindow[] = [];
  for (const [index, line] of lines.entries()) {
    const label = `Round ${index + 1}`;
    const match = line.match(/^(?:round\s*\d+\s*:?\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(?:-|–|—|→|to)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/i);
    if (!match) {
      return { ok: false, error: `**${label}** must look like \`10/10 - 14/10\`. Got \`${escapeDiscord(line.slice(0, 40))}\`.` };
    }
    const start = dateAt(Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : null);
    if (!start) {
      return { ok: false, error: `**${label}** starts on a date that does not exist.` };
    }
    if (previous && start <= previous) {
      return { ok: false, error: `**${label}** starts before **Round ${index}** ends.` };
    }
    previous = start;
    const end = dateAt(Number(match[4]), Number(match[5]), match[6] ? Number(match[6]) : null);
    if (!end) {
      return { ok: false, error: `**${label}** ends on a date that does not exist.` };
    }
    if (end < start) {
      return { ok: false, error: `**${label}** ends before it starts.` };
    }
    previous = end;
    rounds.push({ start, end });
  }
  return { ok: true, rounds };
}

export function buildDeadlinePanel(input: { tournament: TournamentRecord; rounds: RoundWindow[]; actorId: string }): ContainerBuilder {
  const list = formatRounds(input.rounds)
    .map((window, index) => `**Round ${index + 1}** · ${window}`)
    .join("\n");
  return new ContainerBuilder()
    .setAccentColor(TOURNAMENT_ACCENT)
    .addTextDisplayComponents(
      textBlock(`${eyebrow(input.tournament)}\n## ${emojis.calendar} Round Deadlines`),
      textBlock("Stay on top of these dates. Every round has to be played inside its window, so agree on a time early."),
      textBlock(list),
      textBlock(footer(input.actorId)),
    );
}

async function openDeadline(interaction: ChatInputCommandInteraction): Promise<void> {
  const tournament = await loadTournament(interaction);
  if (!tournament) return;
  const role = interaction.options.getRole("role", true);
  const rounds = new TextInputBuilder()
    .setCustomId("rounds")
    .setLabel("Rounds, one per line")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("10/10 - 14/10\n15/10 - 18/10\n19/10 - 21/10")
    .setRequired(true)
    .setMaxLength(1500);
  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(`${DEADLINE_MODAL_PREFIX}${tournament.id}:${role.id}`)
      .setTitle(`${tournament.name} · Deadline`.slice(0, 45))
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(rounds)),
  );
}

function canPing(role: Role, interaction: ModalSubmitInteraction): boolean {
  if (role.mentionable) return true;
  const channel = interaction.channel;
  const me = interaction.guild?.members.me;
  return Boolean(channel && me && "permissionsFor" in channel && channel.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone));
}

export async function handleDeadlineModal(interaction: ModalSubmitInteraction): Promise<void> {
  const guild = interaction.guild;
  const [tournamentId, roleId] = interaction.customId.slice(DEADLINE_MODAL_PREFIX.length).split(":");
  if (!guild || !tournamentId || !roleId) return;
  const tournament = await findTournamentById(guild.id, tournamentId).catch(() => null);
  if (!tournament) {
    await interaction.reply(error("Unknown tournament", "That tournament is no longer registered. Run the command again."));
    return;
  }
  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) {
    await interaction.reply(error("Role missing", "That role no longer exists. Run the command again with another role."));
    return;
  }
  const parsed = parseRounds(interaction.fields.getTextInputValue("rounds"));
  if (!parsed.ok) {
    await interaction.reply(error("Check the rounds", `${parsed.error}\n-# Nothing was posted. Run the command again with the fixed dates.`));
    return;
  }
  await interaction.reply({
    flags: v2Flags,
    components: [textBlock(formatRole(guild, role.id)), buildDeadlinePanel({ tournament, rounds: parsed.rounds, actorId: interaction.user.id })],
    allowedMentions: { roles: [role.id] },
  });
  if (!canPing(role, interaction)) {
    await interaction.followUp(
      error(
        "Role was not notified",
        `${formatRole(guild, role.id)} is not mentionable and I lack **Mention All Roles** here, so the panel posted without a notification. Make the role mentionable or give me that permission.`,
      ),
    );
  }
}

// ---------- routing ----------

export async function handleTournamentPanel(interaction: ChatInputCommandInteraction, sub: string): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  if (sub === "rules") {
    await runRules(interaction, guild);
  } else if (sub === "bracket") {
    await runBracket(interaction);
  } else if (sub === "deadline") {
    await openDeadline(interaction);
  }
}

export function formatRounds(rounds: RoundWindow[]): string[] {
  return rounds.map((round) => `${dayMonth(round.start)} → ${dayMonth(round.end)}`);
}
