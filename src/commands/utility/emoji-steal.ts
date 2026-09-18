import {
  AttachmentBuilder,
  ContainerBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { utilityCommandIdFor } from "../../lib/register-slash.js";
import { attachedFile, textBlock, v2Flags } from "../../lib/v2.js";
import { canManageExpressions } from "./access.js";
import { auditUtility } from "./audit.js";
import { customEmojiCdnUrl, parseEmojiRef } from "./parse.js";
import { deferUtility, respondUtility, utilityError } from "./view.js";

export async function handleEmojiSteal(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!canManageExpressions(interaction)) {
    await respondUtility(
      interaction,
      utilityError(
        "Manage Emojis required",
        "You need **Manage Emojis and Stickers** to remove a custom emoji from this server.",
      ),
    );
    return;
  }

  const parsed = parseEmojiRef(interaction.options.getString("emoji_id", true));
  if (!parsed) {
    await respondUtility(
      interaction,
      utilityError("Need an emoji ID", "Paste a custom emoji or its snowflake ID."),
    );
    return;
  }

  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
    await respondUtility(
      interaction,
      utilityError("I cannot manage emojis", "I need **Manage Emojis and Stickers** to remove that emoji."),
    );
    return;
  }

  await deferUtility(interaction, true);
  await guild.emojis.fetch().catch(() => undefined);

  const emoji = guild.emojis.cache.get(parsed.id);
  if (!emoji) {
    await respondUtility(
      interaction,
      utilityError(
        "Emoji not in this server",
        `No custom emoji \`${parsed.id}\` exists here. Use ${formatHelpEntry("utility enlarge", utilityCommandIdFor(guild.id))} to preview an emoji without deleting it.`,
      ),
    );
    return;
  }

  const animated = emoji.animated ?? parsed.animated;
  const name = emoji.name ?? parsed.name;
  const url = emoji.imageURL({ size: 4096 }) ?? customEmojiCdnUrl(emoji.id, animated);
  const image = await fetch(url)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .catch(() => null);

  try {
    await emoji.delete(`Stolen by ${interaction.user.id}`);
  } catch {
    await respondUtility(
      interaction,
      utilityError(
        "Could not remove emoji",
        "Discord refused to delete that emoji. Check the role hierarchy and my permissions.",
      ),
    );
    return;
  }

  const extension = animated ? "gif" : "png";
  const filename = `${name}.${extension}`;
  const files = image ? [new AttachmentBuilder(Buffer.from(image), { name: filename })] : [];
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(
      textBlock(`# ${emojis.success} Emoji removed`),
      textBlock(`Removed \`${name}\` (\`${emoji.id}\`) from this server. The image is attached so you can reuse it.`),
    );

  if (files.length > 0) {
    container.addFileComponents(attachedFile(filename));
  } else {
    container.addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(url)));
  }

  await respondUtility(interaction, {
    flags: v2Flags,
    files,
    components: [container],
  });

  await auditUtility(interaction, guild, "A custom emoji was removed from the server.", [
    `**Emoji:** \`${name}\``,
    `**ID:** \`${emoji.id}\``,
  ]);
}
