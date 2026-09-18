import type { ChatInputCommandInteraction } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { isGuildAdmin } from "../../lib/permissions.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { auditStaffConfigMutation } from "./audit.js";
import { changedStaffKeys, mergeStaff, readStaffPatch } from "./options.js";
import { deferStaff, respondStaff } from "./respond.js";
import { loadGuildStaffState, saveStaffConfig } from "./store.js";
import { staffConfigMessage, staffErrorMessage } from "./view.js";

export async function handleStaffConfigEdit(
  interaction: ChatInputCommandInteraction,
  commandId?: string,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondStaff(interaction, staffErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferStaff(interaction);

  const { settings, staff } = await loadGuildStaffState(guild.id);
  if (!settings) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Settings not configured",
        `Run ${formatHelpEntry("settings set", settingsCommandIdFor(guild.id))} first. Staff config needs the server layer.`,
        false,
      ),
    );
    return;
  }

  if (!staff) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Staff config not set",
        `Run ${formatHelpEntry("staff config set", commandId)} first. Every required role and channel is saved on that first pass.`,
        false,
      ),
    );
    return;
  }

  if (!isGuildAdmin(interaction, settings)) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Admin only",
        "You need the Discord **Administrator** permission or the configured **Admin Role** to edit the staff hierarchy.",
        false,
      ),
    );
    return;
  }

  const patch = readStaffPatch(interaction);
  if (Object.keys(patch).length === 0) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Nothing to update",
        "Pass at least one role or channel. Leave the rest empty to keep the current value.",
        false,
      ),
    );
    return;
  }

  const next = mergeStaff(staff, patch);
  const changed = changedStaffKeys(staff, next);
  if (changed.length === 0) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "No changes",
        "Every value you sent already matches the current staff configuration.",
        false,
      ),
    );
    return;
  }

  const saved = await saveStaffConfig(guild.id, next);
  await guild.roles.fetch().catch(() => undefined);
  await guild.channels.fetch().catch(() => undefined);
  await respondStaff(
    interaction,
    staffConfigMessage(
      "edit",
      guild,
      saved,
      commandId,
      undefined,
      interaction.client.user?.displayAvatarURL({ size: 256 }),
    ),
  );
  await auditStaffConfigMutation(interaction, guild, settings, "edit", saved, changed);
}
