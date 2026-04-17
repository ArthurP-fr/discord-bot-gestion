import type { Redis } from "ioredis";

const COOLDOWN_SWEEP_INTERVAL_MS = 60_000;
const COOLDOWN_SWEEP_MIN_ENTRIES = 512;

export interface CooldownConsumeResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface CooldownStore {
  consume(botId: string, commandName: string, subjectId: string, cooldownSeconds: number): Promise<CooldownConsumeResult>;
}

export class MemoryCooldownStore implements CooldownStore {
  private readonly cooldowns = new Map<string, number>();
  private lastSweepAt = 0;

  public async consume(
    botId: string,
    commandName: string,
    subjectId: string,
    cooldownSeconds: number,
  ): Promise<CooldownConsumeResult> {
    if (cooldownSeconds <= 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const key = this.key(botId, commandName, subjectId);
    const now = Date.now();
    this.sweepExpired(now);

    const expiresAt = this.cooldowns.get(key);
    if (expiresAt !== undefined && expiresAt > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((expiresAt - now) / 1000),
      };
    }

    this.cooldowns.set(key, now + cooldownSeconds * 1000);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private key(botId: string, commandName: string, subjectId: string): string {
    return `${botId}:${commandName}:${subjectId}`;
  }

  private sweepExpired(now: number): void {
    if (this.cooldowns.size === 0) {
      return;
    }

    const shouldSweepBySize = this.cooldowns.size >= COOLDOWN_SWEEP_MIN_ENTRIES;
    const shouldSweepByTime = now - this.lastSweepAt >= COOLDOWN_SWEEP_INTERVAL_MS;
    if (!shouldSweepBySize && !shouldSweepByTime) {
      return;
    }

    for (const [key, expiresAt] of this.cooldowns.entries()) {
      if (expiresAt <= now) {
        this.cooldowns.delete(key);
      }
    }

    this.lastSweepAt = now;
  }
}

export class RedisCooldownStore implements CooldownStore {
  public constructor(
    private readonly redis: Redis,
    private readonly keyPrefix = "bot",
  ) {}

  public async consume(
    botId: string,
    commandName: string,
    subjectId: string,
    cooldownSeconds: number,
  ): Promise<CooldownConsumeResult> {
    if (cooldownSeconds <= 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const key = this.key(botId, commandName, subjectId);
    const result = await this.redis.set(key, "1", "EX", cooldownSeconds, "NX");
    if (result === "OK") {
      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }

    let ttl = await this.redis.ttl(key);
    if (ttl <= 0) {
      await this.redis.expire(key, cooldownSeconds);
      ttl = cooldownSeconds;
    }

    return {
      allowed: false,
      retryAfterSeconds: ttl,
    };
  }

  private key(botId: string, commandName: string, subjectId: string): string {
    return `${this.keyPrefix}:${botId}:cooldown:${commandName}:${subjectId}`;
  }
}
