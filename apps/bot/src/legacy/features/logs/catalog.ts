import type {
  LogEventCategoryKey,
  LogEventDefinition,
} from "../../types/logs.js";

export const LOG_EVENT_DEFINITIONS: readonly LogEventDefinition[] = [
  { key: "messageCreate", category: "message" },
  { key: "messageDelete", category: "message" },
  { key: "messageUpdate", category: "message" },
  { key: "messageBulkDelete", category: "message" },
  { key: "guildMemberAdd", category: "member" },
  { key: "guildMemberRemove", category: "member" },
  { key: "guildMemberUpdate", category: "member" },
  { key: "interactionCreate", category: "interaction" },
  { key: "channelCreate", category: "channel" },
  { key: "channelDelete", category: "channel" },
  { key: "channelUpdate", category: "channel" },
  { key: "roleCreate", category: "role" },
  { key: "roleDelete", category: "role" },
  { key: "roleUpdate", category: "role" },
  { key: "threadCreate", category: "thread" },
  { key: "threadDelete", category: "thread" },
  { key: "threadUpdate", category: "thread" },
  { key: "emojiCreate", category: "emoji" },
  { key: "emojiDelete", category: "emoji" },
  { key: "emojiUpdate", category: "emoji" },
  { key: "guildUpdate", category: "guild" },
  { key: "guildUnavailable", category: "guild" },
  { key: "guildBanAdd", category: "moderation" },
  { key: "guildBanRemove", category: "moderation" },
  { key: "inviteCreate", category: "invite" },
  { key: "inviteDelete", category: "invite" },
];

export const LOG_EVENT_KEYS = LOG_EVENT_DEFINITIONS.map((definition) => definition.key);

export const LOG_EVENT_KEYS_SET = new Set(LOG_EVENT_KEYS);

export const LOG_CHANNEL_NAME_BY_CATEGORY: Record<LogEventCategoryKey, string> = {
  message: "logs-message",
  member: "logs-member",
  interaction: "logs-interaction",
  channel: "logs-channel",
  role: "logs-role",
  thread: "logs-thread",
  emoji: "logs-emoji",
  guild: "logs-guild",
  moderation: "logs-moderation",
  invite: "logs-invite",
};

export const LOG_EVENT_CATEGORY_KEYS = Object.keys(LOG_CHANNEL_NAME_BY_CATEGORY) as LogEventCategoryKey[];

export const LOGS_PANEL_EVENTS_PER_PAGE = 15;