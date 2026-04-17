/**
 * Liste des commandes exportées par le module `commands`.
 *
 * Ce fichier centralise l'ordre par défaut des commandes et permet de
 * récupérer facilement la liste pour l'enregistrement (registry/dispatch).
 */
import { helpCommand } from "./help.js";
import { kissCommand } from "./kiss.js";
import { createGoodbyeCommand } from "./goodbye.js";
import { createLogsCommand } from "./logs.js";
import { createPresenceCommand } from "./presence.js";
import { pingCommand } from "./ping.js";
import { createWelcomeCommand } from "./welcome.js";
import type { AppFeatureServices } from "../app/container.js";
import type { I18nService } from "../i18n/index.js";

import type { BotCommand } from "../types/command.js";

/** CommandList: tableau ordonné des commandes disponibles. */
export const createCommandList = (services: AppFeatureServices, i18n: I18nService): BotCommand[] => [
  kissCommand,
  pingCommand,
  createWelcomeCommand(services.memberMessageService, i18n),
  createGoodbyeCommand(services.memberMessageService, i18n),
  createPresenceCommand(services.presenceService),
  createLogsCommand(services.logEventService),
  helpCommand,
];
