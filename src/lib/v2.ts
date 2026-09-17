import {
  FileBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";

export const v2Flags = [MessageFlags.IsComponentsV2] as const;

export function textBlock(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

export function divider(): SeparatorBuilder {
  return new SeparatorBuilder().setDivider(true);
}

export function headingWithThumbnail(heading: string, thumbnailUrl: string, extra?: string): SectionBuilder {
  const section = new SectionBuilder().addTextDisplayComponents(textBlock(heading));
  if (extra) {
    section.addTextDisplayComponents(textBlock(extra));
  }
  return section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl));
}

export function attachedFile(filename: string): FileBuilder {
  return new FileBuilder().setURL(`attachment://${filename}`);
}
