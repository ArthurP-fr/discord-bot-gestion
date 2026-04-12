/**
 * Liste des commandes exportées par le module `commands`.
 *
 * Ce fichier centralise l'ordre par défaut des commandes et permet de
 * récupérer facilement la liste pour l'enregistrement (registry/dispatch).
 */
import { helpCommand } from "./core/help.js";
import { kissCommand } from "./fun/kiss.js";
import { advancedCommand } from "./utility/advanced.js";
import { goodbyeCommand } from "./utility/goodbye.js";
import { presenceCommand } from "./utility/presence.js";
import { pingCommand } from "./utility/ping.js";
import { welcomeCommand } from "./utility/welcome.js";

import type { BotCommand } from "../framework/types/command.js";

/** CommandList: tableau ordonné des commandes disponibles. */
export const commandList: BotCommand[] = [
  kissCommand,
  pingCommand,
  advancedCommand,
  welcomeCommand,
  goodbyeCommand,
  presenceCommand,
  helpCommand,
];
