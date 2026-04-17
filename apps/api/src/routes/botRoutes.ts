import type { RequestHandler, Router } from "express";
import { Router as expressRouter } from "express";
import type { Queue } from "bullmq";
import { z } from "zod";
import type { Pool } from "pg";

import type { BotControlJob } from "@saas/shared";
import { encryptToken } from "@saas/shared";

import { validateDiscordBotToken } from "../auth/discordOAuth.js";
import {
  createOrUpdateBotForTenant,
  getBotForTenant,
  insertBotRuntimeEvent,
  listBotsForTenant,
  setBotStatusForTenant,
} from "../db/repositories.js";
import { enqueueBotControlAction } from "../services/botControlQueue.js";

const addBotSchema = z.object({
  token: z.string().min(20, "Bot token is required"),
  displayName: z.string().min(2).max(80).optional(),
});

const botIdParamsSchema = z.object({
  botId: z.string().uuid("botId must be a valid UUID"),
});

interface BotRouterDependencies {
  pool: Pool;
  queue: Queue<BotControlJob>;
  tokenEncryptionKey: Buffer;
  tenantControlRateLimit: RequestHandler;
}

const queueBotAction = (
  action: "start" | "stop" | "restart",
  statusDuringAction: "starting" | "stopping",
  deps: BotRouterDependencies,
): RequestHandler => {
  return async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const parsedParams = botIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: "Invalid botId" });
      return;
    }

    const bot = await getBotForTenant(deps.pool, req.auth.tenantId, parsedParams.data.botId);
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    await setBotStatusForTenant(deps.pool, req.auth.tenantId, parsedParams.data.botId, statusDuringAction, null);

    await insertBotRuntimeEvent(deps.pool, {
      tenantId: req.auth.tenantId,
      botId: parsedParams.data.botId,
      level: "info",
      message: `Bot ${action} requested by dashboard user`,
      metadata: {
        userId: req.auth.userId,
        action,
      },
    });

    await enqueueBotControlAction(deps.queue, {
      tenantId: req.auth.tenantId,
      userId: req.auth.userId,
      botId: parsedParams.data.botId,
      action,
    });

    res.status(202).json({
      accepted: true,
      action,
      botId: parsedParams.data.botId,
    });
  };
};

export const createBotRouter = (deps: BotRouterDependencies): Router => {
  const router = expressRouter();

  router.get("/", async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const bots = await listBotsForTenant(deps.pool, req.auth.tenantId);
    res.json({ bots });
  });

  router.post("/", async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const parsedBody = addBotSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.issues[0]?.message ?? "Invalid body" });
      return;
    }

    try {
      const botIdentity = await validateDiscordBotToken(parsedBody.data.token);
      const encryptedToken = encryptToken(parsedBody.data.token, deps.tokenEncryptionKey);

      const bot = await createOrUpdateBotForTenant(deps.pool, {
        tenantId: req.auth.tenantId,
        ownerUserId: req.auth.userId,
        discordBotId: botIdentity.id,
        displayName: parsedBody.data.displayName ?? botIdentity.displayName,
        encryptedToken,
      });

      await insertBotRuntimeEvent(deps.pool, {
        tenantId: req.auth.tenantId,
        botId: bot.id,
        level: "info",
        message: "Bot credentials stored and encrypted",
        metadata: {
          byUser: req.auth.userId,
          discordBotId: botIdentity.id,
        },
      });

      res.status(201).json({ bot });
    } catch (error) {
      if (error instanceof Error && error.message === "BOT_ALREADY_CLAIMED") {
        res.status(409).json({ error: "This Discord bot is already claimed by another tenant" });
        return;
      }

      if (error instanceof Error && error.message === "Invalid Discord bot token") {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: "Unable to store bot" });
    }
  });

  router.post("/:botId/start", deps.tenantControlRateLimit, queueBotAction("start", "starting", deps));
  router.post("/:botId/stop", deps.tenantControlRateLimit, queueBotAction("stop", "stopping", deps));
  router.post("/:botId/restart", deps.tenantControlRateLimit, queueBotAction("restart", "starting", deps));

  return router;
};
