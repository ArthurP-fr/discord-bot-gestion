import type { Pool } from "pg";

import type {
  MemberMessageConfig,
  MemberMessageKind,
  MemberMessageRow,
} from "../../types/memberMessages.js";
import {
  createDefaultMemberMessageConfig,
  isMemberMessageRenderTypeValue,
  sanitizeMemberMessageRoleIds,
} from "../../validators/memberMessages.js";
import type { MemberMessageRepository } from "../../modules/memberMessages/index.js";

const memberMessageSchemaProbeSql = `
SELECT
  bot_id,
  guild_id,
  kind,
  enabled,
  channel_id,
  message_type,
  auto_role_ids,
  updated_at
FROM bot_member_message_configs
LIMIT 0;
`;

const parseRoleIds = (serialized: string | null): string[] => {
  if (!serialized || serialized.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const roleIds = parsed.filter((value): value is string => typeof value === "string");
    return sanitizeMemberMessageRoleIds(roleIds);
  } catch {
    return [];
  }
};

const toConfig = (row: MemberMessageRow): MemberMessageConfig => {
  const fallback = createDefaultMemberMessageConfig();

  return {
    enabled: row.enabled,
    channelId: row.channel_id,
    messageType: isMemberMessageRenderTypeValue(row.message_type) ? row.message_type : fallback.messageType,
    autoRoleIds: parseRoleIds(row.auto_role_ids),
  };
};

export class PostgresMemberMessageStore implements MemberMessageRepository {
  public constructor(private readonly pool: Pool) {}

  public async init(): Promise<void> {
    try {
      await this.pool.query(memberMessageSchemaProbeSql);
    } catch (error) {
      throw new Error(
        "[db:init] missing or incompatible table \"bot_member_message_configs\". Run migrations with \"npm run migrate\".",
        { cause: error },
      );
    }
  }

  public async getByBotGuildKind(botId: string, guildId: string, kind: MemberMessageKind): Promise<MemberMessageConfig> {
    const result = await this.pool.query<MemberMessageRow>(
      `
      SELECT enabled, channel_id, message_type, auto_role_ids
      FROM bot_member_message_configs
      WHERE bot_id = $1 AND guild_id = $2 AND kind = $3
      LIMIT 1
      `,
      [botId, guildId, kind],
    );

    const row = result.rows[0];
    if (!row) {
      return createDefaultMemberMessageConfig();
    }

    return toConfig(row);
  }

  public async upsertByBotGuildKind(
    botId: string,
    guildId: string,
    kind: MemberMessageKind,
    config: MemberMessageConfig,
  ): Promise<void> {
    const autoRoleIds = sanitizeMemberMessageRoleIds(config.autoRoleIds);

    await this.pool.query(
      `
      INSERT INTO bot_member_message_configs (
        bot_id,
        guild_id,
        kind,
        enabled,
        channel_id,
        message_type,
        auto_role_ids,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (bot_id, guild_id, kind)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        channel_id = EXCLUDED.channel_id,
        message_type = EXCLUDED.message_type,
        auto_role_ids = EXCLUDED.auto_role_ids,
        updated_at = NOW()
      `,
      [botId, guildId, kind, config.enabled, config.channelId, config.messageType, JSON.stringify(autoRoleIds)],
    );
  }

  public async deleteByBotGuild(botId: string, guildId: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM bot_member_message_configs WHERE bot_id = $1 AND guild_id = $2",
      [botId, guildId],
    );
  }
}
