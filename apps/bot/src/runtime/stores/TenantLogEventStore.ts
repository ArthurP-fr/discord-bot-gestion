import type { Pool } from "pg";

import type {
  LogEventConfig,
  LogEventKey,
  LogEventRepositoryEntry,
  LogEventRow,
} from "../../legacy/types/logs.js";
import type { LogEventRepository } from "../../legacy/modules/logs/index.js";

const logEventSchemaProbeSql = `
SELECT
  bot_id,
  tenant_id,
  owner_user_id,
  guild_id,
  event_key,
  enabled,
  channel_id,
  updated_at
FROM bot_log_event_configs
LIMIT 0;
`;

export class TenantLogEventStore implements LogEventRepository {
  public constructor(
    private readonly pool: Pool,
    private readonly tenantId: string,
    private readonly ownerUserId: string,
  ) {}

  public async init(): Promise<void> {
    try {
      await this.pool.query(logEventSchemaProbeSql);
    } catch (error) {
      throw new Error(
        "[db:init] missing or incompatible table \"bot_log_event_configs\". Run migrations with \"npm run migrate\".",
        { cause: error },
      );
    }
  }

  public async listByBotGuild(botId: string, guildId: string): Promise<LogEventRow[]> {
    const result = await this.pool.query<LogEventRow>(
      `
      SELECT event_key, enabled, channel_id
      FROM bot_log_event_configs
      WHERE bot_id = $1 AND tenant_id = $2 AND guild_id = $3
      ORDER BY event_key ASC
      `,
      [botId, this.tenantId, guildId],
    );

    return result.rows;
  }

  public async upsertByBotGuildEvent(
    botId: string,
    guildId: string,
    eventKey: LogEventKey,
    config: LogEventConfig,
  ): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO bot_log_event_configs (
        bot_id,
        tenant_id,
        owner_user_id,
        guild_id,
        event_key,
        enabled,
        channel_id,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (bot_id, guild_id, event_key)
      DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        owner_user_id = EXCLUDED.owner_user_id,
        enabled = EXCLUDED.enabled,
        channel_id = EXCLUDED.channel_id,
        updated_at = NOW()
      `,
      [
        botId,
        this.tenantId,
        this.ownerUserId,
        guildId,
        eventKey,
        config.enabled,
        config.channelId,
      ],
    );
  }

  public async upsertManyByBotGuildEvents(
    botId: string,
    guildId: string,
    entries: readonly LogEventRepositoryEntry[],
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      for (const entry of entries) {
        await client.query(
          `
          INSERT INTO bot_log_event_configs (
            bot_id,
            tenant_id,
            owner_user_id,
            guild_id,
            event_key,
            enabled,
            channel_id,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (bot_id, guild_id, event_key)
          DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            owner_user_id = EXCLUDED.owner_user_id,
            enabled = EXCLUDED.enabled,
            channel_id = EXCLUDED.channel_id,
            updated_at = NOW()
          `,
          [
            botId,
            this.tenantId,
            this.ownerUserId,
            guildId,
            entry.eventKey,
            entry.config.enabled,
            entry.config.channelId,
          ],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async deleteByBotGuild(botId: string, guildId: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM bot_log_event_configs WHERE bot_id = $1 AND tenant_id = $2 AND guild_id = $3",
      [botId, this.tenantId, guildId],
    );
  }
}
