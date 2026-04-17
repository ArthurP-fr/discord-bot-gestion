import { Events, type Client } from "discord.js";
import { createScopedLogger } from "../core/logging/logger.js";

const log = createScopedLogger("event:guildCreate");

/**
 * Enregistre le listener `guildCreate` (bot ajouté à un serveur).
 *
 * Action minimale: log pour monitoring ; peut être étendu (initialisation de configs, etc.).
 */
export const registerGuildCreate = (client: Client): void => {
  client.on(Events.GuildCreate, (guild) => {
    log.info({ guildId: guild.id, guildName: guild.name }, "joined guild");
  });
};
