import type { Redis } from "ioredis";

import type { CommandExecutionJob, CommandJobPublisher } from "./dispatch.js";

export class RedisCommandJobPublisher implements CommandJobPublisher {
  public constructor(
    private readonly redis: Redis,
    private readonly queueName = "bot:${botId}:command-jobs",
  ) {}

  public async publish(job: CommandExecutionJob): Promise<void> {
    await this.redis.lpush(this.resolveQueueName(job.botId), JSON.stringify(job));
  }

  private resolveQueueName(botId: string): string {
    if (this.queueName.includes("${botId}")) {
      return this.queueName.replaceAll("${botId}", botId);
    }

    if (this.queueName === "bot:command-jobs") {
      return `bot:${botId}:command-jobs`;
    }

    if (this.queueName.startsWith("bot:")) {
      return this.queueName;
    }

    return `bot:${botId}:${this.queueName}`;
  }
}
