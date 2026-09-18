import type { ChatInputCommandInteraction } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { isGuildAdmin } from "../../lib/permissions.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { auditStaffConfigMutation } from "./audit.js";
import { staffFields } from "./fields.js";
import { readRequiredStaff } from "./options.js";
import { deferStaff, respondStaff } from "./respond.js";
import { loadGuildStaffState, saveStaffConfig } from "./store.js";
import { staffConfigMessage, staffErrorMessage } from "./view.js";

export async function handleStaffConfigSet(
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
        `Run ${formatHelpEntry("settings set", settingsCommandIdFor(guild.id))} first. Staff config needs the server layer (admin role and bot logs).`,
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
        "You need the Discord **Administrator** permission or the configured **Admin Role** to set the staff hierarchy.",
        false,
      ),
    );
    return;
  }

  if (staff) {
    await respondStaff(
      interaction,
      staffErrorMessage(
        "Staff config already exists",
        `This server already has a staff hierarchy. Use ${formatHelpEntry("staff config edit", commandId)} to change a role or channel.`,
        false,
      ),
    );
    return;
  }

  const saved = await saveStaffConfig(guild.id, readRequiredStaff(interaction));
  await guild.roles.fetch().catch(() => undefined);
  await guild.channels.fetch().catch(() => undefined);
  await respondStaff(
    interaction,
    staffConfigMessage(
      "set",
      guild,
      saved,
      commandId,
      settingsCommandIdFor(guild.id),
      interaction.client.user?.displayAvatarURL({ size: 256 }),
    ),
  );
  await auditStaffConfigMutation(
    interaction,
    guild,
    settings,
    "set",
    saved,
    staffFields.map((field) => field.key),
  );
}
