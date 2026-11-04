import type { ChatInputCommandInteraction, Guild, GuildMember, InteractionReplyOptions, Role } from "discord.js";
import { formatRoleFromRole } from "../../lib/formatters.js";
import { v2Flags } from "../../lib/v2.js";
import { auditRoleMass } from "./audit.js";
import { botCanManageRoles, fetchActor, unmanageableRoleReason } from "./hierarchy.js";
import { deferRole, respondRole } from "./respond.js";
import {
  roleErrorMessage,
  roleInfoMessage,
  roleMassProgressMessage,
  roleMassResultMessage,
  type MassAction,
  type MassProgress,
} from "./view.js";

/** Role updates are one REST call per member; a few in flight keeps discord.js's rate-limit queue busy. */
const CONCURRENCY = 5;
/** Interaction edits are rate limited too, so progress refreshes on a timer, not per member. */
const PROGRESS_EVERY_MS = 2_500;
/** The interaction token lasts 15 minutes; past this, the result goes to the channel instead. */
const TOKEN_SAFE_MS = 14 * 60_000;

async function hydrateMembers(guild: Guild): Promise<void> {
  if (guild.members.cache.size >= guild.memberCount) {
    return;
  }
  await guild.members.fetch().catch(() => undefined);
}

async function applyMass(
  targets: GuildMember[],
  role: Role,
  action: MassAction,
  reason: string,
  progress: MassProgress,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      const member = targets[next];
      next += 1;
      if (!member) {
        continue;
      }
      try {
        if (action === "add") {
          await member.roles.add(role, reason);
        } else {
          await member.roles.remove(role, reason);
        }
        progress.changed += 1;
      } catch {
        progress.failed += 1;
      }
      progress.done += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
}

/** Refreshes the deferred reply on a timer while the work runs. One edit in flight at a time. */
function startProgressTicker(
  interaction: ChatInputCommandInteraction,
  render: () => InteractionReplyOptions,
  startedAt: number,
): () => Promise<void> {
  let inFlight: Promise<void> | null = null;
  const timer = setInterval(() => {
    if (inFlight || Date.now() - startedAt > TOKEN_SAFE_MS) {
      return;
    }
    inFlight = respondRole(interaction, render())
      .catch(() => undefined)
      .finally(() => {
        inFlight = null;
      });
  }, PROGRESS_EVERY_MS);

  return async () => {
    clearInterval(timer);
    await inFlight;
  };
}

async function deliverResult(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
  startedAt: number,
): Promise<void> {
  if (Date.now() - startedAt <= TOKEN_SAFE_MS) {
    const sent = await respondRole(interaction, payload).then(() => true, () => false);
    if (sent) {
      return;
    }
  }
  const channel = interaction.channel;
  if (channel?.isSendable()) {
    await channel
      .send({ components: payload.components, flags: v2Flags, allowedMentions: { parse: [] } })
      .catch(() => undefined);
  }
}

export async function handleRoleMass(interaction: ChatInputCommandInteraction, action: MassAction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondRole(interaction, roleErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  const startedAt = Date.now();
  await deferRole(interaction);
  await guild.roles.fetch().catch(() => undefined);

  const picked = interaction.options.getRole("role", true);
  const role = guild.roles.cache.get(picked.id);
  if (!role) {
    await respondRole(interaction, roleErrorMessage("Role missing", "That role is no longer in this server.", false));
    return;
  }

  const actor = await fetchActor(guild, interaction.user.id, interaction.member);
  const botMember = await guild.members.fetchMe();
  if (!botCanManageRoles(botMember)) {
    await respondRole(
      interaction,
      roleErrorMessage("Missing permission", "I need **Manage Roles** to change member roles.", false),
    );
    return;
  }

  const roleReason = unmanageableRoleReason(role, actor, botMember);
  if (roleReason) {
    await respondRole(interaction, roleErrorMessage("Hierarchy blocked", roleReason, false));
    return;
  }

  if (guild.members.cache.size < guild.memberCount) {
    await respondRole(interaction, roleMassProgressMessage(action, role, null, startedAt));
    await hydrateMembers(guild);
  }
  const members = [...guild.members.cache.values()];
  if (members.length === 0) {
    await respondRole(
      interaction,
      roleErrorMessage("Members unavailable", "I could not load the member list for this server.", false),
    );
    return;
  }

  const targets = members.filter((member) => member.roles.cache.has(role.id) === (action === "remove"));
  const skipped = members.length - targets.length;
  if (targets.length === 0) {
    const mention = formatRoleFromRole(role);
    await respondRole(
      interaction,
      action === "add"
        ? roleInfoMessage("Everyone already has it", `All **${members.length}** members already have ${mention}.`, false)
        : roleInfoMessage("Nobody has that role", `No member currently has ${mention}.`, false),
    );
    return;
  }

  const progress: MassProgress = { total: targets.length, done: 0, changed: 0, failed: 0 };
  await respondRole(interaction, roleMassProgressMessage(action, role, progress, startedAt));
  const stopTicker = startProgressTicker(
    interaction,
    () => roleMassProgressMessage(action, role, progress, startedAt),
    startedAt,
  );

  try {
    await applyMass(
      targets,
      role,
      action,
      action === "add" ? `Role add all by ${interaction.user.id}` : `Role remove all by ${interaction.user.id}`,
      progress,
    );
  } finally {
    await stopTicker();
  }

  await deliverResult(
    interaction,
    roleMassResultMessage({
      action,
      role,
      changed: progress.changed,
      skipped,
      failed: progress.failed,
      elapsedMs: Date.now() - startedAt,
      actorId: interaction.user.id,
      at: new Date(),
    }),
    startedAt,
  );
  await auditRoleMass(interaction, guild, role.id, action, progress.changed);
}
