/**
 * Commande `goodbye` (utility)
 *
 * Wrapper léger qui utilise la factory `createMemberMessageExecute` pour
 * afficher un panneau de configuration des messages d'au revoir.
 */
import { PermissionFlagsBits } from "discord.js";

import { defineCommand } from "../../framework/commands/defineCommand.js";
import { createMemberMessageExecute } from "./memberMessagePanel.js";

/** Commande `goodbye` — ouvre le panneau de configuration des messages 'goodbye'. */
export const goodbyeCommand = defineCommand({
  meta: {
    name: "goodbye",
    category: "utility",
  },
  permissions: [PermissionFlagsBits.ManageGuild],
  examples: [
    {
      source: "slash",
      descriptionKey: "examples.slash",
    },
  ],
  execute: createMemberMessageExecute("goodbye"),
});
