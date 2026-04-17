import { Events, type Client } from "discord.js";

import { createScopedLogger } from "../core/logging/logger.js";
import type { LogEventService } from "../modules/logs/index.js";
import type { MemberMessageService } from "../modules/memberMessages/index.js";

const log = createScopedLogger("event:guildDelete");

export const registerGuildDelete = (
  client: Client,
  memberMessageService: MemberMessageService,
  logEventService: LogEventService,
): void => {
  client.on(Events.GuildDelete, (guild) => {
    log.info({ guildId: guild.id, guildName: guild.name }, "left guild");

    const botId = logEventService.resolveBotId(client);
    if (!botId) {
      return;
    }

    void Promise.all([
      memberMessageService.cleanupGuild(botId, guild.id),
      logEventService.cleanupGuild(botId, guild.id),
    ]).catch((error) => {
      log.error({ guildId: guild.id, botId, err: error }, "failed to cleanup guild config");
    });
  });
};
