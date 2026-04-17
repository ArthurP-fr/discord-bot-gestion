import type { Client } from "discord.js";

import { env } from "../../config/env.js";
import { hasTemplateVariable, renderTemplate } from "../../utils/templateVariables.js";
import { sanitizeActivityText } from "../../validators/presence.js";

export const PRESENCE_TEMPLATE_REFRESH_INTERVAL_MS = 60_000;

export const PRESENCE_VISIBLE_TEMPLATE_VARIABLES = [
  "bot_name",
  "bot_tag",
  "bot_id",
  "guild_count",
  "member_count",
  "channel_count",
  "uptime",
  "uptime_seconds",
  "prefix",
] as const;

const PRESENCE_TEMPLATE_VARIABLE_ALIASES: Record<string, string> = {
  bot: "bot_name",
  guilds: "guild_count",
  servers: "guild_count",
  users: "member_count",
  members: "member_count",
  channels: "channel_count",
};

const PRESENCE_KNOWN_TEMPLATE_VARIABLES = new Set<string>([
  ...PRESENCE_VISIBLE_TEMPLATE_VARIABLES,
  ...Object.keys(PRESENCE_TEMPLATE_VARIABLE_ALIASES),
]);

const formatUptime = (totalSeconds: number): string => {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0 || days > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${seconds}s`);

  return parts.join(" ");
};

const buildPresenceTemplateValues = (client: Client): Record<string, string> => {
  const guildCount = client.guilds.cache.size;
  const memberCount = client.guilds.cache.reduce((total, guild) => total + (guild.memberCount ?? 0), 0);
  const channelCount = client.channels.cache.size;
  const uptimeSeconds = Math.max(0, Math.floor((client.uptime ?? process.uptime() * 1_000) / 1_000));

  return {
    bot_name: client.user?.username ?? "bot",
    bot_tag: client.user?.tag ?? "bot#0000",
    bot_id: client.user?.id ?? "unknown",
    guild_count: String(guildCount),
    member_count: String(memberCount),
    channel_count: String(channelCount),
    uptime: formatUptime(uptimeSeconds),
    uptime_seconds: String(uptimeSeconds),
    prefix: env.PREFIX,
  };
};

export const renderPresenceTemplate = (client: Client, template: string): string => {
  const sanitizedTemplate = sanitizeActivityText(template);
  const rendered = renderTemplate(sanitizedTemplate, buildPresenceTemplateValues(client), {
    aliases: PRESENCE_TEMPLATE_VARIABLE_ALIASES,
    keepUnknown: true,
  });

  return sanitizeActivityText(rendered);
};

export const containsPresenceTemplateVariables = (template: string): boolean =>
  hasTemplateVariable(template, PRESENCE_KNOWN_TEMPLATE_VARIABLES, PRESENCE_TEMPLATE_VARIABLE_ALIASES);

export const getPresenceTemplateHelpText = (): string =>
  PRESENCE_VISIBLE_TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join(", ");
