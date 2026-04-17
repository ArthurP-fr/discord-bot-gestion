import { Events, type Client } from "discord.js";

import { createScopedLogger } from "../core/logging/logger.js";
import type { I18nService } from "../i18n/index.js";
import type { MemberMessageService } from "../modules/memberMessages/index.js";

const log = createScopedLogger("event:guildMemberRemove");

export const registerGuildMemberRemove = (
  client: Client,
  i18n: I18nService,
  memberMessageService: MemberMessageService,
): void => {
  client.on(Events.GuildMemberRemove, (member) => {
    void memberMessageService.dispatch({
      client,
      i18n,
      guild: member.guild,
      user: member.user,
      kind: "goodbye",
    }).catch((error) => {
      log.error(
        {
          guildId: member.guild.id,
          userId: member.user.id,
          err: error,
        },
        "failed to send goodbye message",
      );
    });
  });
};
