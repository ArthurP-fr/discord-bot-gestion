import type { ChatInputCommandInteraction, Client, Message } from "discord.js";

import type { AppFeatureServices } from "../app/container.js";
import type { CommandRegistry } from "../core/commands/registry.js";
import type { LeaderCoordinator } from "../core/runtime/leaderCoordinator.js";
import type { I18nService } from "../i18n/index.js";
import { registerGuildCreate } from "./guildCreate.js";
import { registerGuildDelete } from "./guildDelete.js";
import { registerGuildMemberAdd } from "./guildMemberAdd.js";
import { registerGuildMemberRemove } from "./guildMemberRemove.js";
import { registerInteractionCreate } from "./interactionCreate.js";
import { registerLogRuntimeEvents } from "./logsRuntime.js";
import { registerMessageCreate } from "./messageCreate.js";
import type { RuntimeBotAuth } from "./ready.js";
import { registerClientReady } from "./ready.js";

export const registerEvents = (
  client: Client,
  i18n: I18nService,
  handlers: {
    onPrefixMessage: (m: Message) => Promise<void>;
    onSlashInteraction: (i: ChatInputCommandInteraction) => Promise<void>;
  },
  registry: CommandRegistry,
  services: AppFeatureServices,
  leaderCoordinator: LeaderCoordinator,
  runtimeAuth?: RuntimeBotAuth,
): void => {
  registerMessageCreate(client, handlers.onPrefixMessage);
  registerInteractionCreate(client, handlers.onSlashInteraction);
  registerLogRuntimeEvents(client, services.logEventService);

  registerGuildMemberAdd(client, i18n, services.memberMessageService);
  registerGuildMemberRemove(client, i18n, services.memberMessageService);

  registerGuildCreate(client);
  registerGuildDelete(client, services.memberMessageService, services.logEventService);

  registerClientReady(client, registry, i18n, services.presenceService, leaderCoordinator, runtimeAuth);
};
