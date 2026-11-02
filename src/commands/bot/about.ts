import { ContainerBuilder } from "discord.js";
import os from "node:os";
import { emojis } from "../../emojis.js";
import { formatUser } from "../../lib/formatters.js";
import {
  botVersion,
  compactDuration,
  hostMemory,
  npmVersion,
  processMemory,
  reach,
  shortCpuModel,
} from "../../lib/runtime.js";
import { botAvatarUrl, brandColors, divider, headingWithThumbnail, textBlock, type BotViewContext } from "./view.js";

const BOT_OWNER_ID = "1017267293471903774";
const BOT_PURPOSE = "Tournament operations for Apex Horizon Esports: tickets, schedules, brackets, attendance and staff.";

export async function buildAboutContainer(ctx: BotViewContext): Promise<ContainerBuilder> {
  const user = ctx.client.user;
  const container = new ContainerBuilder().setAccentColor(brandColors.red);

  if (!user) {
    return container.addTextDisplayComponents(
      textBlock(`## ${emojis.error} About unavailable`),
      textBlock("The bot has not finished logging in. Try again in a few seconds."),
    );
  }

  const { members } = reach(ctx.client);
  const created = Math.floor(user.createdTimestamp / 1000);
  const tagline = `-# v${botVersion()} · Online for ${compactDuration(process.uptime())} · Serving ${members.toLocaleString("en-US")} members`;
  const heading = `## ${user.displayName}`;
  const avatar = botAvatarUrl(ctx.client);
  if (avatar) {
    container.addSectionComponents(headingWithThumbnail(heading, avatar, `${BOT_PURPOSE}\n${tagline}`));
  } else {
    container.addTextDisplayComponents(textBlock(heading), textBlock(`${BOT_PURPOSE}\n${tagline}`));
  }

  const identity = [
    `### ${emojis.id} Identity`,
    `> **ID** \`${user.id}\``,
    `> **Created** <t:${created}:D> · <t:${created}:R>`,
    `> **Owner** ${formatUser(BOT_OWNER_ID)}`,
  ];

  const npm = npmVersion();
  const versions = [`**Node** \`${process.version}\``, npm ? `**npm** \`${npm}\`` : "", `**OS** \`${os.platform()}\``]
    .filter(Boolean)
    .join(" · ");
  const runtime = [
    `### ${emojis.platform} Runtime`,
    `> ${versions}`,
    `> **CPU** ${shortCpuModel()}`,
    `> **RAM** \`${processMemory()}\` of ${hostMemory()}`,
  ];

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(identity.join("\n")), textBlock(runtime.join("\n")));
}
