import type { Redis } from "ioredis";
import { Worker } from "bullmq";

import {
  BOT_CONTROL_QUEUE,
  BOT_CONTROL_QUEUE_PREFIX,
  type BotControlJob,
} from "@saas/shared";

import { BotManager } from "../manager/BotManager.js";

export const createBotControlWorker = (redis: Redis, manager: BotManager): Worker<BotControlJob> => {
  return new Worker<BotControlJob>(
    BOT_CONTROL_QUEUE,
    async (job) => {
      switch (job.data.action) {
        case "start":
          await manager.startBot(job.data.botId, job.data.tenantId);
          break;
        case "stop":
          await manager.stopBot(job.data.botId, job.data.tenantId);
          break;
        case "restart":
          await manager.restartBot(job.data.botId, job.data.tenantId);
          break;
        default:
          throw new Error(`Unknown control action: ${job.data.action}`);
      }
    },
    {
      connection: redis,
      prefix: BOT_CONTROL_QUEUE_PREFIX,
      concurrency: 10,
    },
  );
};
