import { Events, type Client } from "discord.js";

/**
 * Enregistre le listener `guildDelete` (bot retiré d'un serveur).
 *
 * Action minimale: log pour monitoring ; peut être étendu (cleanup, etc.).
 */
export const registerGuildDelete = (client: Client): void => {
  client.on(Events.GuildDelete, (guild) => {
    console.log(`[event:guildDelete] left guild ${guild.id} (${guild.name})`);
  });
};
