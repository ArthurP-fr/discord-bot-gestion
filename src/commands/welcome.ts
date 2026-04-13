/**
 * Commande `welcome` (utility)
 *
 * Wrapper léger qui utilise la factory `createMemberMessageExecute` pour
 * afficher un panneau de configuration des messages d'accueil.
 */
import { PermissionFlagsBits } from "discord.js";

import { defineCommand } from "../core/commands/defineCommand.js";
import { createMemberMessageExecute } from "./memberMessagePanel.js";

/** Commande `welcome` — ouvre le panneau de configuration des messages 'welcome'. */
export const welcomeCommand = defineCommand({
  meta: {
    name: "welcome",
    category: "utility",
  },
  permissions: [PermissionFlagsBits.ManageGuild],
  examples: [
    {
      source: "slash",
      descriptionKey: "examples.slash",
    },
  ],
  execute: createMemberMessageExecute("welcome"),
});
