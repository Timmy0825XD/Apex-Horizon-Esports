import type { ChatInputCommandInteraction } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { isGuildAdmin, isOrganiser } from "../../lib/permissions.js";
import { loadStaffConfig } from "../../lib/organiser.js";
import { auditSettingsMutation } from "./audit.js";
import { changedSettingKeys, mergeSettings, readSettingsPatch } from "./options.js";
import { deferSettings, respondSettings } from "./respond.js";
import { loadGuildSettings, saveGuildSettings } from "./store.js";
import { settingsErrorMessage, settingsMessage } from "./view.js";

export async function handleSettingsEdit(
  interaction: ChatInputCommandInteraction,
  commandId?: string,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondSettings(interaction, settingsErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferSettings(interaction);

  const current = await loadGuildSettings(guild.id);
  if (!current) {
    await respondSettings(
      interaction,
      settingsErrorMessage(
        "Settings not configured",
        `Run ${formatHelpEntry("settings set", commandId)} first. Every role and channel is required on that first pass.`,
        false,
      ),
    );
    return;
  }

  const staff = await loadStaffConfig(guild.id);
  if (!isGuildAdmin(interaction, current) && !isOrganiser(interaction, staff)) {
    await respondSettings(
      interaction,
      settingsErrorMessage(
        "Admin or organiser required",
        "You need **Admin** or **Organiser** to edit settings.",
        false,
      ),
    );
    return;
  }

  const patch = readSettingsPatch(interaction);
  if (Object.keys(patch).length === 0) {
    await respondSettings(
      interaction,
      settingsErrorMessage(
        "Nothing to update",
        "Pass at least one role or channel. Leave the rest empty to keep the current value.",
        false,
      ),
    );
    return;
  }

  const next = mergeSettings(current, patch);
  const changed = changedSettingKeys(current, next);
  if (changed.length === 0) {
    await respondSettings(
      interaction,
      settingsErrorMessage(
        "No changes",
        "Every value you sent already matches the current server settings.",
        false,
      ),
    );
    return;
  }

  const settings = await saveGuildSettings(guild.id, next);
  await guild.roles.fetch().catch(() => undefined);
  await guild.channels.fetch().catch(() => undefined);
  await respondSettings(interaction, settingsMessage("edit", guild, settings, commandId));
  await auditSettingsMutation(interaction, guild, "edit", settings, changed);
}
