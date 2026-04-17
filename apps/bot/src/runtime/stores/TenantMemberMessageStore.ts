import type { Pool } from "pg";

import type {
  MemberMessageConfig,
  MemberMessageKind,
  MemberMessageRow,
} from "../../legacy/types/memberMessages.js";
import {
  createDefaultMemberMessageConfig,
  isMemberMessageRenderTypeValue,
  sanitizeMemberMessageRoleIds,
} from "../../legacy/validators/memberMessages.js";
import type { MemberMessageRepository } from "../../legacy/modules/memberMessages/index.js";

const memberMessageSchemaProbeSql = `
SELECT
  bot_id,
  tenant_id,
  owner_user_id,
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

export class TenantMemberMessageStore implements MemberMessageRepository {
  public constructor(
    private readonly pool: Pool,
    private readonly tenantId: string,
    private readonly ownerUserId: string,
  ) {}

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
      WHERE bot_id = $1 AND tenant_id = $2 AND guild_id = $3 AND kind = $4
      LIMIT 1
      `,
      [botId, this.tenantId, guildId, kind],
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
        tenant_id,
        owner_user_id,
        guild_id,
        kind,
        enabled,
        channel_id,
        message_type,
        auto_role_ids,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (bot_id, guild_id, kind)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        owner_user_id = EXCLUDED.owner_user_id,
        enabled = EXCLUDED.enabled,
        channel_id = EXCLUDED.channel_id,
        message_type = EXCLUDED.message_type,
        auto_role_ids = EXCLUDED.auto_role_ids,
        updated_at = NOW()
      `,
      [
        botId,
        this.tenantId,
        this.ownerUserId,
        guildId,
        kind,
        config.enabled,
        config.channelId,
        config.messageType,
        JSON.stringify(autoRoleIds),
      ],
    );
  }

  public async deleteByBotGuild(botId: string, guildId: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM bot_member_message_configs WHERE bot_id = $1 AND tenant_id = $2 AND guild_id = $3",
      [botId, this.tenantId, guildId],
    );
  }
}
