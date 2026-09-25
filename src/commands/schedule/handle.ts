import { type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { runCreate } from "./create.js";
import { runDelete } from "./remove.js";
import { runShow, runUnassigned } from "./query.js";
import { runResign } from "./resign.js";
import { runResults, runResultsDelete } from "./results.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import { loadTicket } from "./ticket.js";
import { runRefresh, runUpdate } from "./update.js";

const unauthorized = scheduleNotice("error", "Server not allowed", "This server is not authorized to use this bot.");

export async function handleScheduleSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await dispatchSchedule(interaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "That schedule action could not be finished.";
    if (interaction.replied) {
      return;
    }
    const notice = scheduleNotice("error", "Schedule failed", message);
    if (interaction.deferred) {
      await replySchedule(interaction, notice).catch(() => undefined);
      return;
    }
    await interaction.reply(notice).catch(() => undefined);
  }
}

async function dispatchSchedule(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }
  const sub = interaction.options.getSubcommand();
  if (sub === "show") {
    await runShow(interaction);
    return;
  }
  if (sub === "unassigned") {
    await runUnassigned(interaction);
    return;
  }
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }
  const loaded = await loadTicket(interaction);
  if (typeof loaded === "string") {
    await replySchedule(interaction, scheduleNotice("error", "Not a battle ticket", loaded));
    return;
  }
  if (sub === "create") {
    await runCreate(interaction, loaded);
    return;
  }
  if (sub === "update") {
    await runUpdate(interaction, loaded);
    return;
  }
  if (sub === "delete") {
    await runDelete(interaction, loaded);
    return;
  }
  if (sub === "refresh") {
    if (!loaded.staff) {
      await replySchedule(interaction, scheduleNotice("error", "Staff not configured", "Staff roles are not configured yet."));
      return;
    }
    await runRefresh(interaction, loaded, loaded.staff);
    return;
  }
  if (sub === "resign") {
    await runResign(interaction, loaded);
    return;
  }
  if (sub === "results") {
    await runResults(interaction, loaded);
    return;
  }
  if (sub === "results_delete") {
    await runResultsDelete(interaction, loaded);
  }
}
