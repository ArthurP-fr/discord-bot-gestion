import { Events, type Client, type ChatInputCommandInteraction } from "discord.js";

/**
 * Enregistre le listener `interactionCreate` pour les commandes slash (chat input).
 *
 * @param client - instance du Client Discord
 * @param onSlashInteraction - fonction à appeler pour traiter les interactions slash
 */
export const registerInteractionCreate = (
  client: Client,
  onSlashInteraction: (interaction: ChatInputCommandInteraction) => Promise<void>,
): void => {
  client.on(Events.InteractionCreate, (interaction) => {
    // On ne traite que les `ChatInputCommand` (slash)
    if (!interaction || typeof (interaction as any).isChatInputCommand !== "function") {
      return;
    }

    try {
      if (!(interaction as any).isChatInputCommand()) {
        return;
      }
    } catch {
      return;
    }

    // Cast sécurisé par le test `isChatInputCommand()` effectué ci‑dessus
    void onSlashInteraction(interaction as ChatInputCommandInteraction).catch((error) => {
      console.error("[event:interactionCreate] handler failed", error);
    });
  });
};
