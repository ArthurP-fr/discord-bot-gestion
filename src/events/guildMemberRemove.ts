import { Events, type Client } from "discord.js";
import type { I18nService } from "../framework/i18n/I18nService.js";
import { dispatchMemberMessage } from "../framework/memberMessages/memberMessageSender.js";

/**
 * Enregistre le listener `guildMemberRemove` et déclenche l'envoi d'un message
 * d'au revoir via `dispatchMemberMessage`.
 */
export const registerGuildMemberRemove = (client: Client, i18n: I18nService): void => {
  client.on(Events.GuildMemberRemove, (member) => {
    void dispatchMemberMessage({
      client,
      i18n,
      guild: member.guild,
      user: member.user,
      kind: "goodbye",
    }).catch((error) => {
      console.error("[event:guildMemberRemove] failed to send goodbye message", error);
    });
  });
};
