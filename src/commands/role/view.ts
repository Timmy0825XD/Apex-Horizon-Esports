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

export type MassAction = "add" | "remove";

export type MassProgress = {
  total: number;
  done: number;
  changed: number;
  failed: number;
};

const BAR_SLOTS = 20;

function progressBar(done: number, total: number): string {
  const ratio = total > 0 ? Math.min(done / total, 1) : 0;
  const filled = Math.round(ratio * BAR_SLOTS);
  return `\`${"▰".repeat(filled)}${"▱".repeat(BAR_SLOTS - filled)}\` **${Math.floor(ratio * 100)}%**`;
}

function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
}

function plural(count: number, word: string): string {
  return `**${count}** ${count === 1 ? word : `${word}s`}`;
}

/** Live status while the bulk update runs. `progress` null means the member list is still loading. */
export function roleMassProgressMessage(
  action: MassAction,
  role: Role,
  progress: MassProgress | null,
  startedAt: number,
): InteractionReplyOptions {
  const mention = formatRoleFromRole(role);
  const title = action === "add" ? "Giving role in bulk" : "Removing role in bulk";
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(textBlock(`# ${emojis.uptime} ${title}`));

  if (!progress) {
    container.addTextDisplayComponents(
      textBlock(`Loading the member list to find who needs ${mention}. Large servers take a few seconds.`),
    );
  } else {
    const target =
      action === "add"
        ? `Giving ${mention} to ${plural(progress.total, "member")} who do not have it.`
        : `Removing ${mention} from ${plural(progress.total, "member")} who have it.`;
    container
      .addTextDisplayComponents(textBlock(target))
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        textBlock(progressBar(progress.done, progress.total)),
        textBlock(
          `-# ${progress.done} of ${progress.total} · ${progress.changed} updated · ${progress.failed} failed · ${duration(Date.now() - startedAt)} elapsed`,
        ),
      );
  }

  return { components: [container], allowedMentions: { parse: [] } };
}

export function roleMassResultMessage(input: {
  action: MassAction;
  role: Role;
  changed: number;
  skipped: number;
  failed: number;
  elapsedMs: number;
  actorId: string;
}): InteractionReplyOptions {
  const mention = formatRoleFromRole(input.role);
  const add = input.action === "add";
  const allFailed = input.changed === 0 && input.failed > 0;
  const title = allFailed
    ? `${emojis.error} Could not update roles`
    : add
      ? `${emojis.success} Role granted in bulk`
      : `${emojis.success} Role removed in bulk`;
  const summary = allFailed
    ? `Discord rejected every update for ${mention}.`
    : add
      ? `${mention} was given to ${plural(input.changed, "member")}.`
      : `${mention} was removed from ${plural(input.changed, "member")}.`;

  const facts = [
    `> **${add ? "Given" : "Removed"}:** \`${input.changed}\``,
    `> **${add ? "Already had it" : "Did not have it"}:** \`${input.skipped}\``,
    `> **Failed:** \`${input.failed}\``,
  ].join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(allFailed ? embedColors.error : embedColors.success)
    .addTextDisplayComponents(textBlock(`# ${title}`), textBlock(summary))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(facts));

  if (input.failed > 0) {
    container.addTextDisplayComponents(
      textBlock(`*Discord refused ${plural(input.failed, "member")}. Check that my highest role is above ${mention}.*`),
    );
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`-# Took ${duration(input.elapsedMs)} · Triggered by ${formatUser(input.actorId)}`),
    );

  return { components: [container], allowedMentions: { parse: [] } };
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
