import {
  AttachmentBuilder,
  ContainerBuilder,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import { emojis, numberEmojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUserFromUser } from "../../lib/formatters.js";
import { attachedFile, divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { customEmojiCdnUrl, parseDisplayEmoji, parseSnowflakes, pickRandom, splitChoices, twemojiUrl, utcDate } from "./parse.js";
import { deferUtility, respondUtility, utilityError, utilityInfo, utilitySuccess } from "./view.js";

const MAX_TAG_IDS = 80;

function mediaPanel(title: string, body: string, imageUrl: string, thumbnailUrl?: string) {
  const container = new ContainerBuilder().setAccentColor(embedColors.info);
  if (thumbnailUrl) {
    container.addSectionComponents(headingWithThumbnail(`# ${title}`, thumbnailUrl, body));
  } else {
    container.addTextDisplayComponents(textBlock(`# ${title}`), textBlock(body));
  }
  return {
    flags: v2Flags,
    components: [
      container.addMediaGalleryComponents((gallery) =>
        gallery.addItems((item) => item.setURL(imageUrl)),
      ),
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
    .addTextDisplayComponents(textBlock(`# ${emojis.random} Random picks`))
    .addSeparatorComponents(divider());

  for (let i = 0; i < picked.length; i += 1) {
    container.addTextDisplayComponents(textBlock(`# ${numberEmojis[i]} **${picked[i]}**`));
    if (i < picked.length - 1) {
      container.addSeparatorComponents(divider());
    }
  }

  await respondUtility(interaction, {
    flags: v2Flags,
    components: [container],
  });
}

export async function handleToss(interaction: ChatInputCommandInteraction): Promise<void> {
  const heads = Math.random() < 0.5;
  await respondUtility(
    interaction,
    utilitySuccess("Coin flip", `${emojis.party} It landed on **${heads ? "Heads" : "Tails"}**.`, false),
  );
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
          .addTextDisplayComponents(textBlock(`# ${emojis.calendar} UTC timestamp`))
          .addSeparatorComponents(divider())
          .addTextDisplayComponents(
            textBlock(
              [
                `**Unix:** \`${unix}\``,
                `**Full:** <t:${unix}:F>`,
                `**Short:** <t:${unix}:f>`,
                `**Relative:** <t:${unix}:R>`,
                `*Same UTC clock the schedules use.*`,
              ].join("\n"),
            ),
          ),
      ],
    },
  );
}

export async function handleDiscordTag(interaction: ChatInputCommandInteraction): Promise<void> {
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
  const note =
    missing > 0
      ? `\n*${missing} ID${missing === 1 ? "" : "s"} could not be resolved and were left as-is.*`
      : "";

  if (body.length < 3500) {
    await respondUtility(
      interaction,
      utilityInfo(
        "Discord tags for the sheet",
        `**${lines.length}** username${lines.length === 1 ? "" : "s"} in paste order.\n${body}${note}`,
      ),
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
          textBlock(`# ${emojis.info} Discord tags for the sheet`),
          textBlock(`**${lines.length}** usernames in paste order. Copy them from the attached file.${note}`),
        )
        .addFileComponents(attachedFile("discord-tags.txt")),
    ],
  });
}

export async function handleAvatar(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const user = interaction.options.getUser("user") ?? interaction.user;
  const member = await guild.members.fetch(user.id).catch(() => null);
  const imageUrl = (member ?? user).displayAvatarURL({ size: 4096, extension: "png" });
  await respondUtility(interaction, {
    flags: v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.humans} Avatar`),
          textBlock(`Avatar for ${formatUserFromUser(user)}.`),
        )
        .addSeparatorComponents(divider())
        .addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(imageUrl))),
    ],
  });
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
      mediaPanel(`${emojis.info} Enlarged emoji`, `Custom emoji \`${parsed.name}\` (\`${parsed.id}\`).`, url),
    );
    return;
  }

  await respondUtility(
    interaction,
    mediaPanel(`${emojis.info} Enlarged emoji`, "Unicode emoji at full size.", twemojiUrl(parsed.emoji)),
  );
}
