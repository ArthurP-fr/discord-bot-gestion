import type {
  LogEventConfig,
  LogEventKey,
  LogEventRepositoryEntry,
  LogEventRow,
} from "../../types/logs.js";

export interface LogEventRepository {
  listByBotGuild(botId: string, guildId: string): Promise<LogEventRow[]>;
  upsertByBotGuildEvent(botId: string, guildId: string, eventKey: LogEventKey, config: LogEventConfig): Promise<void>;
  upsertManyByBotGuildEvents(botId: string, guildId: string, entries: readonly LogEventRepositoryEntry[]): Promise<void>;
  deleteByBotGuild(botId: string, guildId: string): Promise<void>;
}