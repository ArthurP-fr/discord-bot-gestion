import { Events, type Client } from "discord.js";

import { createScopedLogger } from "../core/logging/logger.js";
import type { I18nService } from "../i18n/index.js";
import type { MemberMessageService } from "../modules/memberMessages/index.js";

const log = createScopedLogger("event:guildMemberAdd");

export const registerGuildMemberAdd = (
  client: Client,
  i18n: I18nService,
  memberMessageService: MemberMessageService,
): void => {
  client.on(Events.GuildMemberAdd, (member) => {
    void memberMessageService.assignWelcomeAutoRoles({ client, member }).then((result) => {
      if (result.assigned) {
        return;
      }

      if (result.reason === "no_roles_configured" || result.reason === "no_assignable_roles") {
        return;
      }

      log.warn(
        {
          guildId: member.guild.id,
          userId: member.user.id,
          reason: result.reason,
          configuredRoleIds: result.configuredRoleIds,
        },
        "failed to assign welcome auto roles",
      );
    }).catch((error) => {
      log.error(
        {
          guildId: member.guild.id,
          userId: member.user.id,
          err: error,
        },
        "welcome auto-role dispatch crashed",
      );
    });

    void memberMessageService.dispatch({
      client,
      i18n,
      guild: member.guild,
      user: member.user,
      kind: "welcome",
    }).catch((error) => {
      log.error(
        {
          guildId: member.guild.id,
          userId: member.user.id,
          err: error,
        },
        "failed to send welcome message",
      );
    });
  });
};
