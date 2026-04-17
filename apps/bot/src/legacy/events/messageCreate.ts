import { Events, type Client, type Message } from "discord.js";
import { createScopedLogger } from "../core/logging/logger.js";

const log = createScopedLogger("event:messageCreate");

/**
 * Enregistre le listener `messageCreate` en déléguant au handler fourni.
 *
 * @param client - instance du Client Discord
 * @param onPrefixMessage - fonction à appeler pour traiter les messages (préfixe)
 */
export const registerMessageCreate = (client: Client, onPrefixMessage: (message: Message) => Promise<void>): void => {
  client.on(Events.MessageCreate, (message: Message) => {
    void onPrefixMessage(message).catch((error) => {
      log.error({ err: error }, "handler failed");
    });
  });
};
