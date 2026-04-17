import type {
  MemberMessageConfig,
  MemberMessageKind,
} from "../../types/memberMessages.js";

export interface MemberMessageRepository {
  getByBotGuildKind(botId: string, guildId: string, kind: MemberMessageKind): Promise<MemberMessageConfig>;
  upsertByBotGuildKind(botId: string, guildId: string, kind: MemberMessageKind, config: MemberMessageConfig): Promise<void>;
  deleteByBotGuild(botId: string, guildId: string): Promise<void>;
}
