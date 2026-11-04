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
import { attachedFile, divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";

const workingColor = 0xe67e22;

function stamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

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
  avatarUrl: string | null;
  roleCount: number;
  actorId: string;
  at: Date;
}): InteractionReplyOptions {
  const mention = formatRoleFromRole(input.role);
  const who = formatUser(input.targetId);
  const title = input.added ? `## ${emojis.success} Role Granted` : `## ${emojis.error} Role Removed`;
  const summary = [
    input.added ? `${who} now has ${mention}.` : `${who} no longer has ${mention}.`,
    `${emojis.gem} **Roles** \`${input.roleCount}\` in total`,
  ].join("\n");
  const container = new ContainerBuilder().setAccentColor(input.added ? embedColors.success : embedColors.error);
  if (input.avatarUrl) {
    container.addSectionComponents(headingWithThumbnail(title, input.avatarUrl, summary));
  } else {
    container.addTextDisplayComponents(textBlock(title), textBlock(summary));
  }
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`-# ${input.added ? "Granted" : "Removed"} by ${formatUser(input.actorId)} · ${stamp(input.at)}`),
    );

  return { components: [container], allowedMentions: { parse: [] } };
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
  const title = action === "add" ? "Giving Role in Bulk" : "Removing Role in Bulk";
  const container = new ContainerBuilder().setAccentColor(workingColor);

  if (!progress) {
    container.addTextDisplayComponents(
      textBlock(
        `## ${emojis.uptime} ${title}\nLoading the member list to find who needs ${mention}. Large servers take a few seconds.`,
      ),
    );
  } else {
    const target =
      action === "add"
        ? `${mention} → \`${progress.total}\` ${progress.total === 1 ? "member who does" : "members who do"} not have it`
        : `${mention} → \`${progress.total}\` ${progress.total === 1 ? "member who has" : "members who have"} it`;
    container
      .addTextDisplayComponents(textBlock(`## ${emojis.uptime} ${title}\n${target}`))
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
  at: Date;
}): InteractionReplyOptions {
  const mention = formatRoleFromRole(input.role);
  const add = input.action === "add";
  const allFailed = input.changed === 0 && input.failed > 0;
  const title = allFailed
    ? `${emojis.error} Could Not Update Roles`
    : add
      ? `${emojis.success} Role Granted in Bulk`
      : `${emojis.success} Role Removed in Bulk`;
  const summary = allFailed
    ? `Discord rejected every update for ${mention}.`
    : add
      ? `${mention} was given to ${plural(input.changed, "member")}.`
      : `${mention} was removed from ${plural(input.changed, "member")}.`;

  const facts = [
    `**${add ? "Given" : "Removed"}** \`${input.changed}\` · **${add ? "Already had it" : "Did not have it"}** \`${input.skipped}\` · **Failed** \`${input.failed}\``,
  ];
  if (input.failed > 0) {
    facts.push(
      `${emojis.alert} *Discord refused ${plural(input.failed, "member")}. Move my highest role above ${mention}.*`,
    );
  }

  const container = new ContainerBuilder()
    .setAccentColor(allFailed ? embedColors.error : embedColors.success)
    .addTextDisplayComponents(textBlock(`## ${title}\n${summary}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(facts.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        `-# ${add ? "Granted" : "Removed"} by ${formatUser(input.actorId)} · took ${duration(input.elapsedMs)} · ${stamp(input.at)}`,
      ),
    );

  return { components: [container], allowedMentions: { parse: [] } };
}

const LIST_CHAR_LIMIT = 3500;

export function roleListMessage(
  role: Role,
  members: GuildMember[],
  actorId: string,
  at: Date,
): InteractionReplyOptions {
  const humans = members.filter((member) => !member.user.bot);
  const bots = members.filter((member) => member.user.bot);
  const mention = formatRoleFromRole(role);
  const header = [
    `## ${emojis.members} Members of ${mention}`,
    `${emojis.members} **Total** \`${members.length}\` · ${emojis.humans} **Humans** \`${humans.length}\` · ${emojis.bots} **Bots** \`${bots.length}\``,
  ].join("\n");

  const groups = [
    { label: `**${emojis.humans} Humans**`, list: humans },
    { label: `**${emojis.bots} Bots**`, list: bots },
  ]
    .filter((group) => group.list.length > 0)
    .map((group) => `${group.label}\n${group.list.map((member) => formatMember(member)).join(" ")}`);
  const fits = groups.join("\n\n").length <= LIST_CHAR_LIMIT;

  const container = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(textBlock(header))
    .addSeparatorComponents(divider());

  if (members.length === 0) {
    container.addTextDisplayComponents(textBlock("*Nobody currently holds this role.*"));
  } else if (fits) {
    container.addTextDisplayComponents(...groups.map((group) => textBlock(group)));
  } else {
    container
      .addTextDisplayComponents(
        textBlock(`The roster does not fit here, so it is attached as \`${role.id}-members.csv\`.`),
      )
      .addFileComponents(attachedFile(`${role.id}-members.csv`));
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Requested by ${formatUser(actorId)} · ${stamp(at)}`));

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
    payload.files = [new AttachmentBuilder(Buffer.from(`﻿${csv}\n`, "utf8"), { name: `${role.id}-members.csv` })];
  }

  return payload;
}
