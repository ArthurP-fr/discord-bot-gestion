import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { SUPPORTED_LANGS } from "../types/command.js";

loadEnv();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  PREFIX: z.string().min(1).max(5).default("+"),
  DEFAULT_LANG: z.enum(SUPPORTED_LANGS).default("en"),
  DEV_GUILD_ID: z.string().optional().transform((value) => value && value.length > 0 ? value : undefined),
  AUTO_DEPLOY_SLASH: z
    .string()
    .optional()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
});

export const env = envSchema.parse(process.env);
