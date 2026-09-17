import type { ChatInputCommandInteraction } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { isDiscordAdministrator } from "../../lib/permissions.js";
import { auditSettingsMutation } from "./audit.js";
import { settingFields } from "./fields.js";
import { readRequiredSettings } from "./options.js";
import { deferSettings, respondSettings } from "./respond.js";
import { loadGuildSettings, saveGuildSettings } from "./store.js";
import { settingsErrorMessage, settingsMessage } from "./view.js";

export async function handleSettingsSet(
  interaction: ChatInputCommandInteraction,
  commandId?: string,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondSettings(interaction, settingsErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  if (!isDiscordAdministrator(interaction)) {
    await respondSettings(
      interaction,
      settingsErrorMessage(
        "Administrator required",
        "Only a Discord **Administrator** can run `/settings set` the first time.",
      ),
    );
    return;
  }

  await deferSettings(interaction);

  const existing = await loadGuildSettings(guild.id);
  if (existing) {
    await respondSettings(
      interaction,
      settingsErrorMessage(
        "Settings already exist",
        `This server is already configured. Use ${formatHelpEntry("settings edit", commandId)} to change a role or channel.`,
        false,
      ),
    );
    return;
  }

  const settings = await saveGuildSettings(guild.id, readRequiredSettings(interaction));
  await guild.roles.fetch().catch(() => undefined);
  await guild.channels.fetch().catch(() => undefined);
  await respondSettings(interaction, settingsMessage("set", guild, settings, commandId));
  await auditSettingsMutation(
    interaction,
    guild,
    "set",
    settings,
    settingFields.map((field) => field.key),
  );
}
