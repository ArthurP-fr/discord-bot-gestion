import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const parseBoolean = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  DATABASE_SSL: z.string().default("false").transform(parseBoolean),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_CLIENT_SECRET: z.string().min(1, "DISCORD_CLIENT_SECRET is required"),
  DISCORD_REDIRECT_URI: z.string().url("DISCORD_REDIRECT_URI must be a valid URL"),
  WEB_URL: z.string().url("WEB_URL must be a valid URL"),
  API_BASE_URL: z.string().url("API_BASE_URL must be a valid URL"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().min(2).default("7d"),
  SESSION_COOKIE_NAME: z.string().min(1).default("saas_session"),
  COOKIE_SECURE: z.string().default("false").transform(parseBoolean),
  TOKEN_ENCRYPTION_KEY: z.string().min(10, "TOKEN_ENCRYPTION_KEY is required"),
  TENANT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  TENANT_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
});

export const env = envSchema.parse(process.env);
