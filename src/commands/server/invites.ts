import {
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type Invite,
} from "discord.js";
import { v2Flags } from "../../lib/v2.js";
import {
  fileSlug,
  formatUtc,
  replyExport,
  requireOrganiser,
  tsvBuffer,
  xlsxBuffer,
} from "./shared.js";
import { serverErrorMessage, serverInfoMessage } from "./view.js";

type InviteRow = {
  code: string;
  uses: string;
  maxUses: string;
  channelId: string;
  inviterId: string;
  expires: string;
  temporary: string;
  created: string;
};

function inviteValue(invite: Invite): InviteRow {
  return {
    code: invite.code,
    uses: String(invite.uses ?? 0),
    maxUses: invite.maxUses ? String(invite.maxUses) : "Unlimited",
    channelId: invite.channelId ?? "",
    inviterId: invite.inviter?.id ?? "",
    expires: invite.expiresAt ? formatUtc(invite.expiresAt) : "Never",
    temporary: invite.temporary ? "Yes" : "No",
    created: invite.createdAt ? formatUtc(invite.createdAt) : "Unknown",
  };
}

async function vanityRow(guild: Guild): Promise<InviteRow | null> {
  try {
    const vanity = await guild.fetchVanityData();
    if (!vanity.code) {
      return null;
    }
    return {
      code: vanity.code,
      uses: String(vanity.uses),
      maxUses: "Unlimited",
      channelId: "",
      inviterId: "Vanity",
      expires: "Never",
      temporary: "No",
      created: "Unknown",
    };
  } catch {
    if (!guild.vanityURLCode) {
      return null;
    }
    return {
      code: guild.vanityURLCode,
      uses: "Unknown",
      maxUses: "Unlimited",
      channelId: "",
      inviterId: "Vanity",
      expires: "Never",
      temporary: "No",
      created: "Unknown",
    };
  }
}

function toTsv(rows: InviteRow[]): Buffer {
  return tsvBuffer(
    ["Code", "Uses", "Max uses", "Channel ID", "Inviter ID", "Expires", "Temporary", "Created"],
    rows.map((row) => [
      row.code,
      row.uses,
      row.maxUses,
      row.channelId,
      row.inviterId,
      row.expires,
      row.temporary,
      row.created,
    ]),
  );
}

export async function handleServerInvites(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!(await requireOrganiser(interaction, guild, "export the invite list"))) {
    return;
  }

  const me = guild.members.me;
  if (
    !me?.permissions.has(PermissionFlagsBits.ManageGuild) &&
    !me?.permissions.has(PermissionFlagsBits.ViewAuditLog)
  ) {
    await interaction.reply(
      serverErrorMessage(
        "Missing permission",
        "I need **Manage Server** or **View Audit Log** to read this server's invites.",
      ),
    );
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let invites;
  try {
    invites = await guild.invites.fetch();
  } catch {
    const payload = serverErrorMessage("Invite list unavailable", "Discord did not return this server's invites.", false);
    await interaction.editReply({
      components: payload.components,
      flags: v2Flags,
    });
    return;
  }

  const vanity = await vanityRow(guild);
  const rows = [...invites.values()]
    .map(inviteValue)
    .sort((a, b) => Number(b.uses) - Number(a.uses) || a.code.localeCompare(b.code));
  if (vanity) {
    rows.unshift(vanity);
  }

  if (rows.length === 0) {
    const payload = serverInfoMessage("No invites", "This server has no invites to export.", false);
    await interaction.editReply({
      components: payload.components,
      flags: v2Flags,
    });
    return;
  }

  const asExcel = interaction.options.getBoolean("excel") ?? false;
  const base = `invites-${fileSlug(guild)}`;
  const filename = asExcel ? `${base}.xlsx` : `${base}.txt`;
  const data = asExcel
    ? await xlsxBuffer(
        "Invites",
        [
          { header: "Code", key: "code", width: 16 },
          { header: "Uses", key: "uses", width: 10 },
          { header: "Max uses", key: "maxUses", width: 12 },
          { header: "Channel ID", key: "channelId", width: 22 },
          { header: "Inviter ID", key: "inviterId", width: 22 },
          { header: "Expires", key: "expires", width: 24 },
          { header: "Temporary", key: "temporary", width: 12 },
          { header: "Created", key: "created", width: 24 },
        ],
        rows,
      )
    : toTsv(rows);

  const vanityNote = vanity
    ? ` Vanity: \`discord.gg/${vanity.code}\` · **${vanity.uses}** uses.`
    : "";

  await replyExport(
    interaction,
    guild,
    "Invite list exported",
    `**${rows.length}** ${rows.length === 1 ? "invite" : "invites"} in \`${filename}\`.${vanityNote}`,
    filename,
    data,
  );
}
