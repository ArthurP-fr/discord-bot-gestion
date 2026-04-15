import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { SUPPORTED_LANGS } from "../types/command.js";

loadEnv();

const toBoolean = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
};

const optionalString = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseOptionalUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = optionalString(value);
  if (!normalized) {
    return undefined;
  }

  return normalized;
};

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DATABASE_URL: z
    .string()
    .trim()
    .min(1, "DATABASE_URL is required")
    .url("DATABASE_URL must be a valid URL"),
  DATABASE_SSL: z
    .string()
    .optional()
    .default("false")
    .transform(toBoolean),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z
    .string()
    .optional()
    .default("true")
    .transform(toBoolean),
  DATABASE_SSL_CA: z
    .string()
    .optional()
    .transform((value) => {
      const normalized = optionalString(value);
      if (!normalized) {
        return undefined;
      }

      return normalized.replace(/\\n/g, "\n");
    }),
  ALLOW_INSECURE_DB_SSL: z
    .string()
    .optional()
    .default("false")
    .transform(toBoolean),
  PRESENCE_STREAM_URL: z
    .string()
    .url("PRESENCE_STREAM_URL must be a valid URL")
    .optional()
    .default("https://twitch.tv/discord"),
  PREFIX: z.string().min(1).max(5).default("+"),
  DEFAULT_LANG: z.enum(SUPPORTED_LANGS).default("en"),
  DEV_GUILD_ID: z.string().optional().transform((value) => value && value.length > 0 ? value : undefined),
  AUTO_DEPLOY_SLASH: z
    .string()
    .optional()
    .default("false")
    .transform(toBoolean),
  LOG_LEVEL: z.string().trim().min(1).default("info"),
  STATE_BACKEND: z.enum(["memory", "redis"]).default("memory"),
  REDIS_URL: z.preprocess(parseOptionalUrl, z.string().url("REDIS_URL must be a valid URL").optional()),
  COMMAND_DISPATCH_MODE: z.enum(["local", "worker"]).default("local"),
  COMMAND_QUEUE_NAME: z.string().trim().min(1).default("bot:${botId}:command-jobs"),
  GLOBAL_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(20),
  GLOBAL_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_FAIL_OPEN: z
    .string()
    .optional()
    .default("false")
    .transform(toBoolean),
  ENABLE_LEADER_ELECTION: z
    .string()
    .optional()
    .default("true")
    .transform(toBoolean),
});

const parsed = envSchema.parse(process.env);

if (parsed.DATABASE_SSL && !parsed.DATABASE_SSL_REJECT_UNAUTHORIZED && !parsed.ALLOW_INSECURE_DB_SSL) {
  throw new Error(
    "Insecure DATABASE_SSL configuration detected: rejectUnauthorized=false is blocked by default. Set DATABASE_SSL_REJECT_UNAUTHORIZED=true or explicitly set ALLOW_INSECURE_DB_SSL=true for non-production environments.",
  );
}

if (parsed.STATE_BACKEND === "redis" && !parsed.REDIS_URL) {
  throw new Error(
    "REDIS_URL is required when STATE_BACKEND=redis.",
  );
}

export const env = parsed;
