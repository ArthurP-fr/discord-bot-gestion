/**
 * Commande `welcome` (utility)
 *
 * Wrapper léger qui utilise la factory `createMemberMessageExecute` pour
 * afficher un panneau de configuration des messages d'accueil.
 */
import { PermissionFlagsBits } from "discord.js";

import { defineCommand } from "../core/commands/defineCommand.js";
import type { I18nService } from "../i18n/index.js";
import {
  createMemberMessagePanelExecute,
  type MemberMessageService,
} from "../modules/memberMessages/index.js";

/** Commande `welcome` — ouvre le panneau de configuration des messages 'welcome'. */
export const createWelcomeCommand = (memberMessageService: MemberMessageService, i18n: I18nService) => defineCommand({
  meta: {
    name: "welcome",
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
  execute: createMemberMessagePanelExecute("welcome", memberMessageService, i18n),
});
