const sanitizeSegment = (segment: string): string => segment.replace(/[^a-zA-Z0-9:_-]/g, "_");

export const tenantRedisKey = (tenantId: string, ...parts: string[]): string => {
  const tail = parts.map(sanitizeSegment).join(":");
  return tail.length > 0
    ? `tenant:${sanitizeSegment(tenantId)}:${tail}`
    : `tenant:${sanitizeSegment(tenantId)}`;
};

export const tenantRateLimitKey = (tenantId: string, scope: string): string => {
  return tenantRedisKey(tenantId, "ratelimit", scope);
};

export const tenantBotRedisKey = (tenantId: string, botId: string, ...parts: string[]): string => {
  return tenantRedisKey(tenantId, "bot", botId, ...parts);
};
