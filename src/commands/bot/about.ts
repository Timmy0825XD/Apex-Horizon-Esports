import { ContainerBuilder } from "discord.js";
import os from "node:os";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import { botVersion, cpuModel, formatDuration, memoryLine, npmVersion, reach } from "../../lib/runtime.js";
import { botAvatarUrl, divider, headingWithThumbnail, textBlock, type BotViewContext } from "./view.js";

const BOT_OWNER_ID = "1017267293471903774";

export async function buildAboutContainer(ctx: BotViewContext): Promise<ContainerBuilder> {
  const user = ctx.client.user;
  const container = new ContainerBuilder().setAccentColor(embedColors.error);

  if (!user) {
    return container.addTextDisplayComponents(textBlock(`# ${emojis.error} About unavailable`));
  }

  const createdOn = user.createdAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const { servers, members } = reach(ctx.client);
  const npm = npmVersion();
  const avatar = botAvatarUrl(ctx.client);

  if (avatar) {
    container.addSectionComponents(
      headingWithThumbnail(`# ${user.displayName}`, avatar),
    );
  } else {
    container.addTextDisplayComponents(textBlock(`# ${user.displayName}`));
  }

  const identity = [
    `${emojis.info} **Name:** ${user.displayName}`,
    `${emojis.info} **ID:** \`${user.id}\``,
    `${emojis.calendar} **Created On:** ${createdOn}`,
    `${emojis.owner} **Owner:** ${formatUser(BOT_OWNER_ID)}`,
  ];

  const runtime = [
    `${emojis.platform} **Platform:** \`${os.platform()}\``,
    `${emojis.node} **Node:** \`${process.version}\``,
    `${emojis.success} **Bot Version:** \`${botVersion()}\``,
  ];
  if (npm) {
    runtime.splice(2, 0, `${emojis.npm} **npm:** \`${npm}\``);
  }

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(identity.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [`## ${emojis.size} Size`, `${emojis.server} **Servers:** \`${servers}\``, `${emojis.members} **Members:** \`${members}\``].join(
          "\n",
        ),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [
          `## ${emojis.server} Server`,
          `${emojis.uptime} **Uptime:** \`${formatDuration(process.uptime())}\``,
          `${emojis.memory} **RAM:** \`${memoryLine()}\``,
          `${emojis.settings} **CPU:** \`${cpuModel()}\``,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock([`## ${emojis.runtime} Runtime`, ...runtime].join("\n")));
}
