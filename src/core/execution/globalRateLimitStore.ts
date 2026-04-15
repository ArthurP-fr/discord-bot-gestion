import type { Redis } from "ioredis";

export interface GlobalRateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

export interface GlobalRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
}

export interface GlobalRateLimitStore {
  consume(botId: string, userId: string, policy: GlobalRateLimitPolicy): Promise<GlobalRateLimitDecision>;
}

interface WindowCounterEntry {
  count: number;
  resetAt: number;
}

export class MemoryGlobalRateLimitStore implements GlobalRateLimitStore {
  private readonly counters = new Map<string, WindowCounterEntry>();

  public async consume(botId: string, userId: string, policy: GlobalRateLimitPolicy): Promise<GlobalRateLimitDecision> {
    const sanitized = sanitizePolicy(policy);
    const now = Date.now();
    const key = this.key(botId, userId, sanitized.windowSeconds);
    const existing = this.counters.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + sanitized.windowSeconds * 1000;
      this.counters.set(key, {
        count: 1,
        resetAt,
      });

      return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: Math.max(0, sanitized.limit - 1),
        limit: sanitized.limit,
      };
    }

    existing.count += 1;

    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    const allowed = existing.count <= sanitized.limit;

    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
      remaining: Math.max(0, sanitized.limit - existing.count),
      limit: sanitized.limit,
    };
  }

  private key(botId: string, userId: string, windowSeconds: number): string {
    return `${botId}:${userId}:${windowSeconds}`;
  }
}

export class RedisGlobalRateLimitStore implements GlobalRateLimitStore {
  private static readonly CONSUME_WINDOW_SCRIPT = `
    local key = KEYS[1]
    local window = tonumber(ARGV[1])

    if not window or window <= 0 then
      return redis.error_reply("invalid window")
    end

    local count = redis.call("INCR", key)
    if count == 1 then
      redis.call("EXPIRE", key, window)
      return { count, window }
    end

    local ttl = redis.call("TTL", key)
    if ttl < 0 then
      redis.call("EXPIRE", key, window)
      ttl = window
    end

    return { count, ttl }
  `;

  public constructor(
    private readonly redis: Redis,
    private readonly keyPrefix = "bot",
  ) {}

  public async consume(botId: string, userId: string, policy: GlobalRateLimitPolicy): Promise<GlobalRateLimitDecision> {
    const sanitized = sanitizePolicy(policy);
    const key = this.key(botId, userId);

    const rawResult = await this.redis.eval(
      RedisGlobalRateLimitStore.CONSUME_WINDOW_SCRIPT,
      1,
      key,
      String(sanitized.windowSeconds),
    );
    const { count, retryAfterSeconds } = parseScriptResult(rawResult, sanitized.windowSeconds);
    const allowed = count <= sanitized.limit;

    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
      remaining: Math.max(0, sanitized.limit - count),
      limit: sanitized.limit,
    };
  }

  private key(botId: string, userId: string): string {
    return `${this.keyPrefix}:${botId}:ratelimit:user:${userId}`;
  }
}

const sanitizePolicy = (policy: GlobalRateLimitPolicy): GlobalRateLimitPolicy => {
  const limit = Number.isFinite(policy.limit) && policy.limit > 0 ? Math.floor(policy.limit) : 1;
  const windowSeconds = Number.isFinite(policy.windowSeconds) && policy.windowSeconds > 0
    ? Math.floor(policy.windowSeconds)
    : 1;

  return {
    limit,
    windowSeconds,
  };
};

const parseScriptResult = (rawResult: unknown, fallbackWindowSeconds: number): { count: number; retryAfterSeconds: number } => {
  if (!Array.isArray(rawResult) || rawResult.length < 2) {
    throw new Error("Redis rate limit script returned an unexpected payload");
  }

  const count = toPositiveInt(rawResult[0]);
  if (!count) {
    throw new Error("Redis rate limit script returned an invalid counter value");
  }

  const ttl = toPositiveInt(rawResult[1]) ?? fallbackWindowSeconds;

  return {
    count,
    retryAfterSeconds: ttl,
  };
};

const toPositiveInt = (value: unknown): number | null => {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string"
    ? Number(value)
    : Number.NaN;

  if (!Number.isFinite(numeric)) {
    return null;
  }

  const integer = Math.floor(numeric);
  return integer > 0 ? integer : null;
};
