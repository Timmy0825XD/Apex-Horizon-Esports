import { createTranscript } from "discord-html-transcripts";
import {
  AttachmentBuilder,
  ChannelType,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  type Guild,
  type TextChannel,
  type User,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { emojiAssetUrl } from "../../lib/custom-emoji.js";
import { formatChannel } from "../../lib/formatters.js";
import { attachedFile, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";

export function transcriptFilename(channelName: string): string {
  const base = channelName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim() || "transcript";
  return `${base.slice(0, 90)}.html`;
}

function transcriptPost(input: {
  tournamentName: string;
  channelId: string;
  channelName: string;
  filename: string;
  downloadUrl: string;
  actorTag: string;
}): ContainerBuilder {
  const section = new SectionBuilder().addTextDisplayComponents(
    textBlock(`# ${emojis.transcript} Transcript`),
    textBlock(
      [
        `${emojis.transcript} Transcript of **${escapeDiscord(input.tournamentName)}**`,
        `${emojis.textChannel} **Channel:** ${formatChannel(null, input.channelId)}`,
        `\`${input.channelName}\``,
        `${emojis.link} **Link:** [Click to download](${input.downloadUrl})`,
      ].join("\n"),
    ),
    textBlock(`-# Transcript by ${input.actorTag}`),
  );
  const thumb = emojiAssetUrl(emojis.transcript_thumnail);
  if (thumb) {
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb));
  }
  return new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addSectionComponents(section)
    .addFileComponents(attachedFile(input.filename));
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
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("The tournament transcript channel is missing or not a text channel.");
  }

  const channelName = input.channelName ?? ticket.name;
  const filename = input.filename ?? transcriptFilename(channelName);
  const attachment = await createTranscript(ticket, {
    limit: -1,
    filename,
    saveImages: true,
    poweredBy: false,
    hydrate: false,
    footerText: "Exported {number} message{s}",
  });

  const file =
    attachment instanceof AttachmentBuilder
      ? attachment
      : new AttachmentBuilder(attachment as Buffer | string, { name: filename });

  const message = await channel.send({
    files: [file],
    components: [
      transcriptPost({
        tournamentName: input.tournamentName,
        channelId: ticket.id,
        channelName,
        filename,
        downloadUrl: "https://discord.com",
        actorTag: input.actor.username,
      }),
    ],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });

  const downloadUrl = message.attachments.first()?.url ?? message.url;
  await message.edit({
    components: [
      transcriptPost({
        tournamentName: input.tournamentName,
        channelId: ticket.id,
        channelName,
        filename,
        downloadUrl,
        actorTag: input.actor.username,
      }),
    ],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });

  return message.url;
}
