import { Events, type Client } from "discord.js";
import { deployApplicationCommands } from "../core/commands/deploy.js";
import { env } from "../config/env.js";
import { restorePresenceFromStorage } from "../commands/presence.js";
import type { CommandRegistry } from "../core/commands/registry.js";
import type { I18nService } from "../i18n/index.js";

/**
 * Attache le listener `ready` et exécute les tâches post-démarrage:
 * - restauration de la présence
 * - (optionnel) déploiement des commandes slash
 */
export const registerClientReady = (client: Client, registry: CommandRegistry, i18n: I18nService): void => {
  client.once(Events.ClientReady, async () => {
    console.log(`[ready] logged as ${client.user?.tag ?? "unknown"}`);
    try {
      await restorePresenceFromStorage(client);
    } catch (error) {
      console.error("[ready] failed to restore bot presence", error);
    }

    if (env.AUTO_DEPLOY_SLASH) {
      try {
        const result = await deployApplicationCommands({
          token: env.DISCORD_TOKEN,
          clientId: env.DISCORD_CLIENT_ID,
          registry,
          i18n,
          ...(env.DEV_GUILD_ID ? { guildId: env.DEV_GUILD_ID } : {}),
        });
        console.log(`[ready] slash sync done (${result.scope}, ${result.count} commands)`);
      } catch (error) {
        console.error("[ready] slash sync failed", error);
      }
    }
  });
};
