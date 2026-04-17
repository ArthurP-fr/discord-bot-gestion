/**
 * Commande `goodbye` (utility)
 *
 * Wrapper léger qui utilise la factory `createMemberMessageExecute` pour
 * afficher un panneau de configuration des messages d'au revoir.
 */
import { PermissionFlagsBits } from "discord.js";

import { defineCommand } from "../core/commands/defineCommand.js";
import type { I18nService } from "../i18n/index.js";
import {
  createMemberMessagePanelExecute,
  type MemberMessageService,
} from "../modules/memberMessages/index.js";

/** Commande `goodbye` — ouvre le panneau de configuration des messages 'goodbye'. */
export const createGoodbyeCommand = (memberMessageService: MemberMessageService, i18n: I18nService) => defineCommand({
  meta: {
    name: "goodbye",
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
  execute: createMemberMessagePanelExecute("goodbye", memberMessageService, i18n),
});
