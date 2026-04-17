import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { Redis } from "ioredis";

import { parseTokenEncryptionKey } from "@saas/shared";

import { env } from "./config/env.js";
import { createPgPool } from "./db/pool.js";
import { getUserByIdAndTenant } from "./db/repositories.js";
import { requireAuth } from "./middleware/auth.js";
import { createTenantRateLimit } from "./middleware/tenantRateLimit.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createBotRouter } from "./routes/botRoutes.js";
import { createBotControlQueue } from "./services/botControlQueue.js";

const bootstrap = async (): Promise<void> => {
  const pgPool = createPgPool();

  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const tokenEncryptionKey = parseTokenEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  const botControlQueue = createBotControlQueue(redis.duplicate());

  await pgPool.query("SELECT 1");
  await redis.ping();

  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: env.WEB_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "api",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/auth", createAuthRouter({ pool: pgPool }));

  app.get("/api/me", requireAuth, async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const user = await getUserByIdAndTenant(pgPool, req.auth.userId, req.auth.tenantId);
    if (!user) {
      res.status(401).json({ error: "Session does not match an existing user" });
      return;
    }

    res.json({
      user: {
        id: user.id,
        tenantId: user.tenantId,
        discordUserId: user.discordUserId,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    });
  });

  const tenantControlRateLimit = createTenantRateLimit({
    redis,
    scope: "bot-control",
    maxRequests: env.TENANT_RATE_LIMIT_MAX,
    windowSeconds: env.TENANT_RATE_LIMIT_WINDOW_SECONDS,
  });

  app.use(
    "/api/bots",
    requireAuth,
    createBotRouter({
      pool: pgPool,
      queue: botControlQueue,
      tokenEncryptionKey,
      tenantControlRateLimit,
    }),
  );

  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on :${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`[api] shutdown requested (${signal})`);

    server.close(async () => {
      await botControlQueue.close();
      await redis.quit().catch(() => undefined);
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
  console.error("[api] fatal startup error", error);
  process.exit(1);
});
