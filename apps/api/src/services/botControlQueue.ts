import { Queue } from "bullmq";
import type { Redis } from "ioredis";

import {
  BOT_CONTROL_QUEUE,
  BOT_CONTROL_QUEUE_PREFIX,
  type BotControlAction,
  type BotControlJob,
} from "@saas/shared";

export const createBotControlQueue = (redis: Redis): Queue<BotControlJob> => {
  return new Queue<BotControlJob>(BOT_CONTROL_QUEUE, {
    connection: redis,
    prefix: BOT_CONTROL_QUEUE_PREFIX,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 750,
      },
      removeOnComplete: 1000,
      removeOnFail: 3000,
    },
  });
};

export const enqueueBotControlAction = async (
  queue: Queue<BotControlJob>,
  input: {
    tenantId: string;
    userId: string;
    botId: string;
    action: BotControlAction;
  },
): Promise<void> => {
  const payload: BotControlJob = {
    tenantId: input.tenantId,
    userId: input.userId,
    botId: input.botId,
    action: input.action,
    requestedAt: new Date().toISOString(),
  };

  await queue.add(`${input.action}:${input.botId}:${Date.now()}`, payload);
};
