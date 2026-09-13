import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAllowedGuilds(raw: string): string[] {
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (ids.length === 0) {
    throw new Error("ALLOWED_GUILDS must list at least one Discord guild ID");
  }

  return ids;
}

export const env = {
  discordToken: required("DISCORD_TOKEN"),
  discordClientId: required("DISCORD_CLIENT_ID"),
  databaseUrl: required("DATABASE_URL"),
  allowedGuilds: parseAllowedGuilds(required("ALLOWED_GUILDS")),
};

export const COMMAND_PREFIX = "a?";
