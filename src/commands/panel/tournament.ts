import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SectionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Attachment,
  type ChatInputCommandInteraction,
  type Guild,
  type ModalSubmitInteraction,
  type Role,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji, emojiAssetUrl } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatRole, formatUser } from "../../lib/formatters.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";

/** Same accent as the Tournament family guides. */
const TOURNAMENT_ACCENT = 0xd4a017;
const MAX_ROUNDS = 25;
const YEAR_ROLL_MS = 180 * 24 * 60 * 60 * 1000;
export const MAX_NAME_LENGTH = 100;
const IMAGE_DOWNLOAD_MS = 20_000;
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

function eyebrow(name: string): string {
  return `-# ${escapeDiscord(name)}`;
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

export function isChallongeUrl(raw: string): boolean {
  const url = httpsUrl(raw);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return host === "challonge.com" || host.endsWith(".challonge.com");
}

function linkButton(label: string, url: string, emoji?: string): ButtonBuilder {
  const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
  return emoji ? button.setEmoji(customEmoji(emoji)) : button;
}

/** The panels go out before the tournament is registered, so its name is typed, not picked. */
async function readName(interaction: ChatInputCommandInteraction): Promise<string | null> {
  const name = interaction.options.getString("name", true).trim();
  if (!name) {
    await interaction.reply(error("Missing name", "Write the tournament name as it should show on the panel."));
    return null;
  }
  return name;
}

// ---------- rules ----------

export function buildRulesPanel(input: {
  name: string;
  guild: Guild;
  spanish: string;
  english: string;
  /** `attachment://` name of the uploaded image, shown under the intro. */
  imageName?: string;
  actorId: string;
}): ContainerBuilder {
  const heading = `${eyebrow(input.name)}\n## ${emojis.rules} Tournament Rules`;
  const icon = input.guild.iconURL({ extension: "png", size: 128 });
  const container = new ContainerBuilder().setAccentColor(TOURNAMENT_ACCENT);
  if (icon) {
    container.addSectionComponents(headingWithThumbnail(heading, icon));
  } else {
    container.addTextDisplayComponents(textBlock(heading));
  }
  container.addTextDisplayComponents(
    textBlock(
      [
        "Read the rules before your first match. Both versions say the same; pick your language.",
        "-# Lee las reglas antes de tu primer partido. Las dos versiones dicen lo mismo; elige tu idioma.",
      ].join("\n"),
    ),
  );
  if (input.imageName) {
    const url = `attachment://${input.imageName}`;
    container.addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(url)));
  }
  return container
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        linkButton("Reglas en español", input.spanish, emojis.spanish),
        linkButton("English rules", input.english, emojis.english),
      ),
    )
    .addTextDisplayComponents(textBlock(footer(input.actorId)));
}

/** `rules.png`: a fixed name so the gallery can point at the uploaded file. Null if it is not an image. */
export function rulesImageName(attachment: Pick<Attachment, "name" | "contentType">): string | null {
  const fromType = attachment.contentType?.match(/^image\/(png|jpe?g|gif|webp)\b/i)?.[1];
  const fromName = attachment.name?.match(/\.(png|jpe?g|gif|webp)$/i)?.[1];
  const extension = (fromType ?? fromName)?.toLowerCase().replace("jpeg", "jpg");
  return extension ? `rules.${extension}` : null;
}

async function runRules(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const spanish = httpsUrl(interaction.options.getString("spanish", true));
  const english = httpsUrl(interaction.options.getString("english", true));
  if (!spanish || !english) {
    await interaction.reply(error("Invalid link", "Both rules links must be full `https://` links."));
    return;
  }
  const image = interaction.options.getAttachment("image");
  const imageName = image ? rulesImageName(image) : null;
  if (image && !imageName) {
    await interaction.reply(error("Invalid image", "The image must be a PNG, JPG, GIF or WEBP file."));
    return;
  }
  const name = await readName(interaction);
  if (!name) return;
  await interaction.deferReply();
  let files: AttachmentBuilder[] = [];
  if (image && imageName) {
    try {
      const response = await fetch(image.url, { signal: AbortSignal.timeout(IMAGE_DOWNLOAD_MS) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      files = [new AttachmentBuilder(Buffer.from(await response.arrayBuffer()), { name: imageName })];
    } catch (cause) {
      console.error("Rules panel image download failed", cause);
      await interaction.deleteReply().catch(() => undefined);
      await interaction.followUp(error("Image not loaded", "I could not download the image, so nothing was posted. Run the command again."));
      return;
    }
  }
  await interaction.editReply({
    flags: v2Flags,
    components: [
      buildRulesPanel({ name, guild, spanish: spanish.href, english: english.href, imageName: imageName ?? undefined, actorId: interaction.user.id }),
    ],
    files,
    allowedMentions: { parse: [] },
  });
}

// ---------- bracket ----------

export function buildBracketPanel(input: {
  name: string;
  bracketUrl: string;
  shuffleUrl: string;
  actorId: string;
}): ContainerBuilder {
  const heading = `${eyebrow(input.name)}\n## ${emojis.torneo} Bracket`;
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
  const bracket = interaction.options.getString("bracket", true).trim();
  if (!isChallongeUrl(bracket)) {
    await interaction.reply(error("Invalid bracket link", "The bracket must be a Challonge link (`https://challonge.com/...`)."));
    return;
  }
  const shuffle = interaction.options.getString("shuffle", true).trim();
  if (!isYoutubeUrl(shuffle)) {
    await interaction.reply(error("Invalid video link", "The shuffle video must be a YouTube link (`youtube.com` or `youtu.be`)."));
    return;
  }
  const name = await readName(interaction);
  if (!name) return;
  await interaction.reply({
    flags: v2Flags,
    components: [buildBracketPanel({ name, bracketUrl: httpsUrl(bracket)!.href, shuffleUrl: httpsUrl(shuffle)!.href, actorId: interaction.user.id })],
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

/** The last two rounds are always the semifinals and the final (with the 3rd place match). */
export function roundLabel(index: number, total: number): string {
  if (index === total - 1) return "Final / 3rd Place";
  if (index === total - 2) return "Semifinals";
  return `Round ${index + 1}`;
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
    const label = roundLabel(index, lines.length);
    const match = line.match(/^(?:round\s*\d+\s*:?\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(?:-|–|—|→|to)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/i);
    if (!match) {
      return { ok: false, error: `**${label}** must look like \`10/10 - 14/10\`. Got \`${escapeDiscord(line.slice(0, 40))}\`.` };
    }
    const start = dateAt(Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : null);
    if (!start) {
      return { ok: false, error: `**${label}** starts on a date that does not exist.` };
    }
    if (previous && start <= previous) {
      return { ok: false, error: `**${label}** starts before **${roundLabel(index - 1, lines.length)}** ends.` };
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

export function buildDeadlinePanel(input: { name: string; rounds: RoundWindow[]; actorId: string }): ContainerBuilder {
  const list = formatRounds(input.rounds)
    .map((window, index) => `**${roundLabel(index, input.rounds.length)}** · ${window}`)
    .join("\n");
  return new ContainerBuilder()
    .setAccentColor(TOURNAMENT_ACCENT)
    .addTextDisplayComponents(
      textBlock(`${eyebrow(input.name)}\n## ${emojis.calendar} Round Deadlines`),
      textBlock("Stay on top of these dates. Every round has to be played inside its window, so agree on a time early."),
      textBlock(list),
      textBlock(footer(input.actorId)),
    );
}

async function openDeadline(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = await readName(interaction);
  if (!name) return;
  const role = interaction.options.getRole("role", true);
  // A modal custom ID cannot hold a long name, so the name travels in the form, prefilled.
  const nameInput = new TextInputBuilder()
    .setCustomId("name")
    .setLabel("Tournament name")
    .setStyle(TextInputStyle.Short)
    .setValue(name.slice(0, MAX_NAME_LENGTH))
    .setRequired(true)
    .setMaxLength(MAX_NAME_LENGTH);
  const rounds = new TextInputBuilder()
    .setCustomId("rounds")
    .setLabel("Rounds, one per line")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("10/10 - 14/10\n15/10 - 18/10\n19/10 - 21/10")
    .setRequired(true)
    .setMaxLength(1500);
  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(`${DEADLINE_MODAL_PREFIX}${role.id}`)
      .setTitle("Round Deadlines")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(rounds),
      ),
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
  const roleId = interaction.customId.slice(DEADLINE_MODAL_PREFIX.length);
  if (!guild || !roleId) return;
  const name = interaction.fields.getTextInputValue("name").trim();
  if (!name) {
    await interaction.reply(error("Missing name", "Write the tournament name as it should show on the panel. Nothing was posted."));
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
    components: [textBlock(formatRole(guild, role.id)), buildDeadlinePanel({ name, rounds: parsed.rounds, actorId: interaction.user.id })],
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
