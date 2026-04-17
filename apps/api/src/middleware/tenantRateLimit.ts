import type { RequestHandler } from "express";
import type { Redis } from "ioredis";

import { tenantRateLimitKey } from "@saas/shared";

interface TenantRateLimitOptions {
  redis: Redis;
  scope: string;
  maxRequests: number;
  windowSeconds: number;
}

export const createTenantRateLimit = ({
  redis,
  scope,
  maxRequests,
  windowSeconds,
}: TenantRateLimitOptions): RequestHandler => {
  return async (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const key = tenantRateLimitKey(req.auth.tenantId, scope);

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (count > maxRequests) {
        res.status(429).json({
          error: "Rate limit reached",
          limit: maxRequests,
          windowSeconds,
        });
        return;
      }

      next();
    } catch {
      res.status(503).json({ error: "Rate limit backend unavailable" });
    }
  };
};
