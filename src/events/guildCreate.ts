import { Events, type Client } from "discord.js";

/**
 * Enregistre le listener `guildCreate` (bot ajouté à un serveur).
 *
 * Action minimale: log pour monitoring ; peut être étendu (initialisation de configs, etc.).
 */
export const registerGuildCreate = (client: Client): void => {
  client.on(Events.GuildCreate, (guild) => {
    console.log(`[event:guildCreate] joined guild ${guild.id} (${guild.name})`);
  });
};
