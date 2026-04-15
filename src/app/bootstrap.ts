import { Client, GatewayIntentBits } from "discord.js";
import { Redis } from "ioredis";
import { Pool } from "pg";

import type { AppFeatureServices } from "./container.js";
import { createCommandList } from "../commands/index.js";
import { env } from "../config/env.js";
import { CommandRegistry } from "../core/commands/registry.js";
import { CommandExecutor } from "../core/execution/CommandExecutor.js";
import {
  type CommandDispatchMode,
  LocalCommandDispatchPort,
} from "../core/execution/dispatch.js";
import {
  MemoryCooldownStore,
  RedisCooldownStore,
} from "../core/execution/cooldownStore.js";
import {
  MemoryGlobalRateLimitStore,
  RedisGlobalRateLimitStore,
} from "../core/execution/globalRateLimitStore.js";
import { createScopedLogger } from "../core/logging/logger.js";
import {
  LocalLeaderCoordinator,
  PostgresLeaderCoordinator,
} from "../core/runtime/leaderCoordinator.js";
import { PostgresMemberMessageStore } from "../database/stores/memberMessageStore.js";
import { PostgresPresenceStore } from "../database/stores/presenceStore.js";
import { DatabaseLifecycle } from "../database/dbLifecycle.js";
import { registerEvents } from "../events/index.js";
import { createPrefixHandler } from "../handlers/prefixHandler.js";
import { createSlashHandler } from "../handlers/slashHandler.js";
import { I18nService } from "../i18n/index.js";
import {
  MemberMessageService,
} from "../modules/memberMessages/index.js";
import {
  PresenceService,
} from "../modules/presence/index.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;
const log = createScopedLogger("bootstrap");

const bindGracefulShutdown = (shutdown: (signal: string) => Promise<void>): void => {
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
};

const bindFatalProcessHandlers = (
  shutdown: (signal: string, exitCode?: number, error?: unknown) => Promise<void>,
): void => {
  process.once("uncaughtException", (error) => {
    log.error({ err: error }, "process uncaught exception");
    void shutdown("UNCAUGHT_EXCEPTION", 1, error);
  });

  process.once("unhandledRejection", (reason) => {
    log.error({ reason }, "process unhandled rejection");
    void shutdown("UNHANDLED_REJECTION", 1, reason);
  });
};

export const bootstrap = async (): Promise<void> => {
  const dispatchMode: CommandDispatchMode = env.COMMAND_DISPATCH_MODE;
  if (dispatchMode === "worker") {
    throw new Error("Worker mode is not implemented and must not be used in production");
  }

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL
      ? {
        rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED,
        ...(env.DATABASE_SSL_CA ? { ca: env.DATABASE_SSL_CA } : {}),
      }
      : undefined,
  });

  const requiresRedis = env.STATE_BACKEND === "redis";
  let redis: Redis | null = null;

  if (requiresRedis) {
    const redisUrl = env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL is required when STATE_BACKEND=redis");
    }

    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });

      await redis.ping();
    } catch (error) {
      log.error(
        {
          err: error,
          stateBackend: env.STATE_BACKEND,
        },
        "redis unavailable at startup",
      );
      throw error;
    }
  }

  const presenceStore = new PostgresPresenceStore(pool);
  const memberMessageStore = new PostgresMemberMessageStore(pool);

  const dbLifecycle = new DatabaseLifecycle(
    [
      { name: "presenceStore", init: () => presenceStore.init() },
      { name: "memberMessageStore", init: () => memberMessageStore.init() },
    ],
    async () => {
      await pool.end();
    },
  );

  const services: AppFeatureServices = {
    presenceService: new PresenceService(presenceStore, env.PRESENCE_STREAM_URL),
    memberMessageService: new MemberMessageService(memberMessageStore),
  };

  const cooldownStore = env.STATE_BACKEND === "redis" && redis
    ? new RedisCooldownStore(redis)
    : new MemoryCooldownStore();

  const globalRateLimitStore = env.STATE_BACKEND === "redis" && redis
    ? new RedisGlobalRateLimitStore(redis)
    : new MemoryGlobalRateLimitStore();

  const executor = new CommandExecutor({
    cooldownStore,
    globalRateLimitStore,
    globalRateLimitPolicy: {
      limit: env.GLOBAL_RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: env.GLOBAL_RATE_LIMIT_WINDOW_SECONDS,
    },
    rateLimitFailOpen: env.RATE_LIMIT_FAIL_OPEN,
    logger: createScopedLogger("command-executor"),
  });

  const dispatcher = new LocalCommandDispatchPort(executor);

  const leaderCoordinator = env.ENABLE_LEADER_ELECTION
    ? new PostgresLeaderCoordinator(pool, "discordjs-framework-template")
    : new LocalLeaderCoordinator();

  let shuttingDown = false;
  let client: Client | null = null;

  const shutdown = async (signal: string, exitCode = 0, error?: unknown): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    log.info({ signal }, "shutdown signal received");

    if (error !== undefined) {
      log.error({ signal, err: error }, "shutdown reason");
    }

    const forcedExitCode = exitCode === 0 ? 1 : exitCode;
    const forceExitTimer = setTimeout(() => {
      log.error({ signal, forcedExitCode, timeoutMs: SHUTDOWN_TIMEOUT_MS }, "forcing process exit");
      process.exit(forcedExitCode);
    }, SHUTDOWN_TIMEOUT_MS);

    forceExitTimer.unref?.();

    if (client) {
      client.destroy();
    }

    await services.presenceService.shutdown().catch((error) => {
      log.error({ err: error }, "presence service shutdown failed");
    });

    await dbLifecycle.shutdown().catch((error) => {
      log.error({ err: error }, "database shutdown failed");
    });

    if (redis) {
      await redis.quit().catch((error: unknown) => {
        log.error({ err: error }, "redis shutdown failed");
      });
    }

    clearTimeout(forceExitTimer);
    process.exit(exitCode);
  };

  bindFatalProcessHandlers(shutdown);

  try {
    await dbLifecycle.init();
    bindGracefulShutdown((signal) => shutdown(signal));

    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

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

    registerEvents(
      client,
      i18n,
      { onPrefixMessage, onSlashInteraction },
      registry,
      services,
      leaderCoordinator,
    );

    log.info(
      {
        stateBackend: env.STATE_BACKEND,
        commandDispatchMode: dispatchMode,
        configuredCommandDispatchMode: env.COMMAND_DISPATCH_MODE,
        rateLimitFailOpen: env.RATE_LIMIT_FAIL_OPEN,
        rateLimit: {
          maxRequests: env.GLOBAL_RATE_LIMIT_MAX_REQUESTS,
          windowSeconds: env.GLOBAL_RATE_LIMIT_WINDOW_SECONDS,
        },
      },
      "runtime initialized",
    );

    await client.login(env.DISCORD_TOKEN);
  } catch (error) {
    await shutdown("BOOTSTRAP_FAILURE", 1, error);
    throw error;
  }
};
