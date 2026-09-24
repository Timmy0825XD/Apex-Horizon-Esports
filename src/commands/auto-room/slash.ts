import { SlashCommandBuilder } from "discord.js";

export const autoRoomSlash = new SlashCommandBuilder()
  .setName("auto_room")
  .setDescription("Turn automatic battle tickets on or off")
  .setDMPermission(false)
  .addStringOption((option) =>
    option.setName("tournament").setDescription("Tournament to update").setRequired(true).setAutocomplete(true),
  )
  .addBooleanOption((option) =>
    option.setName("status").setDescription("On opens ready matches now, then waits for 00:00 and 12:00 UTC").setRequired(true),
  );
