export const BOT_CONTROL_QUEUE = "bot-control";
export const BOT_CONTROL_QUEUE_PREFIX = "discord-saas";

export const BOT_STATUS = ["stopped", "starting", "running", "stopping", "error"] as const;
export type BotStatus = (typeof BOT_STATUS)[number];
