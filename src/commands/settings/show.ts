import type { ChatInputCommandInteraction } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { isGuildAdmin, isOrganiser } from "../../lib/permissions.js";
import { loadStaffConfig } from "../../lib/organiser.js";
import { deferSettings, respondSettings } from "./respond.js";
import { loadGuildSettings } from "./store.js";
import { settingsErrorMessage, settingsMessage } from "./view.js";

export async function handleSettingsShow(
  interaction: ChatInputCommandInteraction,
  commandId?: string,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondSettings(interaction, settingsErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferSettings(interaction);

  const settings = await loadGuildSettings(guild.id);
  if (!settings) {
    await respondSettings(
      interaction,
      settingsErrorMessage(
        "Settings not configured",
        `Nothing is stored yet. A Discord **Administrator** can run ${formatHelpEntry("settings set", commandId)} to save the server layer.`,
        false,
      ),
    );
    return;
  }

  const staff = await loadStaffConfig(guild.id);
  if (!isGuildAdmin(interaction, settings) && !isOrganiser(interaction, staff)) {
    await respondSettings(
      interaction,
      settingsErrorMessage(
        "Admin or organiser required",
        "You need **Admin** or **Organiser** to view settings.",
        false,
      ),
    );
    return;
  }

  await guild.roles.fetch().catch(() => undefined);
  await guild.channels.fetch().catch(() => undefined);
  await respondSettings(interaction, settingsMessage("show", guild, settings, commandId));
}
