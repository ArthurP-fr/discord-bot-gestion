import { config as loadEnv } from "dotenv";
import pino, { type Logger, type LoggerOptions } from "pino";

const LOG_LEVEL_DEFAULT = "info";

loadEnv();

const resolveLogLevel = (): string => {
  const value = process.env.LOG_LEVEL?.trim();
  return value && value.length > 0 ? value : LOG_LEVEL_DEFAULT;
};

const options: LoggerOptions = {
  level: resolveLogLevel(),
  base: {
    service: "discordjs-framework-template",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

export const logger = pino(options);

export const createScopedLogger = (scope: string): Logger => {
  return logger.child({ scope });
};

export type AppLogger = Logger;
