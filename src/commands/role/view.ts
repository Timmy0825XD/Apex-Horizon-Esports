import {
  AttachmentBuilder,
  ContainerBuilder,
  MessageFlags,
  type GuildMember,
  type InteractionReplyOptions,
  type Role,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatMember, formatRoleFromRole, formatUser } from "../../lib/formatters.js";
import { attachedFile, divider, textBlock, v2Flags } from "../../lib/v2.js";

export function roleErrorMessage(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(textBlock(`# ${emojis.error} ${title}`), textBlock(description)),
    ],
    allowedMentions: { parse: [] },
  };
}

export function roleInfoMessage(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(textBlock(`# ${emojis.info} ${title}`), textBlock(description)),
    ],
    allowedMentions: { parse: [] },
  };
}

export function roleToggleMessage(input: {
  added: boolean;
  role: Role;
  targetId: string;
  actorId: string;
}): InteractionReplyOptions {
  const mention = formatRoleFromRole(input.role);
  const who = formatUser(input.targetId);
  const title = input.added ? `${emojis.success} Role granted` : `${emojis.success} Role removed`;
  const summary = input.added ? `Gave ${mention} to ${who}.` : `Removed ${mention} from ${who}.`;

  return {
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(textBlock(`# ${title}`), textBlock(summary))
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(`-# Triggered by ${formatUser(input.actorId)}`)),
    ],
    allowedMentions: { parse: [] },
  };
}

export type MassBuckets = {
  changed: GuildMember[];
  skipped: GuildMember[];
  failed: GuildMember[];
};

const MAX_SHOWN = 15;

function listedMembers(members: GuildMember[]): string {
  const shown = members.slice(0, MAX_SHOWN);
  const extra = members.length - shown.length;
  const more = extra > 0 ? `\n*And **${extra}** more.*` : "";
  return `${shown.map((member) => `> ${formatMember(member)}`).join("\n")}${more}`;
}

export function roleMassMessage(
  action: "add" | "remove",
  role: Role,
  buckets: MassBuckets,
  actorId: string,
): InteractionReplyOptions {
  const mention = formatRoleFromRole(role);
  const containers: ContainerBuilder[] = [];

  if (buckets.changed.length > 0) {
    const count = buckets.changed.length;
    const title = action === "add" ? `${emojis.success} Role granted in bulk` : `${emojis.success} Role removed in bulk`;
    const summary =
      action === "add"
        ? count === 1
          ? `Gave ${mention} to **1** member who did not have it.`
          : `Gave ${mention} to **${count}** members who did not have it.`
        : count === 1
          ? `Removed ${mention} from **1** member who had it.`
          : `Removed ${mention} from **${count}** members who had it.`;

    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(textBlock(`# ${title}`), textBlock(summary))
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(listedMembers(buckets.changed))),
    );
  }

  if (buckets.skipped.length > 0) {
    const count = buckets.skipped.length;
    const title = action === "add" ? `${emojis.info} Already held the role` : `${emojis.info} Did not have the role`;
    const summary =
      action === "add"
        ? count === 1
          ? `**1** member already had ${mention}.`
          : `**${count}** members already had ${mention}.`
        : count === 1
          ? `**1** member already did not have ${mention}.`
          : `**${count}** members already did not have ${mention}.`;

    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(textBlock(`# ${title}`), textBlock(summary)),
    );
  }

  if (buckets.failed.length > 0) {
    const count = buckets.failed.length;
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.error} Could not update roles`),
          textBlock(
            count === 1
              ? `Discord rejected the update for **1** member.`
              : `Discord rejected the update for **${count}** members.`,
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(listedMembers(buckets.failed))),
    );
  }

  if (containers.length === 0) {
    return roleInfoMessage(
      "Nothing to change",
      action === "add"
        ? `Every member already has ${mention}, or none could be updated.`
        : `No member currently has ${mention}.`,
      false,
    );
  }

  containers[containers.length - 1]
    ?.addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Triggered by ${formatUser(actorId)}`));

  return {
    components: containers,
    allowedMentions: { parse: [] },
  };
}

const LIST_CHAR_LIMIT = 3500;

export function roleListMessage(
  role: Role,
  members: GuildMember[],
  actorId: string,
): InteractionReplyOptions {
  const humans = members.filter((member) => !member.user.bot);
  const bots = members.filter((member) => member.user.bot);
  const mention = formatRoleFromRole(role);
  const summary = [
    `${emojis.members} **Total:** \`${members.length}\``,
    `${emojis.humans} **Human:** \`${humans.length}\``,
    `${emojis.bots} **Bot:** \`${bots.length}\``,
  ].join("\n");

  const list = members.map((member) => `> ${formatMember(member)}`).join("\n");
  const fits = list.length > 0 && list.length <= LIST_CHAR_LIMIT;

  const container = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(
      textBlock(`# ${emojis.members} Members of ${mention}`),
      textBlock(summary),
    );

  if (members.length === 0) {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(textBlock("*Nobody currently holds this role.*"));
  } else if (fits) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(textBlock(list));
  } else {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        textBlock(`The roster does not fit here, so it is attached as \`${role.id}-members.csv\`.`),
      )
      .addFileComponents(attachedFile(`${role.id}-members.csv`));
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Requested by ${formatUser(actorId)}`));

  const payload: InteractionReplyOptions = {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    components: [container],
    allowedMentions: { parse: [] },
  };

  if (members.length > 0 && !fits) {
    const csv = [
      "ID,Kind",
      ...members.map((member) => `${member.id},${member.user.bot ? "Bot" : "Human"}`),
    ].join("\n");
    payload.files = [new AttachmentBuilder(Buffer.from(`\uFEFF${csv}\n`, "utf8"), { name: `${role.id}-members.csv` })];
  }

  return payload;
}
