import {
  AttachmentBuilder,
  ContainerBuilder,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import { emojis, numberEmojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUserFromUser } from "../../lib/formatters.js";
import { attachedFile, divider, textBlock, v2Flags } from "../../lib/v2.js";
import { actorMatches } from "../../lib/command-access.js";
import { customEmojiCdnUrl, parseDisplayEmoji, parseSnowflakes, pickRandom, splitChoices, twemojiUrl, utcDate } from "./parse.js";
import { escapeDiscord } from "../room/labels.js";
import { deferUtility, linkRow, respondUtility, utilityCard, utilityError } from "./view.js";

const MAX_TAG_IDS = 80;

/** Big image in a gallery, with a link button to the full-size file. */
function mediaPanel(heading: string, imageUrl: string) {
  return {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(textBlock(heading))
        .addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(imageUrl)))
        .addActionRowComponents(linkRow("Open full size", imageUrl)),
    ],
  };
}

export async function handleRandom(interaction: ChatInputCommandInteraction): Promise<void> {
  const choices = splitChoices(interaction.options.getString("options", true));
  if (choices.length < 2) {
    await respondUtility(
      interaction,
      utilityError("Need more options", "Give me at least **2** choices, separated by comma, pipe, or new line."),
    );
    return;
  }

  const count = Math.min(interaction.options.getInteger("number") ?? 1, numberEmojis.length);
  if (count > choices.length) {
    await respondUtility(
      interaction,
      utilityError(
        "Too many picks",
        `You asked for **${count}** winners, but there are only **${choices.length}** options.`,
      ),
    );
    return;
  }

  const picked = pickRandom(choices, count);
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(
      textBlock(`## ${emojis.random} Random Picks\n-# ${picked.length} of ${choices.length} options`),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(picked.map((choice, index) => `### ${numberEmojis[index]} ${escapeDiscord(choice)}`).join("\n")),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Picked for ${formatUserFromUser(interaction.user)}`));

  await respondUtility(interaction, {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [container],
  });
}

export async function handleToss(interaction: ChatInputCommandInteraction): Promise<void> {
  const heads = Math.random() < 0.5;
  const side = heads ? "Heads" : "Tails";
  await respondUtility(
    interaction,
    utilityCard({
      color: embedColors.info,
      heading: `## ${emojis.party} ${side}\nThe coin landed on **${side}**.`,
      blocks: [`-# Flipped for ${formatUserFromUser(interaction.user)}`],
      ephemeral: false,
    }),
  );
}

/** `08/11/2026 21:00`: the day/month/year order the bot uses for UTC dates. */
function utcLabel(date: Date): string {
  const two = (value: number) => String(value).padStart(2, "0");
  return `${two(date.getUTCDate())}/${two(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
}

export async function handleUtc(interaction: ChatInputCommandInteraction): Promise<void> {
  const date = utcDate(
    interaction.options.getInteger("year", true),
    interaction.options.getInteger("month", true),
    interaction.options.getInteger("day", true),
    interaction.options.getInteger("hour", true),
    interaction.options.getInteger("minute", true),
  );
  if (!date) {
    await respondUtility(
      interaction,
      utilityError("Invalid UTC date", "That day does not exist. Check the day and month, then try again."),
    );
    return;
  }

  const unix = Math.floor(date.getTime() / 1000);
  await respondUtility(
    interaction,
    {
      flags: v2Flags,
      components: [
        new ContainerBuilder()
          .setAccentColor(embedColors.info)
          .addTextDisplayComponents(
            textBlock(
              `## ${emojis.calendar} UTC Timestamp\n-# ${utcLabel(date)} UTC · same clock the schedules use`,
            ),
          )
          .addSeparatorComponents(divider())
          .addTextDisplayComponents(
            textBlock([`**Full** <t:${unix}:F>`, `**Short** <t:${unix}:f>`, `**Relative** <t:${unix}:R>`].join("\n")),
          ),
      ],
    },
  );
}

export async function handleDiscordTag(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await actorMatches(interaction, { admin: true, organiser: true }))) {
    await respondUtility(
      interaction,
      utilityError("Admin or organiser required", "You need **Admin** or **Organiser** to convert Discord IDs."),
    );
    return;
  }

  const ids = parseSnowflakes(interaction.options.getString("ids", true));
  if (ids.length === 0) {
    await respondUtility(
      interaction,
      utilityError("No Discord IDs", "Paste one or more Discord user IDs. I will return usernames in the same order."),
    );
    return;
  }
  if (ids.length > MAX_TAG_IDS) {
    await respondUtility(
      interaction,
      utilityError("Too many IDs", `I can convert up to **${MAX_TAG_IDS}** IDs per run. You sent **${ids.length}**.`),
    );
    return;
  }

  await deferUtility(interaction, true);

  const lines: string[] = [];
  let missing = 0;
  for (let i = 0; i < ids.length; i += 5) {
    const chunk = ids.slice(i, i + 5);
    const resolved = await Promise.all(
      chunk.map(async (id) => {
        const user = await interaction.client.users.fetch(id).catch(() => null);
        return user ? user.username : id;
      }),
    );
    for (let index = 0; index < resolved.length; index += 1) {
      const value = resolved[index] ?? chunk[index] ?? "";
      if (value === chunk[index]) {
        missing += 1;
      }
      lines.push(value);
    }
  }

  const body = `\`\`\`\n${lines.join("\n")}\n\`\`\``;
  const count = `${lines.length} ${lines.length === 1 ? "username" : "usernames"} in paste order`;
  const note =
    missing > 0
      ? `${emojis.alert} ${missing === 1 ? "**1** ID could not be resolved and stays" : `**${missing}** IDs could not be resolved and stay`} as the ID, in the same row.`
      : "";

  if (body.length < 3500) {
    await respondUtility(
      interaction,
      utilityCard({
        color: embedColors.info,
        heading: `## ${emojis.info} Discord Tags\n-# ${count} · copy the block into the sheet`,
        blocks: [body, ...(note ? [note] : [])],
        ephemeral: true,
      }),
    );
    return;
  }

  await respondUtility(interaction, {
    flags: v2Flags,
    files: [new AttachmentBuilder(Buffer.from(`${lines.join("\n")}\n`, "utf8"), { name: "discord-tags.txt" })],
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`## ${emojis.info} Discord Tags\n-# ${count} · too many for a code block, copy them from the file`),
        )
        .addFileComponents(attachedFile("discord-tags.txt"))
        .addTextDisplayComponents(...(note ? [textBlock(note)] : [])),
    ],
  });
}

export async function handleAvatar(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const user = interaction.options.getUser("user") ?? interaction.user;
  const member = await guild.members.fetch(user.id).catch(() => null);
  const imageUrl = (member ?? user).displayAvatarURL({ size: 4096, extension: "png" });
  const kind = member?.avatar ? "server avatar" : "account avatar";
  await respondUtility(interaction, mediaPanel(`## ${emojis.humans} Avatar\n${formatUserFromUser(user)} · ${kind}`, imageUrl));
}

export async function handleEnlarge(interaction: ChatInputCommandInteraction): Promise<void> {
  const parsed = parseDisplayEmoji(interaction.options.getString("emoji", true));
  if (!parsed) {
    await respondUtility(interaction, utilityError("Need an emoji", "Paste a custom emoji, its ID, or a unicode emoji."));
    return;
  }

  if (parsed.kind === "custom") {
    const url = customEmojiCdnUrl(parsed.id, parsed.animated);
    await respondUtility(
      interaction,
      mediaPanel(
        `## ${emojis.info} Enlarged Emoji\n\`${parsed.name}\` · \`${parsed.id}\` · ${parsed.animated ? "animated" : "static"}`,
        url,
      ),
    );
    return;
  }

  await respondUtility(
    interaction,
    mediaPanel(`## ${emojis.info} Enlarged Emoji\nUnicode emoji at full size`, twemojiUrl(parsed.emoji)),
  );
}
