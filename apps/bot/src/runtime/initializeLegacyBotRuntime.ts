import type { Client } from "discord.js";
import type { Pool } from "pg";

import type { AppFeatureServices } from "../legacy/app/container.js";
import { createCommandList } from "../legacy/commands/index.js";
import { env } from "../legacy/config/env.js";
import { CommandRegistry } from "../legacy/core/commands/registry.js";
import { LocalCommandDispatchPort } from "../legacy/core/execution/dispatch.js";
import {
  MemoryCooldownStore,
} from "../legacy/core/execution/cooldownStore.js";
import {
  MemoryGlobalRateLimitStore,
} from "../legacy/core/execution/globalRateLimitStore.js";
import { CommandExecutor } from "../legacy/core/execution/CommandExecutor.js";
import { createScopedLogger } from "../legacy/core/logging/logger.js";
import {
  LocalLeaderCoordinator,
  PostgresLeaderCoordinator,
} from "../legacy/core/runtime/leaderCoordinator.js";
import { DatabaseLifecycle } from "../legacy/database/dbLifecycle.js";
import { registerEvents } from "../legacy/events/index.js";
import { createPrefixHandler } from "../legacy/handlers/prefixHandler.js";
import { createSlashHandler } from "../legacy/handlers/slashHandler.js";
import { I18nService } from "../legacy/i18n/index.js";
import {
  LogEventService,
} from "../legacy/modules/logs/index.js";
import {
  MemberMessageService,
} from "../legacy/modules/memberMessages/index.js";
import {
  PresenceService,
} from "../legacy/modules/presence/index.js";
import { TenantLogEventStore } from "./stores/TenantLogEventStore.js";
import { TenantMemberMessageStore } from "./stores/TenantMemberMessageStore.js";
import { TenantPresenceStore } from "./stores/TenantPresenceStore.js";

const log = createScopedLogger("legacy-runtime");

export interface InitializeLegacyBotRuntimeInput {
  client: Client;
  pool: Pool;
  tenantId: string;
  ownerUserId: string;
  botToken: string;
  botClientId: string;
}

export interface LegacyBotRuntime {
  shutdown: () => Promise<void>;
}

export const initializeLegacyBotRuntime = async (
  input: InitializeLegacyBotRuntimeInput,
): Promise<LegacyBotRuntime> => {
  const presenceStore = new TenantPresenceStore(input.pool, input.tenantId, input.ownerUserId);
  const memberMessageStore = new TenantMemberMessageStore(input.pool, input.tenantId, input.ownerUserId);
  const logEventStore = new TenantLogEventStore(input.pool, input.tenantId, input.ownerUserId);

  const dbLifecycle = new DatabaseLifecycle(
    [
      { name: "presenceStore", init: () => presenceStore.init() },
      { name: "memberMessageStore", init: () => memberMessageStore.init() },
      { name: "logEventStore", init: () => logEventStore.init() },
    ],
    async () => undefined,
  );

  await dbLifecycle.init();

  const services: AppFeatureServices = {
    presenceService: new PresenceService(presenceStore, env.PRESENCE_STREAM_URL),
    memberMessageService: new MemberMessageService(memberMessageStore),
    logEventService: new LogEventService(logEventStore),
  };

  const executor = new CommandExecutor({
    cooldownStore: new MemoryCooldownStore(),
    globalRateLimitStore: new MemoryGlobalRateLimitStore(),
    globalRateLimitPolicy: {
      limit: env.GLOBAL_RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: env.GLOBAL_RATE_LIMIT_WINDOW_SECONDS,
    },
    rateLimitFailOpen: env.RATE_LIMIT_FAIL_OPEN,
    logger: createScopedLogger("legacy-command-executor"),
  });

  const dispatcher = new LocalCommandDispatchPort(executor);
  const i18n = new I18nService(env.DEFAULT_LANG);
  const registry = new CommandRegistry(createCommandList(services, i18n), i18n);

  const onPrefixMessage = createPrefixHandler({
    registry,
    i18n,
    dispatcher,
    prefix: env.PREFIX,
    defaultLang: env.DEFAULT_LANG,
  });

  const onSlashInteraction = createSlashHandler({
    registry,
    i18n,
    dispatcher,
    prefix: env.PREFIX,
    defaultLang: env.DEFAULT_LANG,
  });

  const leaderCoordinator = env.ENABLE_LEADER_ELECTION
    ? new PostgresLeaderCoordinator(input.pool, "discord-saas-platform")
    : new LocalLeaderCoordinator();

  registerEvents(
    input.client,
    i18n,
    { onPrefixMessage, onSlashInteraction },
    registry,
    services,
    leaderCoordinator,
    {
      token: input.botToken,
      clientId: input.botClientId,
    },
  );

  log.info(
    {
      tenantId: input.tenantId,
      botClientId: input.botClientId,
      prefix: env.PREFIX,
      defaultLang: env.DEFAULT_LANG,
      autoDeploySlash: env.AUTO_DEPLOY_SLASH,
    },
    "legacy runtime initialized",
  );

  return {
    shutdown: async () => {
      await services.logEventService.shutdown().catch((error) => {
        log.error({ err: error, tenantId: input.tenantId, botClientId: input.botClientId }, "logs service shutdown failed");
      });

      await services.presenceService.shutdown().catch((error) => {
        log.error({ err: error, tenantId: input.tenantId, botClientId: input.botClientId }, "presence service shutdown failed");
      });

      await dbLifecycle.shutdown().catch((error) => {
        log.error({ err: error, tenantId: input.tenantId, botClientId: input.botClientId }, "runtime db lifecycle shutdown failed");
      });
    },
  };
};
