import { PermissionFlagsBits } from "discord.js";

import { defineCommand } from "../core/commands/defineCommand.js";
import {
  createPresenceCommandExecute,
  type PresenceService,
} from "../modules/presence/index.js";

export const createPresenceCommand = (presenceService: PresenceService) => defineCommand({
  meta: {
    name: "presence",
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
  execute: createPresenceCommandExecute(presenceService),
});
