import { createServer } from "node:http";

import { Redis } from "ioredis";
import { parseTokenEncryptionKey } from "@saas/shared";

import { env } from "./config/env.js";
import { createPgPool } from "./db/pool.js";
import { BotManager } from "./manager/BotManager.js";
import { createBotControlWorker } from "./queue/worker.js";

const bootstrap = async (): Promise<void> => {
  const pgPool = createPgPool();

  const redis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    })
    : null;

  await pgPool.query("SELECT 1");
  if (redis) {
    await redis.ping();
  }

  const manager = new BotManager(pgPool, parseTokenEncryptionKey(env.TOKEN_ENCRYPTION_KEY));
  await manager.loadAndStartPersistedBots();

  const worker = redis ? createBotControlWorker(redis.duplicate(), manager) : null;

  if (worker) {
    worker.on("completed", (job) => {
      // eslint-disable-next-line no-console
      console.log(`[bot] completed ${job.data.action} for bot ${job.data.botId}`);
    });

    worker.on("failed", (job, error) => {
      // eslint-disable-next-line no-console
      console.error(`[bot] failed ${job?.data.action ?? "unknown"} for bot ${job?.data.botId ?? "unknown"}`, error);
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn("[bot] REDIS_URL is not configured, bot control queue worker is disabled");
  }

  const healthServer = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      const payload = JSON.stringify({
        ok: true,
        service: "bot",
        runningBots: manager.getRunningCount(),
        bots: manager.listRunningBots(),
        timestamp: new Date().toISOString(),
      });

      res.writeHead(200, {
        "Content-Type": "application/json",
      });
      res.end(payload);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  healthServer.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[bot] health endpoint available on :${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`[bot] shutdown requested (${signal})`);

    healthServer.close(async () => {
      await worker?.close().catch(() => undefined);
      await manager.shutdown().catch(() => undefined);
      await redis?.quit().catch(() => undefined);
      await pgPool.end().catch(() => undefined);
      process.exit(0);
    });
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
};

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[bot] fatal startup error", error);
  process.exit(1);
});
