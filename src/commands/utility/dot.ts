import { PermissionFlagsBits, type ChatInputCommandInteraction, type Guild } from "discord.js";
import { channelDots, emojis } from "../../emojis.js";
import { actorMatches } from "../../lib/command-access.js";
import { embedColors } from "../../lib/embeds.js";
import { formatChannel } from "../../lib/formatters.js";
import { botHasChannelPermission } from "./access.js";
import { auditUtility } from "./audit.js";
import { currentPostChannel } from "./channels.js";
import { actorFooter, deferUtility, respondUtility, utilityCard, utilityError, utilityInfo } from "./view.js";

export type DotColor = keyof typeof channelDots;

const NAME_MAX = 100;
// Discord lets a channel be renamed twice per 10 minutes; past that the rename waits in the queue.
const RENAME_WAIT_MS = 5000;

const leadingDot = new RegExp(`^(?:${Object.values(channelDots).join("|")})`, "u");

/** The dot the name starts with, if it is one of ours. */
export function currentDot(name: string): string | null {
  return leadingDot.exec(name)?.[0] ?? null;
}

/** Puts `dot` first, replacing any status dot already there. */
export function dottedName(name: string, dot: string): string {
  return `${dot}${name.replace(leadingDot, "")}`.slice(0, NAME_MAX);
}

export async function handleDot(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!(await actorMatches(interaction, { admin: true, organiser: true, helper: true }))) {
    await respondUtility(
      interaction,
      utilityError("Access denied", "Only **Admin**, **Organiser** or **Helper** can mark a channel with a dot."),
    );
    return;
  }

  const channel = currentPostChannel(interaction.channel);
  if (!channel) {
    await respondUtility(interaction, utilityError("Not a text channel", "Run it in a text or announcement channel."));
    return;
  }
  if (!botHasChannelPermission(channel, PermissionFlagsBits.ManageChannels)) {
    await respondUtility(
      interaction,
      utilityError("I cannot rename this channel", "I need **Manage Channels** here to change its name."),
    );
    return;
  }

  const color = (interaction.options.getString("color") ?? "red") as DotColor;
  const dot = channelDots[color] ?? channelDots.red;
  const before = currentDot(channel.name);
  if (before === dot) {
    await respondUtility(
      interaction,
      utilityInfo("Already marked", `${formatChannel(guild, channel.id)} already starts with ${dot}.`),
    );
    return;
  }

  await deferUtility(interaction);
  const rename = channel.setName(dottedName(channel.name, dot), `Dot by ${interaction.user.id}`);
  const audit = () =>
    auditUtility(interaction, guild, {
      action: "updated",
      title: "Channel marked",
      summary: `${formatChannel(guild, channel.id)} now starts with ${dot}.`,
      groups: [{ lines: [`**Dot** ${before ?? "*none*"} → ${dot}`] }],
    });

  const outcome = await Promise.race([
    rename.then(() => "done" as const).catch(() => "failed" as const),
    new Promise<"queued">((resolve) => setTimeout(() => resolve("queued"), RENAME_WAIT_MS)),
  ]);

  if (outcome === "failed") {
    await respondUtility(
      interaction,
      utilityError("Could not rename channel", "Discord refused the new name. Check my permissions in this channel."),
    );
    return;
  }

  if (outcome === "queued") {
    void rename.then(audit).catch(() => undefined);
    await respondUtility(
      interaction,
      utilityCard({
        color: embedColors.info,
        heading: `## ${emojis.info} Dot Queued\n${formatChannel(guild, channel.id)} will start with ${dot} as soon as Discord allows it.`,
        blocks: ["*Discord allows only **2** renames per channel every **10 minutes**.*"],
        footer: actorFooter("Queued", interaction.user.id),
        ephemeral: false,
      }),
    );
    return;
  }

  await respondUtility(
    interaction,
    utilityCard({
      color: embedColors.success,
      heading: `## ${emojis.success} Channel Marked\n${formatChannel(guild, channel.id)} now starts with ${dot}.`,
      footer: actorFooter("Marked", interaction.user.id),
      ephemeral: false,
    }),
  );
  await audit();
}
