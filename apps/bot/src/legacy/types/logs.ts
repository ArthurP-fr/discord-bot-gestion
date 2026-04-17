import type { Message } from "discord.js";

export type LogEventCategoryKey =
  | "message"
  | "member"
  | "interaction"
  | "channel"
  | "role"
  | "thread"
  | "emoji"
  | "guild"
  | "moderation"
  | "invite";

export type LogEventKey =
  | "messageCreate"
  | "messageDelete"
  | "messageUpdate"
  | "messageBulkDelete"
  | "guildMemberAdd"
  | "guildMemberRemove"
  | "guildMemberUpdate"
  | "interactionCreate"
  | "channelCreate"
  | "channelDelete"
  | "channelUpdate"
  | "roleCreate"
  | "roleDelete"
  | "roleUpdate"
  | "threadCreate"
  | "threadDelete"
  | "threadUpdate"
  | "emojiCreate"
  | "emojiDelete"
  | "emojiUpdate"
  | "guildUpdate"
  | "guildUnavailable"
  | "guildBanAdd"
  | "guildBanRemove"
  | "inviteCreate"
  | "inviteDelete";

export interface LogEventDefinition {
  key: LogEventKey;
  category: LogEventCategoryKey;
}

export interface LogEventConfig {
  enabled: boolean;
  channelId: string | null;
}

export type LogEventStateByKey = Record<LogEventKey, LogEventConfig>;

export interface LogEventRow {
  event_key: string;
  enabled: boolean;
  channel_id: string | null;
}

export interface LogEventRepositoryEntry {
  eventKey: LogEventKey;
  config: LogEventConfig;
}

export interface LogRuntimeDispatchInput {
  eventKey: LogEventKey;
  guildId: string;
  summary: string;
  details?: string[];
  color?: number;
}

export interface LogPanelCustomIds {
  enableAllButton: string;
  disableAllButton: string;
  createChannelsButton: string;
  previousPageButton: string;
  nextPageButton: string;
  toggleButtonsByEvent: Record<LogEventKey, string>;
}

export interface LogPanelSession {
  collector: ReturnType<Message["createMessageComponentCollector"]>;
  disable: () => Promise<void>;
}

export interface LogChannelProvisionResult {
  createdCount: number;
  reusedCount: number;
  failedCategories: LogEventCategoryKey[];
}