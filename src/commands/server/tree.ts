import {
  ChannelType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildBasedChannel,
} from "discord.js";
import { v2Flags } from "../../lib/v2.js";
import {
  fileSlug,
  replyExport,
  requireOrganiser,
  textBuffer,
  xlsxBuffer,
} from "./shared.js";
import { serverInfoMessage } from "./view.js";

type TreeRow = {
  category: string;
  categoryId: string;
  name: string;
  id: string;
  type: string;
  position: string;
};

function channelKind(type: ChannelType): string {
  switch (type) {
    case ChannelType.GuildText:
      return "text";
    case ChannelType.GuildAnnouncement:
      return "announcement";
    case ChannelType.GuildVoice:
      return "voice";
    case ChannelType.GuildStageVoice:
      return "stage";
    case ChannelType.GuildForum:
      return "forum";
    case ChannelType.GuildMedia:
      return "media";
    case ChannelType.GuildCategory:
      return "category";
    default:
      return "other";
  }
}

function isTreeChannel(channel: GuildBasedChannel): boolean {
  return !channel.isThread() && channel.type !== ChannelType.GuildCategory;
}

function sortByPosition(a: GuildBasedChannel, b: GuildBasedChannel): number {
  const left = "rawPosition" in a ? a.rawPosition : 0;
  const right = "rawPosition" in b ? b.rawPosition : 0;
  return left - right;
}

function buildTree(guild: Guild): { rows: TreeRow[]; lines: string[]; categories: number; channels: number } {
  const categories = [...guild.channels.cache.values()]
    .filter((channel) => channel.type === ChannelType.GuildCategory)
    .sort(sortByPosition);
  const children = [...guild.channels.cache.values()].filter(isTreeChannel);
  const byParent = new Map<string | null, GuildBasedChannel[]>();

  for (const channel of children) {
    const parentId = "parentId" in channel ? (channel.parentId ?? null) : null;
    const list = byParent.get(parentId) ?? [];
    list.push(channel);
    byParent.set(parentId, list);
  }

  for (const list of byParent.values()) {
    list.sort(sortByPosition);
  }

  const rows: TreeRow[] = [];
  const lines: string[] = [`${guild.name} (${guild.id})`, ""];

  function addGroup(categoryName: string, categoryId: string, channels: GuildBasedChannel[]): void {
    lines.push(`${categoryName} (${categoryId || "none"})`);
    for (const channel of channels) {
      const type = channelKind(channel.type);
      rows.push({
        category: categoryName,
        categoryId,
        name: channel.name,
        id: channel.id,
        type,
        position: "rawPosition" in channel ? String(channel.rawPosition) : "0",
      });
      lines.push(`  [${type}] ${channel.name} (${channel.id})`);
    }
    lines.push("");
  }

  for (const category of categories) {
    addGroup(category.name, category.id, byParent.get(category.id) ?? []);
  }

  const uncategorized = byParent.get(null) ?? [];
  if (uncategorized.length > 0) {
    addGroup("(Uncategorized)", "", uncategorized);
  }

  return {
    rows,
    lines,
    categories: categories.length,
    channels: children.length,
  };
}

export async function handleServerTree(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!(await requireOrganiser(interaction, guild, "export the channel tree"))) {
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await guild.channels.fetch().catch(() => undefined);

  const tree = buildTree(guild);
  if (tree.channels === 0 && tree.categories === 0) {
    const payload = serverInfoMessage("No channels", "This server has no channels to export.", false);
    await interaction.editReply({
      components: payload.components,
      flags: v2Flags,
    });
    return;
  }

  const asExcel = interaction.options.getBoolean("excel") ?? false;
  const base = `tree-${fileSlug(guild)}`;
  const filename = asExcel ? `${base}.xlsx` : `${base}.txt`;
  const data = asExcel
    ? await xlsxBuffer(
        "Tree",
        [
          { header: "Category", key: "category", width: 28 },
          { header: "Category ID", key: "categoryId", width: 22 },
          { header: "Name", key: "name", width: 28 },
          { header: "ID", key: "id", width: 22 },
          { header: "Type", key: "type", width: 14 },
          { header: "Position", key: "position", width: 10 },
        ],
        tree.rows,
      )
    : textBuffer(tree.lines.join("\n"));

  await replyExport(
    interaction,
    guild,
    "Channel tree exported",
    `**${tree.categories}** ${tree.categories === 1 ? "category" : "categories"} · **${tree.channels}** ${tree.channels === 1 ? "channel" : "channels"} in \`${filename}\`.`,
    filename,
    data,
  );
}
