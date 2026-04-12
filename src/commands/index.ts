import { helpCommand } from "./core/help.js";
import { kissCommand } from "./fun/kiss.js";
import { advancedCommand } from "./utility/advanced.js";
import { pingCommand } from "./utility/ping.js";

import type { BotCommand } from "../framework/types/command.js";

export const commandList: BotCommand[] = [kissCommand, pingCommand, advancedCommand, helpCommand];
