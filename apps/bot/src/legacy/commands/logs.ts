import { PermissionFlagsBits } from "discord.js";

import { defineCommand } from "../core/commands/defineCommand.js";
import {
  createLogsCommandExecute,
  type LogEventService,
} from "../modules/logs/index.js";

export const createLogsCommand = (logEventService: LogEventService) => defineCommand({
  meta: {
    name: "logs",
    category: "utility",
  },
  permissions: [PermissionFlagsBits.ManageGuild],
  sensitive: true,
  examples: [
    {
      source: "slash",
      descriptionKey: "examples.slash",
    },
  ],
  execute: createLogsCommandExecute(logEventService),
});