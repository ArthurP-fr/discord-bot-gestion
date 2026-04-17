import { Events, type Client } from "discord.js";

import { env } from "../config/env.js";
import { deployApplicationCommands } from "../core/commands/deploy.js";
import { createScopedLogger } from "../core/logging/logger.js";
import type { LeaderCoordinator } from "../core/runtime/leaderCoordinator.js";
import type { CommandRegistry } from "../core/commands/registry.js";
import type { I18nService } from "../i18n/index.js";
import type { PresenceService } from "../modules/presence/index.js";

const log = createScopedLogger("event:ready");

export interface RuntimeBotAuth {
  token: string;
  clientId: string;
}

export const registerClientReady = (
  client: Client,
  registry: CommandRegistry,
  i18n: I18nService,
  presenceService: PresenceService,
  leaderCoordinator: LeaderCoordinator,
  runtimeAuth?: RuntimeBotAuth,
): void => {
  client.once(Events.ClientReady, async () => {
    log.info({ botTag: client.user?.tag ?? "unknown" }, "client ready");

    const botId = client.user?.id;
    if (!botId) {
      log.error("client ready event received without bot id, leader-only tasks skipped");
      return;
    }

    try {
      const restoredByLeader = await leaderCoordinator.runIfLeader("presence-restore", botId, async () => {
        await presenceService.restoreFromStorage(client);
      });

      if (!restoredByLeader) {
        log.info("presence restore skipped: leader lock already held by another instance");
      }
    } catch (error) {
      log.error({ err: error }, "failed to restore bot presence");
    }

    if (env.AUTO_DEPLOY_SLASH) {
      if (!runtimeAuth) {
        log.warn("slash sync skipped: runtime auth is missing for this bot instance");
        return;
      }

      try {
        const deployedByLeader = await leaderCoordinator.runIfLeader("slash-deploy", botId, async () => {
          const result = await deployApplicationCommands({
            token: runtimeAuth.token,
            clientId: runtimeAuth.clientId,
            registry,
            i18n,
            ...(env.DEV_GUILD_ID ? { guildId: env.DEV_GUILD_ID } : {}),
          });

          log.info(
            {
              scope: result.scope,
              count: result.count,
            },
            "slash sync completed",
          );
        });

        if (!deployedByLeader) {
          log.info("slash sync skipped: leader lock already held by another instance");
        }
      } catch (error) {
        log.error({ err: error }, "slash sync failed");
      }
    }
  });
};
