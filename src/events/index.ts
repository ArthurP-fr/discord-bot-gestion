import type { Client, Message, ChatInputCommandInteraction } from "discord.js";
import type { I18nService } from "../framework/i18n/I18nService.js";

import { registerMessageCreate } from "./messageCreate.js";
import { registerInteractionCreate } from "./interactionCreate.js";
import { registerGuildMemberAdd } from "./guildMemberAdd.js";
import { registerGuildMemberRemove } from "./guildMemberRemove.js";
import { registerGuildCreate } from "./guildCreate.js";
import { registerGuildDelete } from "./guildDelete.js";
import { registerClientReady } from "./ready.js";
import type { CommandRegistry } from "../framework/commands/registry.js";

/**
 * Regroupe l'enregistrement des événements Discord les plus courants.
 *
 * @param client - instance du Client Discord
 * @param i18n - instance de service i18n
 * @param handlers - objets contenant les handlers pour message/interaction
 */
export const registerEvents = (
  client: Client,
  i18n: I18nService,
  handlers: { onPrefixMessage: (m: Message) => Promise<void>; onSlashInteraction: (i: ChatInputCommandInteraction) => Promise<void> },
  registry: CommandRegistry,
): void => {
  registerMessageCreate(client, handlers.onPrefixMessage);
  registerInteractionCreate(client, handlers.onSlashInteraction);

  registerGuildMemberAdd(client, i18n);
  registerGuildMemberRemove(client, i18n);

  registerGuildCreate(client);
  registerGuildDelete(client);

  // Ready: tâches à exécuter au démarrage du client
  registerClientReady(client, registry, i18n);
};
