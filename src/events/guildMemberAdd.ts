import { Events, type Client } from "discord.js";
import type { I18nService } from "../framework/i18n/I18nService.js";
import { dispatchMemberMessage } from "../framework/memberMessages/memberMessageSender.js";

/**
 * Enregistre le listener `guildMemberAdd` et déclenche l'envoi d'un message
 * de bienvenue via `dispatchMemberMessage`.
 */
export const registerGuildMemberAdd = (client: Client, i18n: I18nService): void => {
  client.on(Events.GuildMemberAdd, (member) => {
    void dispatchMemberMessage({
      client,
      i18n,
      guild: member.guild,
      user: member.user,
      kind: "welcome",
    }).catch((error) => {
      console.error("[event:guildMemberAdd] failed to send welcome message", error);
    });
  });
};
