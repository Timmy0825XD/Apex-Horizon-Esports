import {
  AttachmentBuilder,
  ChannelType,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  type Guild,
  type Message,
  type TextChannel,
  type User,
} from "discord.js";
import { emojis } from "../../../emojis.js";
import { emojiAssetUrl } from "../../../lib/custom-emoji.js";
import { embedColors } from "../../../lib/embeds.js";
import { formatChannel, formatUser } from "../../../lib/formatters.js";
import { attachedFile, textBlock, v2Flags } from "../../../lib/v2.js";
import { escapeDiscord } from "../../room/labels.js";
import { embedTranscriptAssets } from "./assets.js";
import { collectTicketSnapshot } from "./collect.js";
import { renderTranscriptPages } from "./render.js";

export function transcriptFilename(channelName: string): string {
  const base = channelName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim() || "transcript";
  return `${base.slice(0, 90)}.html`;
}

function transcriptPost(input: {
  tournamentName: string;
  channelId: string;
  channelName: string;
  links: { filename: string; url: string }[];
  actorId: string;
  attachedFilename?: string;
}): ContainerBuilder {
  const links =
    input.links.length === 1
      ? `${emojis.link} **Link:** [Click to download](${input.links[0].url})`
      : [
          `${emojis.link} **Files:**`,
          ...input.links.map(
            (entry, index) => `- [Part ${index + 1}: ${escapeDiscord(entry.filename)}](${entry.url})`,
          ),
        ].join("\n");
  const section = new SectionBuilder().addTextDisplayComponents(
    textBlock(`# ${emojis.transcript} Transcript`),
    textBlock(
      [
        `${emojis.transcript} Transcript of **${escapeDiscord(input.tournamentName)}**`,
        `${emojis.textChannel} **Channel:** ${formatChannel(null, input.channelId)}`,
        `\`${escapeDiscord(input.channelName)}\``,
        links,
      ].join("\n"),
    ),
    textBlock(`-# Transcript by ${formatUser(input.actorId)}`),
  );
  const thumb = emojiAssetUrl(emojis.transcript_thumnail);
  if (thumb) {
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb));
  }
  const container = new ContainerBuilder().setAccentColor(embedColors.success).addSectionComponents(section);
  if (input.attachedFilename) {
    container.addFileComponents(attachedFile(input.attachedFilename));
  }
  return container;
}

async function removeMessages(messages: Message[]): Promise<void> {
  await Promise.all(messages.map((message) => message.delete().catch(() => undefined)));
}

export async function publishTicketTranscript(
  guild: Guild,
  ticket: TextChannel,
  transcriptChannelId: string,
  input: {
    tournamentName: string;
    actor: User;
    filename?: string;
    channelName?: string;
  },
): Promise<string> {
  const channel = await guild.channels.fetch(transcriptChannelId).catch(() => null);
  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
    throw new Error("The transcript channel is missing or not a text channel.");
  }

  const channelName = input.channelName ?? ticket.name;
  const filename = input.filename ?? transcriptFilename(channelName);
  const snapshot = await collectTicketSnapshot(ticket);
  const assets = await embedTranscriptAssets(snapshot);
  const pages = await renderTranscriptPages(snapshot, assets, filename);

  if (pages.length === 1) {
    const page = pages[0];
    const file = new AttachmentBuilder(Buffer.from(page.html, "utf8"), { name: page.filename });
    const message = await channel.send({
      files: [file],
      components: [
        transcriptPost({
          tournamentName: input.tournamentName,
          channelId: ticket.id,
          channelName,
          links: [{ filename: page.filename, url: "https://discord.com" }],
          actorId: input.actor.id,
          attachedFilename: page.filename,
        }),
      ],
      flags: v2Flags,
      allowedMentions: { parse: [] },
    });

    const downloadUrl = message.attachments.first()?.url ?? message.url;
    try {
      await message.edit({
        components: [
          transcriptPost({
            tournamentName: input.tournamentName,
            channelId: ticket.id,
            channelName,
            links: [{ filename: page.filename, url: downloadUrl }],
            actorId: input.actor.id,
            attachedFilename: page.filename,
          }),
        ],
        flags: v2Flags,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      await message.delete().catch(() => undefined);
      throw error;
    }
    return message.url;
  }

  const uploaded: Message[] = [];
  try {
    const links: { filename: string; url: string }[] = [];
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const holder = await channel.send({
        content: `Transcript part **${index + 1}/${pages.length}** — \`${page.filename}\``,
        files: [new AttachmentBuilder(Buffer.from(page.html, "utf8"), { name: page.filename })],
        allowedMentions: { parse: [] },
      });
      uploaded.push(holder);
      links.push({ filename: page.filename, url: holder.attachments.first()?.url ?? holder.url });
    }

    const indexMessage = await channel.send({
      components: [
        transcriptPost({
          tournamentName: input.tournamentName,
          channelId: ticket.id,
          channelName,
          links,
          actorId: input.actor.id,
        }),
      ],
      flags: v2Flags,
      allowedMentions: { parse: [] },
    });
    return indexMessage.url;
  } catch (error) {
    await removeMessages(uploaded);
    throw error;
  }
}
