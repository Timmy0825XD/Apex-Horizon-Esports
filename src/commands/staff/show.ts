import type { ChatInputCommandInteraction } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { isGuildAdmin } from "../../lib/permissions.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { deferStaff, respondStaff } from "./respond.js";
import { loadGuildStaffState } from "./store.js";
import { staffConfigMessage, staffErrorMessage } from "./view.js";

export async function handleStaffConfigView(
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
        `Nothing is stored yet. An **Admin** can run ${formatHelpEntry("staff config set", commandId)} to save the hierarchy.`,
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
        "You need the Discord **Administrator** permission or the configured **Admin Role** to view the staff hierarchy.",
        false,
      ),
    );
    return;
  }

  await guild.roles.fetch().catch(() => undefined);
  await guild.channels.fetch().catch(() => undefined);
  await respondStaff(interaction, staffConfigMessage("view", guild, staff, commandId));
}
